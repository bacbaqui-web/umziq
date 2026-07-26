# Render Runtime Boundary & Terminology Cleanup Sprint

## 상태

- 계획 완료
- 제품 구현 미시작
- Browser QA 미실행

## 기준

- `docs/00_rule.md`
- `docs/architecture/10_project_architecture.md`
- `docs/architecture/11_render_architecture.md`
- `docs/architecture/12_timeline_playback_architecture.md`
- `docs/architecture/14_canvas_overlay_architecture.md`
- `docs/20_src_map.md`

## 목표

현재 제품 Render 경로는 유지하면서 dead path, 과거 Playback 잔재, 불필요한
public export, 단일 Canvas mode 명칭, Quality와 identity 용어, Metrics와
현재 문서를 실제 책임에 맞게 정리한다.

Render Architecture를 다시 설계하거나 제품 출력과 성능을 변경하는 Sprint가
아니다.

## 동결 경계

- Preview/Accurate와 동일 `EvaluatedScene` 계약
- Project schema, History, Timeline Runtime, Draft와 Source lifecycle
- Preview Dirty Region, Composition/Surface/Source Cache와 painter order
- 작품 Canvas와 Editor Overlay 분리
- Accurate 전체 Frame direct callable과 미래 Export 경계
- 사용자 결과, Cache key 값과 Source sampling 결과
- 새 Engine, Store, Event Bus, Renderer와 Export Runtime 추가 금지
- 500줄 이상 파일의 대규모 분해 금지

## 현재 Baseline

Task 1에서 동일 verification으로 다시 고정한다.

| 지표 | 현재 값 |
|---|---:|
| Preview Renderer | 3 |
| Accurate Renderer | 1 |
| Dirty full / skip / partial | 1 / 1 / 1 |
| Composition Cache hit / miss | 1 / 3 |
| Surface create / reuse | 2 / 1 |
| Painter traversal / clone | 7 / 0 |
| drawImage / skipped | 7 / 4 |
| Project update / History commit | 1 / 1 |

## 정리 대상 판정

| 대상 | 실제 caller | 제품 | Verification | Public | 판단 | 위험 |
|---|---|---:|---:|---:|---|---:|
| `usePreviewUpdatePipeline` | 없음 | 아니오 | 아니오 | 아니오 | 삭제 | 낮음 |
| `previewDraftBaseSceneHelpers` | 위 Pipeline만 | 아니오 | 아니오 | 아니오 | 함께 삭제 | 낮음 |
| `DirtyStateResource` 제품 인스턴스 | 소비자 없음 | 아니오 | 예 | 예 | 제품 생성 제거, test 계약 재평가 | 중간 |
| node cache / dirty snapshot | 미사용 Pipeline과 scripts | 아니오 | 예 | 예 | 실제 Dirty 검증으로 대체 후 제거 | 중간 |
| `updatePreviewSceneFromPlaybackFrame*` | 없음 | 아니오 | 아니오 | 예 | 삭제 | 낮음 |
| `updatePreviewSceneNodeTransform*` | 미사용 Pipeline과 한 verification | 아니오 | 예 | 예 | verification 전환 후 삭제 | 중간 |
| `collectRenderFrameSourceIds` | 없음 | 아니오 | 아니오 | 예 | 삭제 | 낮음 |
| 과거 Playback controller 3개 | 없음 | 아니오 | 아니오 | 아니오 | 삭제 | 낮음 |
| Playback frame/range helper | Timeline Runtime/UI | 예 | 예 | 예 | Timeline 책임으로 이동 | 중간 |
| `LayerDocumentCanvasMode*` | Canvas 제품 경로 | 예 | 예 | 예 | 단일 read 계약으로 rename | 중간 |
| Preview/Source `quality` | Canvas·Evaluation·Source | 예 | 예 | 계약 일부 | 의미별 이름·타입 분리 | 높음 |
| Render `itemId` compatibility | Renderer와 fixture | 예 | 예 | 모델 계약 | `layerDocumentId`로 수렴 | 높음 |
| `renderItemId`, `drawableId` | Source runtime visual | 예 | 예 | 모델 계약 | Source runtime 의미로 rename 검토 | 높음 |
| `targetCompId` | Group node/cache | 예 | 예 | 모델 계약 | 중복 여부 확인 후 제거/명확화 | 높음 |
| `localFrameByItemId` | 평가 결과와 fixture | 예 | 예 | 모델 계약 | `localFrameByLayerDocumentId` | 중간 |
| Preview의 `playback*` Metrics | Preview Renderer | 예 | 예 | counter 계약 | `preview*`로 rename | 중간 |
| dead Preview Metrics | 미사용 Pipeline | 아니오 | 일부 | 예 | 관련 dead path와 제거 | 낮음 |
| Accurate Renderer | verification/direct API | UI 미연결 | 예 | 예 | 보존 | 높음 |
| Canvas Accurate wrapper | 한 verification | 아니오 | 예 | 예 | direct Accurate 호출로 대체 후 삭제 | 낮음 |
| Accurate Canvas2D adapter/surface | 현재 caller 없음 | 아니오 | 경계 검증 | 예 | 미래 Export 경계로 보존·명칭 명확화 | 높음 |

## 이름 변경 목표

| 기존 | 제안 | 이유 |
|---|---|---|
| `LayerDocumentCanvasModeInput` | `LayerDocumentCanvasReadInput` | 선택 가능한 mode가 없음 |
| `LayerDocumentCanvasModeReadModel` | `LayerDocumentCanvasReadModel` | 실제 책임은 Canvas read projection |
| `LayerDocumentCanvasModeReadResult` | `LayerDocumentCanvasReadResult` | 단일 read 결과 |
| `buildLayerDocumentCanvasModeReadModel` | `buildLayerDocumentCanvasReadModel` | mode dispatch가 아님 |
| `layerDocumentCanvasModeModel.ts` | `layerDocumentCanvasReadModel.ts` | 파일 책임 반영 |
| `layerDocumentCanvasModeAdapter.ts` | `layerDocumentCanvasReadAdapter.ts` | 파일 책임 반영 |
| Canvas `quality` | `previewQuality` | Canvas backing 품질 |
| Evaluation/Source `quality` | `sourceSamplingQuality` | timed Source sampling 계약 |
| `PlaybackPreviewUpdateStats` | `PreviewRetainedSceneStats` | Playback 전용이 아님 |
| `build...ForPlayback` | `buildRetainedPreviewScene` | previous-scene 재사용 책임 |
| `playbackDirtyNode` | `previewDirtyNode` | Preview retained node 지표 |
| `playbackCleanNode` | `previewCleanNode` | Preview retained node 지표 |
| `playbackNodeUpdated` | `previewNodeUpdated` | Preview Renderer 지표 |
| `playbackNodeReused` | `previewNodeReused` | Preview Renderer 지표 |
| `playbackCompositionReused` | `previewCompositionReused` | Preview Renderer 지표 |
| `playbackFrameUpdateTime` | `previewSceneUpdateTime` | Preview Scene 생성 시간 |
| `localFrameByItemId` | `localFrameByLayerDocumentId` | 실제 key와 일치 |
| Render node `itemId` | 제거하고 `layerDocumentId` 사용 | 같은 값을 중복 보관 |
| `renderItemId` | `sourceRuntimeId` 후보 | 현재 값은 `runtime:{sourceId}` |
| `drawableId` | `sourceDrawableId` 후보 | Source 내부 drawable임을 명시 |
| `targetCompId` | `targetGroupLayerDocumentId` 또는 제거 | 현재 Group `layerDocumentId`와 동일 |
| `renderFrameToCanvas` | `renderAccurateFrameToCanvas` | Preview Canvas draw와 구분 |
| `createReusableRenderSurfaceFactory` | `createReusableAccurateSurfaceFactory` | Accurate 전용 수명 명시 |

`sourceId`와 `layerDocumentId`는 변경하지 않는다. `renderItemId`,
`drawableId`, `targetCompId`는 Task 8에서 생성자와 소비자의 의미가 표와
일치할 때만 변경한다.

## Task 1 — Caller와 Baseline 고정

### 목적

삭제와 rename 전 실제 제품·verification·미래 경계를 고정한다.

### 작업

- 대상 symbol별 import/caller/public barrel 목록을 기록한다.
- 기존 Render observation과 Preview/Accurate 계약을 실행한다.
- Cache key, painter order와 Metrics Before 값을 저장한다.
- 제품 경로와 verification-only 경로의 구분을 verification에 명시한다.

### 변경하지 않을 경계

- 제품 코드와 Architecture
- fixture의 의미와 기대 출력

### 검증

- `verifyLayerDocumentRenderObservationBaseline.ts`
- `verifyLayerDocumentPreviewRuntimeCache.ts`
- `verifyPreviewAccurateRendererContract.ts`
- `verifyPlaybackHelpers.ts`
- `verifyRuntimeMetrics.ts`
- `git diff --check`

### 성능 기준

현재 Baseline 표와 일치해야 한다.

### Rollback

기준 fixture가 현재 main 제품 경로를 재현하지 못하면 계획을 멈추고
Baseline부터 수정한다.

### Gate

- PASS/FAIL
- caller와 Baseline 고정
- Task 2 진행 여부

## Task 2 — Dead Preview 경로 제거

### 목적

현재 제품 Dirty Region과 혼동되는 미사용 Preview update 체계를 제거한다.

### 작업

- `usePreviewUpdatePipeline.ts`와 전용 Draft base helper 삭제
- `useCanvasPreviewRuntime()`의 소비되지 않는 `dirty` 생성/반환 제거
- `collectRenderFrameSourceIds()` 삭제
- `updatePreviewSceneFromPlaybackFrame*` 삭제
- `PreviewSceneTransformPatch`는 active Draft 계약 위치로 이동
- `updatePreviewSceneNodeTransform*`, Dirty/Node Cache verification은 실제
  Preview Renderer + Draw State 계약 검증으로 대체한 뒤 제거
- 관련 dead model, helper, verification과 export 정리

### 변경하지 않을 경계

- `PreviewCanvasDrawState`와 Dirty Region draw plan
- Previous Preview Scene과 retained node reuse
- Composition/Surface Cache

### 선행 조건

- Task 1 PASS
- dead symbol의 외부 caller 0건

### 검증

- Preview Runtime Cache
- Render observation Baseline
- Preview/Accurate contract
- TypeScript build, 변경 파일 ESLint, `git diff --check`

### 성능 기준

Task 1의 Dirty, Cache, painter와 drawImage 수치가 동일해야 한다.

### Rollback

제품 Draft, dirty partial/skip 또는 Cache 수치가 달라지면 dead 판정을
취소하고 해당 경로를 복원한다.

### Gate

- dead path/export 0건
- 실제 Preview 최적화 Baseline 유지
- Task 3 진행 여부

## Task 3 — Public Boundary 정리

### 목적

제품 API, verification seam, 미래 Accurate 경계와 내부 구현을 구분한다.

### 작업

- Canvas/Render main barrel에서 내부 helper와 verification-only export 제거
- 필요한 test seam은 `testing` entry 또는 내부 파일 직접 import로 격리
- 제품 Panel과 Editor Root가 사용하는 port/type만 Canvas main barrel에 유지
- Accurate Renderer와 전체 Frame draw 경계는 main Render API로 보존
- Source Runtime Resource port와 Frame Evaluation API 보존

### 변경하지 않을 경계

- 함수 동작, type shape와 runtime lifecycle
- Accurate direct callable

### 선행 조건

- Task 2 PASS

### 검증

- Engine import boundary verification
- Consumer port verification
- 전체 TypeScript build와 lint
- `rg`로 삭제된 export의 외부 import 0건 확인

### 성능 기준

Task 1 Baseline과 동일해야 한다.

### Rollback

제품 코드가 내부 파일을 우회 import해야 하거나 순환 import가 생기면 barrel
축소 범위를 되돌린다.

### Gate

- public/testing/internal/future 경계 분류 완료
- 제품 import boundary PASS
- Task 4 진행 여부

## Task 4 — Canvas 단일 Read 명칭

### 목적

선택 가능한 mode처럼 보이는 Canvas 계약을 실제 read projection 이름으로
바꾼다.

### 작업

- 이름 변경표의 Canvas Mode 항목 적용
- `mode: "layer-document"` 필드와 불필요한 분기 제거
- 제품, Feature와 verification import 갱신

### 변경하지 않을 경계

- Canvas read model 필드와 값
- Selection, Overlay, Renderer와 command 동작

### 선행 조건

- Task 3 PASS

### 검증

- Canvas Mode/Consumer/Properties integration verification
- 변경 파일 ESLint, build, `git diff --check`

### 성능 기준

Task 1 Baseline과 동일해야 한다.

### Rollback

read projection shape 또는 Canvas 제품 결과가 바뀌면 rename 전체를 되돌린다.

### Gate

- `LayerDocumentCanvasMode*`와 단일 mode field 0건
- Task 5 진행 여부

## Task 5 — Playback 소유권 정리

### 목적

Timeline Runtime과 중복되는 과거 controller를 제거하고 순수 Playback
계산을 Timeline 책임으로 옮긴다.

### 작업

- 미사용 Playback React controller 3개 삭제
- controller 전용 state/read/command type 삭제
- `PlaybackRange`와 frame/range helper를 Timeline module로 이동
- Timeline UI용 time formatting을 Timeline 공개 경계로 이동
- Timeline Runtime과 Editor Root import 갱신

### 변경하지 않을 경계

- Timeline Runtime 구현과 scheduler
- current frame/range/transport 값과 end-frame 정책
- Project와 History

### 선행 조건

- controller caller 0건
- Task 4 PASS

### 검증

- Playback helper
- Timeline Runtime/UI/Editor Root verification
- Undo 후 current frame 유지 verification
- lint, build, `git diff --check`

### 성능 기준

재생 frame 진행과 Preview Baseline이 동일해야 한다.

### Rollback

frame clamp, range exclusive 정책, timer lifecycle 또는 Root wiring이 달라지면
helper 이동을 되돌린다.

### Gate

- Playback Runtime의 Timeline 단일 소유권 유지
- 과거 controller/type 0건
- Task 6 진행 여부

## Task 6 — Render 폴더 책임 정리

### 목적

Playback 제거 후 남은 Frame Evaluation/Renderer 영역이 Engine으로 오해되지
않도록 실제 책임 경계를 명확히 한다.

### 작업

- `src/engines/playback-render`를 `src/render`로 기계적으로 이동
- `@/engines/playback-render`를 `@/render`로 변경
- 기존 adapters/helpers/models/renderers 하위 구조는 유지
- 500줄 이상 파일 분해와 내부 로직 변경 금지
- Source Runtime Resource Cache는 Evaluation 입력 경계로 현 위치 역할을
  유지하고 lifecycle을 변경하지 않음

### 변경하지 않을 경계

- 모든 함수/type 이름과 동작
- Source Runtime 생성·폐기 위치
- Renderer와 Canvas painter 책임

### 선행 조건

- Task 5로 Playback 파일 제거 완료
- 순환 import 사전 확인

### 검증

- `@/engines/playback-render` active import 0건
- Engine boundary verification
- 전체 test, lint, build, `git diff --check`

### 성능 기준

Task 1 Baseline과 완전 동일해야 한다.

### Rollback

alias, 순환 import, verification loader 또는 build 경계가 복잡해지면 폴더
이동만 되돌리고 이름/export 정리 상태로 유지한다.

### Gate

- 폴더명이 실제 책임과 일치
- import/성능 회귀 0건
- Task 7 진행 여부

## Task 7 — Quality 계약 분리

### 목적

Canvas backing 품질과 timed Source sampling 품질을 이름과 type에서 분리한다.

### 작업

- Canvas Runtime/View/Command의 값은 `previewQuality`
- Frame Evaluation과 Source resolution key 입력은 `sourceSamplingQuality`
- 두 값 사이의 기존 mapping을 명시적 adapter 한 곳에 둔다.
- 기존 string 값과 Source resource cache key 결과는 유지한다.
- PSD static key가 quality 비의존인 계약을 유지한다.

### 변경하지 않을 경계

- Preview backing scale
- timed Source key와 sampling 결과
- Source preparation/import/reconnect lifecycle

### 선행 조건

- Task 6 PASS
- 기존 quality 전달 경로와 key fixture 고정

### 검증

- Preview backing scale lifecycle
- Source runtime cache/import/open/reconnect
- LayerDocument Runtime Cache
- lint, build, `git diff --check`

### 성능 기준

Source Cache hit/miss와 Preview Baseline이 동일해야 한다.

### Rollback

기존 cache key 문자열, PSD resource identity 또는 Preview pixel scale이 하나라도
달라지면 type/name 분리를 되돌린다.

### Gate

- 의미가 다른 `quality` 무표시 전달 0건
- Cache key와 출력 변화 0건
- Task 8 진행 여부

## Task 8 — Render Identity 정리

### 목적

Project identity와 Source 내부 runtime identity를 구분하고 compatibility
alias를 제거한다.

### 작업

- Render active model의 `layerDocumentId`를 필수 canonical identity로 확정
- 같은 값인 Render `itemId`와 `identityKind` fallback 제거
- `localFrameByItemId`를 `localFrameByLayerDocumentId`로 변경
- `renderItemId` 생성값과 소비자가 Source runtime identity임을 다시 검증
- `drawableId`가 Source 내부 drawable identity임을 유지
- `targetCompId`가 Group `layerDocumentId`와 항상 같으면 중복 제거, 다를 수
  있으면 `targetGroupLayerDocumentId`로 명확화
- Render 범위 밖의 offline migration/legacy `TimelineItem.itemId`는 변경하지 않음

### 변경하지 않을 경계

- `sourceId`, `layerDocumentId` 값
- Source resource/layer result cache key 값
- Group painter order와 Direct Selection order
- 저장 schema

### 선행 조건

- Task 7 PASS
- 각 identity 생성자/소비자 verification 고정

### 검증

- Preview/Accurate contract
- Preview Runtime Cache
- Group Transform Composition Cache
- Canvas/Timeline/Properties consumer ports
- Source open/reconnect
- Render observation Baseline
- lint, build, `git diff --check`

### 성능 기준

Painter, Dirty, Cache, Surface와 drawImage Baseline이 동일해야 한다.

### Rollback

Source visual resolve, duplicate Layer 독립성, Group cache 또는 Selection
identity가 달라지면 해당 identity rename/removal만 독립 rollback한다.

### Gate

- Project/Source/Group identity 의미가 하나씩만 존재
- compatibility alias 제거 또는 보존 근거 기록
- Task 9 진행 여부

## Task 9 — Metrics와 문서 정합성

### 목적

관찰 용어와 현재 Source Map을 최종 제품 경로에 맞춘다.

### 작업

- active `playback*` Preview counter를 이름 변경표대로 변경
- dead Preview Pipeline counter 제거
- `painterClone`처럼 0을 보장하는 verification sentinel은 보존
- Source Runtime Cache metrics는 새 관찰 Runtime을 만들지 않고 현재
  미연결 사실과 소유 경계를 문서화
- `docs/20_src_map.md`의 Full/Fast, fast composition과 오래된 mode 표현 제거
- current/verification/future/dead 상태를 Source Map에 표시
- canonical Architecture는 실제 차이가 있을 때만 최소 갱신
- completed 문서는 역사 기록으로 유지

### 변경하지 않을 경계

- Metrics가 제품 결과에 영향 주지 않는 계약
- 완료 문서의 당시 용어
- Browser QA

### 선행 조건

- Task 8 PASS

### 검증

- Runtime Metrics verification
- Render observation의 rename 전후 수치 mapping 비교
- 전체 `npm test`, `npm run lint`, `npm run build`
- `git diff --check`
- 오래된 active 명칭과 dead export `rg` 0건

### 성능 기준

counter 이름만 바뀌며 모든 수치가 Task 1과 같아야 한다.

### Rollback

측정 누락 또는 Baseline 비교 불능이 생기면 counter rename만 되돌린다.

### Gate

- static verification PASS
- 제품 동작·성능 계약 변화 0건
- 사용자 승인 후 Browser QA 진행 가능

## Public Export 최종 목표

```text
@/render
├─ Frame Evaluation API / EvaluatedScene
├─ Preview Renderer / PreviewScene
├─ Accurate Renderer / RenderFrame
├─ Preview Canvas draw 계약
├─ Accurate full-frame Canvas draw 계약
├─ Source Runtime Resource port/cache
├─ active Draft/Evaluation 계약
└─ Runtime metric record port

@/engines/canvas
├─ Canvas Panel Engine entry
├─ Editor/Feature가 소비하는 ViewProps와 command/read port
├─ Preview Quality / FPS public view 계약
└─ Canvas interaction/overlay public view types

@/engines/canvas/testing
└─ 제품 public API가 아닌 Cache/Metrics verification seam만 필요한 경우

@/engines/timeline
├─ Timeline Panel Engine entry
├─ Timeline Runtime
├─ frame/range 순수 helper
└─ Timeline time formatting
```

내부 painter helper, cache key helper, dead Dirty/Node Cache와 verification-only
fixture는 제품 main barrel에서 export하지 않는다.

## 폴더 책임 최종 목표

```text
src/
├─ render/
│  ├─ adapters/   Frame input, Source resource, Canvas2D boundary
│  ├─ helpers/    Evaluation/cache-key/draw-plan 순수 계산
│  ├─ models/     EvaluatedScene, PreviewScene, RenderFrame, public contracts
│  └─ renderers/  Preview / Accurate
├─ engines/
│  ├─ canvas/     Canvas Panel Runtime, interaction, overlay, preview cache
│  └─ timeline/   Timeline Panel Runtime, playback clock/frame/range
└─ editor/         Owner/Runtime/Panel wiring
```

## Sprint 완료 조건

- 현재 제품 Preview 경로와 Accurate direct boundary 유지
- dead Preview/Playback 코드와 dead public export 제거
- Canvas 단일 read 계약 명칭 적용
- Playback helper와 Runtime의 Timeline 책임 일치
- Render가 Panel Engine으로 오해되지 않는 폴더 경계
- Preview/Source Quality 의미 분리, 기존 key/출력 유지
- Render identity의 canonical 의미 확정
- active Metrics와 문서가 현재 명칭과 일치
- Project/History/Draft/Source lifecycle 변화 0건
- Render Baseline 수치 변화 0건
- 전체 정적 검증 PASS
- Browser QA는 사용자 승인 전 미실행

## 감독관 판단

- 한 Sprint로 실행 가능하다.
- 단, 9개 Task를 순서대로 진행하고 각 Task가 독립 rollback 가능해야 한다.
- 가장 위험한 순서는 Quality와 Identity이며 반드시 폴더/명칭 정리 뒤에 한다.
- 폴더 이동은 Playback 제거 후 `playback-render`라는 이름의 모순을 없애므로
  이득이 있다. 내부 파일 분해는 필요하지 않다.
- identity 정리는 저장 schema를 건드리지 않는 Render Runtime 범위로 이번
  Sprint에 포함한다.
