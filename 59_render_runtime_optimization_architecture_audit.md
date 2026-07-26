# Render Runtime Optimization Architecture Audit

> 문서 번호: 59
> 상태: 코드 조사 완료 / 제품 수정 미실행
> 기준일: 2026-07-26
> 목적: LayerDocument 전환과 PSD 적층 순서 복구 이후 Render/Canvas
> 최적화의 실제 연결 상태, 회귀 위험과 복구 우선순위를 기록한다.

## 1. 결론

기존 Render 최적화가 전부 사라진 것은 아니다.

- Full/Fast Renderer 분리
- Preview Dirty Region
- Composition Cache
- Surface Cache
- Source Runtime Cache
- fast renderer의 previous-scene node reuse
- Canvas backing scale

은 현재 코드에 남아 있다.

하지만 다음 이유로 과거 문서의 성능 결과를 현재 제품에 그대로 적용할
수 없다.

1. Canvas 적층 순서를 맞추기 위해 추가한 재귀 reverse가 모든
   Composition node reference를 새로 만든다.
2. LayerDocument 전환 뒤 기존 Preview Draft Pipeline은 제품 경로에서
   호출되지 않는다.
3. Preview bitmap quality/cache lifecycle은 현재 제품에 연결되지 않는다.
4. Runtime Metrics 중 renderer/dirty/node/project/history 계측이 실제
   제품 경로에서 끊겼다.
5. static PSD도 frame이 바뀌면 `layerResultCacheKey`가 바뀌어 fast node
   reuse가 제한된다.
6. 기존 production profiling fixture는 이전 ProjectSource/TimelineItem
   identity를 사용하므로 현재 LayerDocument 제품을 측정하는 기준으로
   바로 사용할 수 없다.

따라서 현재 상태는 다음과 같이 평가한다.

> 출력 정확성은 복구됐지만, 이전에 증명한 “변하지 않은 것은 다시
> 그리지 않는다”는 성능 계약은 다시 측정하고 복구해야 한다.

## 2. 조사 범위

### 영구 문서

- `42_preview_quality_and_memory_cache.md`
- `43_dual_renderer_architecture.md`
- `44_preview_runtime_optimization.md`
- `45_editor_draft_runtime_integration.md`
- `47_canvas_engine_responsibility_refactoring.md`
- `48_canvas_visual_layer_selection.md`
- `49_transform_drag_runtime_continuity_optimization.md`
- `50_measured_preview_interaction_runtime_optimization.md`
- `56_layer_document_architecture.md`
- `58_editor_project_owner_panel_engine_architecture.md`

### 현재 코드 경계

- LayerDocument runtime input/evaluation
- full/fast renderer
- Preview Scene/Render Frame
- Canvas painter 변환
- Dirty Region
- Composition/Surface/Source Runtime Cache
- Preview Quality/Memory Runtime
- Runtime Metrics
- Draft Runtime
- Direct Selection/Glow
- production profiling assets

이번 조사는 정적 코드 분석과 기존 verification 결과를 기준으로 했다.
제품 코드 수정, Browser QA와 새 성능 측정은 수행하지 않았다.

## 3. 현재 실제 Runtime 흐름

```text
LayerDocumentProject
  ↓
layerDocumentRuntimeInputAdapter
  - Placement order 오름차순
  - frame / animation / modifier / draft 평가
  - sourceResourceCacheKey
  - layerResultCacheKey
  ↓
Evaluated Scene
  ├─ full-render
  │    ↓
  │  Accurate Renderer
  │    ↓
  │  RenderFrame
  │
  └─ fast-render
       ↓
     Fast Preview Renderer
       ↓
     Preview Scene
  ↓
useCanvasRenderController
  - Scene/Frame의 모든 배열을 재귀 reverse
  ↓
Canvas2D draw
  ├─ Dirty Region
  ├─ Composition Cache
  ├─ Surface Cache
  └─ Source Runtime visual resolver
```

현재 `Placement order`와 Timeline은 PSD/UI 기준 위→아래다. Canvas는
아래 Layer부터 그려야 하므로 실제 draw는 역순이어야 한다.

이 방향 자체는 맞다. 문제는 순서를 뒤집는 방식이 Runtime 객체의
reference identity까지 파괴한다는 점이다.

## 4. 현재 유지된 최적화

| 영역 | 현재 상태 | 판단 |
|---|---|---|
| Full/Fast Renderer | 같은 Evaluated Scene에서 RenderFrame/PreviewScene 분기 | 유지 |
| Source Runtime Cache | stable source key, targeted invalidation, suspend/restore, dispose-once | 유지 |
| Fast previous-scene reuse | 값이 같은 Layer/Composition node reference 재사용 시도 | painter 변환 전까지 유지 |
| Dirty Region | 이전/현재 bounds union과 교차 node만 redraw | 코드 유지 |
| Composition Cache | quality/scale/mode와 Group 내부 content identity 기반 surface 재사용 | 연결 복구 |
| Surface Cache | logical/pixel size와 quality/scale 기반 pool/LRU | 유지 |
| Full Render surface reuse | traversal surface factory를 frame 간 재사용 | 유지 |
| Canvas backing scale | Preview quality scale을 root/offscreen pixel backing에 반영 | 유지 |
| Draft 중 Composition Cache | 외부 Transform은 기존 surface 재사용, 자식 visual 변경만 무효화 | 연결 복구 |
| Direct Selection | Source Alpha 기반 transparent fallthrough | 유지 |
| 선택 강조 | 같은 Alpha의 Editor-only silhouette screen tone | 유지 |

이 표는 코드가 존재한다는 의미다. 실제 제품에서 과거와 같은 hit rate와
frame pacing이 나온다는 의미는 아니다.

## 5. 확정된 회귀 — Painter reverse와 reference identity

### 5.1 현재 구현

`src/engines/canvas/controllers/useCanvasRenderController.ts`는
Preview Scene과 Render Frame을 Canvas에 전달하기 전에 재귀적으로
뒤집는다.

```text
Preview Scene
  → root nodes reverse
  → 모든 Composition spread clone
  → 모든 Composition children reverse
```

### 5.2 왜 성능 계약을 깨는가

Dirty Region은 같은 node reference를 clean 판정의 가장 빠른 조건으로
사용한다.

```text
previousNode === nextNode
  → clean
```

Composition Cache도 같은 key뿐 아니라 같은 Composition node reference를
요구한다.

```text
cache key 동일
AND cachedNode === currentNode
  → cache hit
```

현재 painter 변환은 upstream fast renderer가 Composition reference를
재사용해도 매번 새 Composition 객체와 새 children 배열을 만든다.

확인된 결과:

```text
upstream Composition node reused: true
painter Composition node reused: false
두 번째 draw plan: dirty
Composition cache hit: false
```

### 5.3 실제 영향

- 변경되지 않은 sibling Group도 새 객체가 된다.
- Dirty bounds가 전체 Group bounds로 확대될 수 있다.
- full-document size Group이 있으면 작은 Layer 변경도 넓은 영역을
  다시 그릴 수 있다.
- committed fast frame에서 Composition Cache가 miss하고 child를 다시
  합성할 수 있다.
- full-render는 원래 full draw이므로 cache 정확성 회귀는 없지만,
  매 RenderFrame마다 command/Composition clone과 배열 할당이 추가된다.
- Draft 중 Composition Cache는 원래 bypass하므로 cache hit 손실보다
  Dirty Region 확대와 객체 할당 증가가 주요 영향이다.

출력은 안전하게 다시 그리므로 화면 정확성은 유지된다. 성능만 조용히
퇴행할 수 있어 기존 기능 QA만으로 발견하기 어렵다.

## 6. LayerDocument 전환 뒤 확인된 Optimization Drift

### 6.1 Preview Draft Pipeline 미연결

`usePreviewUpdatePipeline.ts`와 Dirty/Node cache helper는 남아 있지만 현재
제품 호출자가 없다.

현재 PointerMove는 Project/History를 변경하지 않는 Draft 계약은
유지한다. 그러나 shared Draft revision이 바뀔 때 LayerDocument runtime
input과 renderer read model이 다시 계산된다.

즉 과거 문서 44의 다음 계약은 현재 wiring과 일치하지 않는다.

```text
PointerMove
  → Preview Update Pipeline만 갱신
  → Animation Evaluation / Renderer 재호출 없음
```

### 6.2 static Layer의 frame identity

현재 `layerResultCacheKey`는 global/local frame을 항상 포함한다.
Fast renderer equality도 이 key를 비교한다.

따라서 실제 pixel 결과가 변하지 않는 static PSD도 playback frame이
바뀌면 result identity가 바뀌고 node reuse가 제한될 수 있다.

필요한 구분:

- Evaluation identity: 어느 frame을 평가했는가
- Visual result identity: 실제 표시 결과가 바뀌었는가

미래 Audio/Video/effect처럼 시간에 따라 source visual이 달라지는
Layer와 static PSD를 같은 방식으로 단순 생략해서는 안 된다.

### 6.3 Runtime Metrics 미연결

제품 Canvas draw 경로에는 draw/surface/cache 일부 metrics가 전달된다.
하지만 다음 계측은 실제 제품 경로에서 완전하지 않다.

- fast/accurate renderer 호출
- Preview Scene generation
- dirty/node update/reuse
- animation evaluation
- Project update
- History commit
- frame reset 기준

Renderer helper는 metric port를 받을 수 있지만 현재 Canvas mode adapter가
전달하지 않는다. 사용되지 않는 Preview Pipeline의 dirty/node metrics도
제품 수치가 아니다.

따라서 과거 문서의 counter 표를 현재 제품에서 바로 재현할 수 없다.

### 6.4 Preview Quality 정책 확정

Sprint 3에서 source bitmap cache를 복원하지 않고 backing-scale-only 정책을
확정했다. 품질 선택은 root/offscreen backing `pixelScale`과 cache key에
반영되며 Source Runtime의 original visual은 그대로 사용한다. 연결되지 않은
bitmap memory estimator와 `0 B` UI는 제거했다.

이 선택은 별도 bitmap generation, atomic resolver swap, LRU와
Import/Refresh/Reconnect 이중 lifecycle을 만들지 않는다. 기존 측정에서 병목이
Source bitmap이 아닌 최종 합성 경로였다는 결과와도 일치한다.

### 6.5 Group Transform Draft surface 재사용

Group의 Position/Scale/Rotation/Anchor/Opacity는 Group surface 안의 자식
pixel을 바꾸지 않고 이미 합성된 surface를 부모 Canvas에 배치하는 외부
Transform이다.

이전 구현은 Draft가 하나라도 있으면 Composition Cache 전체를 우회하고
Composition Transform 변화도 root full draw 조건으로 처리했다. 그 결과
Group PointerMove마다 모든 자식을 offscreen surface에 다시 합성했다.

현재 계약:

- Cache hit는 Group node 전체 reference가 아니라 `targetCompId`, logical
  size와 자식 node reference 순서로 판단한다.
- Group 외부 Transform만 바뀌면 기존 surface를 재사용한다.
- 자식 visual/reference가 바뀌면 해당 Group surface만 무효화한다.
- Composition Transform 변화도 이전/다음 Bounds union의 Dirty Region으로
  처리한다.
- Dirty Region 밖의 Composition surface는 frame active 상태로 보존한다.

정적 회귀 fixture는 Group Position Draft에서 child draw가 증가하지 않고
`dirtyPartial`과 Composition Cache hit가 발생하는지, 자식 visual 변경에서는
cache miss와 재합성이 발생하는지 함께 검증한다.

### 6.5 Renderer Mode 소유권

`full-render` / `fast-render` 전환과 UI binding은 정상이다.

다만 현재 mode는 Editor Composition Root의 local Runtime state다. 문서
43의 Playback Runtime 소유 설명과 현재 Timeline Runtime 철학은
일치하지 않는다. 저장/History 대상이 아니라는 핵심 계약은 유지된다.

### 6.6 mode 전환과 cache 수명

full-render로 전환해도 fast Composition Cache는 즉시 비우지 않는다.
정확성 문제는 없고 fast 복귀 시 재사용 가능성이 있다. 다만 큰
Composition surface를 장시간 보존할 수 있으므로 memory policy로
명시해야 한다.

## 7. Direct Selection과 선택 스크린톤 영향

Direct Selection 후보는 painter 변환 전의 Evaluated Scene을 읽는다.
현재 canonical order는 위→아래이고 hit test는 앞에서부터 검사하므로
화면 최상단 Layer 선택과 일치한다.

선택 판정과 강조는 같은 Source Alpha Mask를 사용한다. 기존 Blur Glow는
제거하고 Alpha 바깥 거리를 3단계 밀도로 표현한 점 screen tone을 사용한다. Group 외부
Transform에서는 Mask/tile을 재사용하고 Projection만 갱신한다. child
visual이나 내부 Transform이 바뀔 때만 Alpha identity가 무효화된다.

## 8. Verification과 측정 공백

현재 40개 verification은 기능과 개별 cache helper를 검증하지만 다음
통합 회귀를 잡지 못한다.

- painter 변환 전후 Composition strict identity
- 연속 painter scene의 Dirty Region mode
- painter 경계를 통과한 Composition Cache hit/miss
- root/중첩 Group 중 한 branch만 변경했을 때 sibling cache reuse
- UI order, direct selection order와 painter order의 하나의 통합 계약

이유:

- `verifyLayerDocumentCanvasMode.ts`는 뒤집힌 배열 값만 확인한다.
- `verifyLayerDocumentPreviewRuntimeCache.ts`는 painter 변환을 거치지 않고
  Dirty Region과 Composition Cache를 각각 검증한다.

문서 44의 Performance/Stress script는 현재 verification suite에 없고,
문서 50의 CDP manifest는 이전 identity를 사용한다.

예:

- legacy Composition ID
- legacy TimelineItem ID
- legacy source/layer ID

따라서 현재 LayerDocument ID, Properties/Timeline UI와 radial handle
계약에 맞게 profiling fixture를 다시 작성해야 한다.

## 9. 복구 방향

### P0 — 순서와 cache identity 복구

가장 먼저 현재 painter reverse 회귀를 제거한다.

권장 구조:

```text
Project / Timeline / Evaluated Scene / Renderer output
  → canonical UI order(top→bottom) 유지

Canvas2D painter traversal
  → 배열을 복제하지 않고 뒤에서 앞으로 순회
```

이 방식은 Scene/Frame/Composition node를 clone하지 않는다.

- Preview Scene identity 유지
- Dirty Region identity 유지
- Composition Cache identity 유지
- Direct Selection은 canonical order를 그대로 사용
- painter만 back→front

이 수정은 현재 동결된 Render adapter 경계를 건드린다. 구현하려면
별도 Render Sprint에서 `00_rule.md`의 동결을 명시적으로 해제하거나
이번 순서 계약에 한정된 예외를 먼저 승인해야 한다.

대안으로 Canvas에 persistent WeakMap projector를 둘 수 있다. 기존
Composition reference가 같으면 reversed clone을 재사용하는 방식이다.
Render 동결을 지킬 수 있지만 다음 단점이 있다.

- canonical scene과 painter scene 두 구조를 계속 유지
- projector/cache lifecycle 추가
- Render Sprint에서 다시 제거할 가능성
- 불필요한 구조 복잡성

따라서 최종 구조로는 권장하지 않는다.

### P1 — Metrics와 새 Baseline

최적화 구현 전에 현재 제품 계측을 복구한다.

필수 metrics:

- runtime/evaluation 호출
- full/fast renderer 호출
- Preview Scene generation/reuse
- painter traversal/clone
- Dirty full/skip/partial
- Composition Cache hit/miss
- Surface create/reuse/dispose
- drawImage/drawImage skipped
- Canvas draw time
- Project update/History commit

고정 fixture:

- `drag_test.psd`
- `layer_test.psd`
- flat/nested
- Position/WH
- fast/full
- Glow OFF/ON
- playback/seek/draft/commit

Gate는 기능 통과뿐 아니라 frame p95 회귀 없음까지 포함한다.

### P1 — static visual result identity

static PSD의 visual result key에서 불필요한 frame invalidation을 제거한다.

먼저 Layer Type별 visual invalidation 표를 확정해야 한다.

| 변화 | static PSD | timed media/effect |
|---|---|---|
| frame만 변경, 표시 결과 동일 | reuse | 결과에 따라 invalidate |
| Transform/Opacity | node update | node update |
| source revision/fingerprint | invalidate | invalidate |
| child visual 변화 | Composition invalidate | Composition invalidate |
| Draft identity | 선택 branch만 update | 선택 branch만 update |

### P2 — Preview Quality/Memory 복구

완료: backing-scale-only 정책을 유지하고 연결되지 않은 source bitmap cache
정책과 허위 memory UI를 제거했다. 원본 Source lifecycle은 기존
LayerDocument Source Runtime Cache 한 곳에서만 관리한다.

### P2 — Draft incremental 경계 재평가

Preview Pipeline-only Draft를 바로 복원하지 않는다.

문서 50에서 React Draft Boundary와 Displayed Pixel Backing 후보가
frame p95 회귀로 rollback됐다. 새 LayerDocument profiling에서
contributor를 다시 확정한 뒤 진행한다.

검토 후보:

- selected branch만 runtime evaluation
- stable sibling input identity
- Preview Scene structural sharing
- Draft-safe child Composition surface
- bounded dirty bounds

### P3 — 문서 정합성

42/43/44/49/50은 중요한 역사 문서지만 현재 제품 계약과 섞여 있다.

- 과거 완료 상태는 삭제하지 않는다.
- 문서 상단에 현재 canonical 문서 56/58/59로의 superseded 안내를 추가한다.
- 현재 구현 설명은 20과 59를 기준으로 한다.
- 새 측정이 완료되면 새 영구 Render 문서를 작성한다.

## 10. 권장 Sprint 구성

### Task 1 — Current Baseline & Ordering Contract

- current LayerDocument fixture로 기능/metrics baseline 작성
- canonical UI order와 painter order 방향 고정
- painter identity/cache 회귀 test 추가

Gate:

- 같은 Composition 입력에서 strict identity 유지 여부를 수치로 확인
- 현재 frame p95와 cache hit/miss 확보

### Task 2 — Zero-clone Painter Traversal

- Preview/Full Canvas2D traversal만 back→front 순회
- Canvas controller의 recursive clone 제거
- Direct Selection canonical order 유지

Gate:

- PSD Tree/Timeline 순서 일치
- full/fast pixel 결과 일치
- Dirty skip/partial 복구
- Composition Cache hit 복구

### Task 3 — Metrics Wiring

- renderer/evaluation/dirty/node/cache/draw/frame 계측을 제품 경로에 연결
- frame reset과 baseline 수명 정의

Gate:

- 고정 interaction 1회에서 Project update/History commit 각 1
- 동일 frame 반복에서 renderer/draw 불필요 증가 없음

### Task 4 — Visual Result Identity

- static PSD와 timed source의 invalidation 분리
- frame 변화에서 실제 visual 결과가 같은 node reuse

Gate:

- 400-frame static fixture에서 node/cache reuse 개선
- animation/effect/timed source 정확성 유지

### Task 5 — Preview Quality Policy

- bitmap-cache 복구 또는 backing-scale-only 정책 중 하나 확정
- UI memory 표시와 실제 Runtime 일치

Gate:

- `0 B` 허위 표시 제거
- quality별 backing/source 사용과 memory lifecycle 검증

### Task 6 — Production Performance QA

- 새 LayerDocument CDP fixture
- flat/nested, Position/WH, fast/full, Glow OFF/ON
- Before/After median, MAD와 frame p95 비교

Gate:

- 기능/Undo/pixel correctness PASS
- frame p95 회귀 없음
- cache/surface resource leak 없음

## 11. 하지 말아야 할 것

- Full Render 우회
- Dirty Region 제거
- 매 frame 강제 refresh
- scene 전체 JSON/fingerprint 비교
- Project에 Render/Cache state 저장
- Timeline과 Canvas에 별도 order 원본 생성
- 기능 QA만으로 성능 회복 선언
- 과거 CDP 수치를 현재 제품 수치처럼 재사용
- 원인 측정 없이 Draft pipeline 대규모 재도입

## 12. 500줄 이상 리팩토링 후보

이번 조사에서는 리팩토링하지 않는다.

- `src/engines/project/import/layerDocumentPsdImportAdapter.ts`: 535줄
- `src/engines/playback-render/renderers/fastPreviewRenderer.ts`: 528줄
- `src/engines/canvas/adapters/useLayerDocumentCanvasInteractionAdapter.ts`: 520줄

## 13. 최종 판단

Render 최적화를 처음부터 전부 다시 만들 필요는 없다.

기존 cache와 renderer 구조를 유지하면서 다음 순서로 복구하는 것이
가장 안전하다.

```text
Painter identity 회귀 제거
  → Metrics 복구
  → 현재 Baseline 측정
  → static visual identity
  → Preview quality 정책
  → 실제 production 성능 QA
```

첫 번째 Task 전에는 Render 동결 범위를 명시적으로 다시 승인해야 한다.
현재 구조에서 Canvas-only 우회 cache를 추가하는 것보다 Render draw
traversal의 순서 계약을 한 번 정확히 고치는 편이 장기적으로 단순하다.

## 14. 쉬운 설명

현재는 빠르게 그리기 위한 창고와 재사용 장치가 남아 있다. 하지만
Canvas에 보내기 직전에 그림 묶음을 매번 새 포장으로 바꾸고 있어서,
시스템은 내용이 똑같아도 새 물건으로 오해한다.

그 결과:

- 그대로 쓸 수 있는 Group도 다시 합성할 수 있고
- 작은 변화인데 넓은 영역을 다시 그릴 수 있고
- 성능 측정 장치 일부도 실제 경로를 보지 못하고 있다.

먼저 포장을 새로 만들지 않고 그리는 순서만 반대로 읽도록 고친다.
그다음 측정 장치를 현재 LayerDocument 구조에 다시 연결하고, 실제 수치를
보고 나머지 최적화를 진행하는 것이 가장 안전하다.
