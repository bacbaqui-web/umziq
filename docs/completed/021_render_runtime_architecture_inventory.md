# Render Runtime Architecture Inventory

> 문서 번호: 60
> 상태: 현재 코드 조사 완료 / 제품 수정 미실행
> 기준일: 2026-07-26
> 목적: 현재 Render Runtime의 실제 종류, 소유권, 수명과 중복 책임을
> 한 문서에서 설명하고 후속 정리의 안전한 경계를 제안한다.
> 현재 canonical Render 설계는
> `docs/architecture/11_render_architecture.md`를 따른다.

## 1. 결론

현재 제품에 실제 Renderer는 두 개뿐이다.

- `full-render`: Evaluated Scene을 `RenderFrame`으로 바꾼 뒤 전체 Canvas를
  다시 그린다.
- `fast-render`: Evaluated Scene을 reference 재사용 가능한
  `PreviewScene`으로 바꾸고 Dirty Region과 Cache를 사용해 필요한 부분만
  그린다.

복잡해 보이는 주된 이유는 Renderer의 수가 아니라 다음 책임이
`src/engines/playback-render`와 Canvas Engine 양쪽에 섞여 있기 때문이다.

- LayerDocument frame 평가
- Source Runtime resource
- Full/Fast Scene 변환
- Canvas2D painter
- Dirty Region
- Composition/Surface Cache 계약
- Timeline으로 이미 이전된 Playback의 잔여 코드
- 현재 제품에서 호출하지 않는 과거 Preview Dirty/Node Runtime

기존 출력과 최적화는 정상 경로에 연결되어 있다. 지금 즉시 Render를 다시
만들 필요는 없다. 먼저 실제 사용 경로와 비활성 경로를 분리하고, 그 다음
소유권과 이름을 정리하는 편이 안전하다.

## 2. 현재 제품의 실제 흐름

```text
LayerDocumentProject
  + active Group / Selection
  + Timeline Runtime currentFrame
  + shared Transform Draft
  + Source resolution/resource
          │
          ▼
buildLayerDocumentRuntimeReadModel()
  ├─ LayerDocumentRuntimeInput[]
  ├─ LayerDocumentRuntimeTarget[]
  └─ EvaluatedScene
          │
          ├──────── full-render ────────┐
          │                             ▼
          │                    Accurate Renderer
          │                             ▼
          │                       RenderFrame
          │                             ▼
          │                    Full Canvas2D painter
          │
          └──────── fast-render ────────┐
                                        ▼
                               Fast Preview Renderer
                                        ▼
                                   PreviewScene
                                        ▼
                    Dirty Region + Composition Cache
                         + Surface Pool + retained state
                                        ▼
                               Fast Canvas2D painter
```

Overlay, Gizmo, Motion Path, Direct Selection과 선택 Screen Tone은 같은
`LayerDocumentRuntimeReadModel`을 소비하지만 Canvas2D Render 결과에는
포함되지 않는 Editor-only Canvas Runtime이다.

## 3. Scene 세 단계

| 단계 | 역할 | 수명 | 저장 여부 |
|---|---|---|---|
| `LayerDocumentRuntimeReadModel` | Project, frame, Draft, Source 상태를 한 번 평가하고 Canvas/Properties용 input과 target을 제공 | 현재 React 계산 | 저장 안 함 |
| `EvaluatedScene` | 현재 frame의 계층, Transform, opacity, visual identity를 Renderer 공통 입력으로 제공 | 계산 결과 | 저장 안 함 |
| `RenderFrame` 또는 `PreviewScene` | Full/Fast painter가 소비할 출력 계약 | frame/interaction 동안 | 저장 안 함 |

### `LayerDocumentRuntimeReadModel`

구현:

- `adapters/layerDocumentRuntimeInputAdapter.ts`
- `helpers/layerDocumentRuntimeEvaluationHelpers.ts`
- `helpers/layerDocumentRuntimeTargetHelpers.ts`
- `helpers/layerDocumentRuntimeCacheKeyHelpers.ts`

이 단계가 실제 Animation/Modifier/Draft 평가 경계다. 이름은 Render
Runtime이지만 Canvas Overlay와 Properties도 동일한 평가 결과를 사용한다.
따라서 순수 Renderer보다 범위가 넓은 **Editor frame evaluation**에 가깝다.

현재 `readViewProps()`가 호출될 때마다 Project validation과 전체 Group
traversal을 수행한다. Draft publication도 대상 input을 찾기 위해 한 번
평가하고, publication 뒤 React render에서 다시 평가한다. 정확성 문제는
아니지만 후속 성능 조사에서 가장 먼저 계측할 계산 경계다.

### `EvaluatedScene`

Full/Fast가 공유하는 canonical frame scene이다. Project의 편집 원본이
아니며 Canvas/ImageBitmap도 소유하지 않는다.

현재 다음 identity가 함께 존재한다.

- `layerDocumentId`: 작업 Layer의 canonical identity
- `sourceId`: 공유 원본 identity
- `sourceResourceCacheKey`: 원본 pixel resource generation
- `layerResultCacheKey`: Transform/opacity/content를 포함한 visual result
- `drawableId`: PSD 내부 drawable identity
- `itemId`: 현재는 사실상 `layerDocumentId`의 중복 필드
- `renderItemId`: Project entity가 아니라 Source Runtime visual handle

마지막 두 이름은 이전 구조의 의미를 연상시켜 현재 LayerDocument 구조를
이해하기 어렵게 만든다.

### `RenderFrame`

`full-render` 전용 command tree다. Drawable source까지 해석한 뒤
Canvas2D painter가 매 frame 전체를 지우고 다시 그린다.

### `PreviewScene`

`fast-render` 전용 retained scene이다. 이전 Preview node와 값을 비교해
변하지 않은 node/composition reference를 재사용한다. 이후 Canvas draw
단계의 Dirty Region과 Composition Cache가 이 reference identity를
최적화 입력으로 사용한다.

## 4. Runtime 소유권 목록

### 4.1 Editor/Timeline이 소유하고 Render가 소비

| Runtime | 실제 소유 위치 | Render에서의 역할 |
|---|---|---|
| current frame/range/transport/clock | Timeline Runtime | 평가할 global frame 제공 |
| Transform Draft | `useLayerDocumentEditorRuntime` | commit 전 Transform/opacity 평가 |
| Selection/active Group | Project Owner session runtime | 평가 scope와 Overlay target 선택 |

이 세 Runtime은 Project/History에 저장되지 않는다.

### 4.2 Source Runtime

구현은
`playback-render/adapters/layerDocumentSourceRuntimeResourceCache.ts`에
있지만 인스턴스는 `useLayerDocumentEditorRuntime`이 생성하고 Project
Open/Import/Refresh/Reconnect/Delete lifecycle이 제어한다.

책임:

- `sourceId + sourceResourceCacheKey`로 decoded Canvas resource 조회
- batch preflight/register
- Source 교체 중 suspend/restore
- targeted invalidation
- dispose-once

이는 Renderer output cache가 아니라 외부 Source의 session resource다.
현재 파일 위치 때문에 Render가 Source lifecycle까지 소유하는 것처럼
보이지만 실제 소유권은 Editor project lifecycle 쪽에 더 가깝다.

### 4.3 Canvas Preview Runtime

`useCanvasPreviewRuntime()`이 Canvas Panel 수명 동안 다음을 소유한다.

| Runtime | 역할 | 실제 사용 |
|---|---|---|
| Preview Quality | root/offscreen backing scale 결정 | 사용 |
| Composition Cache | Group 합성 surface 재사용 | 사용 |
| Surface Cache | 크기/품질별 offscreen Canvas pool | 사용 |
| Runtime Metrics | draw/cache/frame counter | 사용 |
| Canvas FPS | 실제 paint 간격의 rolling FPS | 사용 |
| Dirty State Store | 과거 node dirty snapshot | 제품에서는 미사용 |

### 4.4 Canvas Render Controller Runtime

`useCanvasRenderController()` 내부 ref가 다음을 소유한다.

- Full Render용 `ReusableRenderSurfaceFactory`
- Fast Render용 `PreviewCanvasDrawState`
  - previous scene
  - previous node bounds
  - previous pixel scale

`useLayerDocumentCanvasComposition()`은 별도로 직전 `PreviewScene` ref를
소유한다. 하나는 Fast Renderer의 node identity 재사용용이고, 다른 하나는
Canvas dirty draw plan용이다. 둘은 목적이 다르지만 모두 “previous scene”
형태라 문서 없이 보면 중복 Runtime처럼 보인다.

### 4.5 Editor-only 선택 Runtime

Source Alpha/Hit Test/Screen Tone scratch는 Canvas 선택 표시 전용 cache다.

- RenderFrame/PreviewScene에 포함되지 않는다.
- Preview/Export pixel 결과를 변경하지 않는다.
- Source Alpha fingerprint가 같으면 scratch를 재사용한다.
- Transform Draft 중에는 Projection만 변경한다.

Render 성능에 영향을 줄 수는 있지만 Renderer 책임은 아니다.

## 5. 실제 Cache 계층

| 계층 | Key/identity | 재사용 대상 | 소유자 |
|---|---|---|---|
| Source Runtime Cache | source + resource generation | decoded original visual | Editor lifecycle |
| Visual Result Identity | LayerDocument + evaluated visual | Preview node equality 입력 | frame evaluation |
| Fast previous scene | Preview node id/value/reference | Preview node/composition | Canvas composition |
| Dirty draw state | previous scene/bounds/scale | skip/partial/full 판정 | Canvas render controller |
| Composition Cache | composition content + quality/scale/mode | 합성 완료 offscreen surface | Canvas preview runtime |
| Surface Cache | logical/pixel size + quality/scale | 작업용 offscreen Canvas | Canvas preview runtime |
| Full surface factory | traversal 순서의 surface slot | Full Render 작업 surface | Canvas render controller |
| Selection scratch | Source Alpha fingerprint | hit mask와 screen tone | Canvas selection adapter |

`Composition Cache`와 `Surface Cache`는 중복이 아니다.

- Composition Cache는 **완성된 Group 합성 결과**를 재사용한다.
- Surface Cache는 cache miss 때 사용할 **빈 작업 공간**을 재사용한다.

Full Render surface factory와 Fast Surface Cache도 현재 의미가 다르다.
Full은 전체 frame을 다시 합성하되 Canvas allocation만 재사용하고, Fast는
content identity에 따라 완성 결과까지 재사용한다.

## 6. 현재 사용하지 않는 잔여 경로

다음은 코드와 verification에는 남아 있지만 현재 제품 조립 경로에서는
호출되지 않는다.

| 항목 | 상태 |
|---|---|
| `playback-render/controllers/usePlaybackController.ts` | Timeline Runtime으로 대체됨 |
| `usePlaybackLoopController.ts` | Timeline Runtime scheduler로 대체됨 |
| `usePlaybackRangeController.ts` | Timeline Runtime range command로 대체됨 |
| `models/playbackModel.ts`의 React state 계약 | 현재 제품 Runtime과 불일치 |
| `renderers/rendererMode.ts` | Canvas helper가 Full/Fast를 직접 선택해 미사용 |
| `canvas/controllers/usePreviewUpdatePipeline.ts` | 제품 호출자 없음 |
| Canvas `DirtyStateStore` | 생성되지만 제품 draw 경로에서 소비하지 않음 |
| `dirtyStateHelpers` / `nodeCacheHelpers` | verification 전용, 제품 미연결 |

현재 실제 Fast incremental 경로는 다음 세 단계다.

```text
Fast Renderer previous-node reference reuse
  → PreviewScene dirty bounds draw plan
  → Composition/Surface Cache
```

과거 문서 44의 `Preview Update Pipeline → Dirty State → Node Cache`가
현재도 제품의 주 경로인 것처럼 읽히는 점이 가장 큰 문서/코드 혼동이다.

## 7. 복잡성을 만드는 구조적 문제

### 7.1 `playback-render` 이름과 실제 책임 불일치

Playback authority는 이미 Timeline Engine에 있다. 그런데 frame/range
helper, 이전 React playback controller와 model, time formatting이 계속
Render public barrel에 남아 있다.

동시에 이 폴더는 Source Runtime lifecycle과 Editor frame evaluation까지
포함한다. 결과적으로 이름 하나가 너무 많은 책임을 가리킨다.

### 7.2 실제 경로와 과거 최적화 경로가 함께 존재

Dirty Region이라는 이름의 구현이 두 계열로 보인다.

- 현재 사용: `previewSceneDirtyRegionHelpers`
- 현재 미사용: Canvas `DirtyStateStore` + `NodeCache` +
  `usePreviewUpdatePipeline`

둘 다 verification이 있어 삭제된 코드로 보이지 않으며, 새 작업자가 어느
경로를 고쳐야 하는지 판단하기 어렵다.

### 7.3 mode 선택이 두 곳에 표현됨

- 실제 제품: Composition Root의 `rendererMode` state → Canvas helper 분기
- 남은 일반 API: `renderWithRendererMode()`
- 남은 playback model: renderer mode를 Playback state로 표현

표시 모드는 Project Data나 Timeline playback이 아니라 Canvas Preview
표시 정책이다. 현재 Root state는 저장 원본을 만들지는 않지만 최종
소유권이 Canvas Runtime으로 드러나지 않는다.

### 7.4 identity 명칭에 이전 구조가 남음

`itemId`는 `layerDocumentId`와 중복되고 `renderItemId`는 이제 Project의
Render Item이 아니다. 현재 동작은 가능하지만 LayerDocument identity,
Source visual identity와 painter identity를 구분하기 어렵게 만든다.

### 7.5 관찰 Runtime이 전체 수명을 덮지 못함

Canvas Metrics는 renderer/draw/cache를 관찰하지만 Source Runtime Cache는
Editor Runtime에서 metrics 없이 생성된다. Project command 쪽도
`NOOP_METRICS`를 사용한다. 따라서 하나의 metrics snapshot을 전체 Render
pipeline 비용으로 해석하면 안 된다.

### 7.6 계산 경계가 React read와 결합됨

Canvas read 때 Project validation, evaluation과 scene build를 동기 실행한다.
Draft publish도 대상 input을 얻기 위해 같은 builder를 호출한다. 지금
정확성은 유지되지만 대형 Project에서 Renderer보다 evaluation이 병목이 될
가능성이 있으며, 현재 이름 때문에 이를 Renderer 비용으로 오해하기 쉽다.

## 8. 유지해야 하는 부분

다음은 책임이 명확하거나 최적화에 필수이므로 단순히 파일 수를 줄이기 위해
합치면 안 된다.

- Evaluated Scene 하나를 Full/Fast가 공유하는 구조
- Full/Fast 출력 계약 분리
- Source resource key와 Layer visual result key 분리
- canonical UI order와 painter reverse traversal 분리
- Fast previous-node identity 재사용
- Dirty Region의 previous/next bounds union
- Composition Cache와 Surface Cache의 역할 분리
- Full Render와 Fast Render의 서로 다른 surface 정책
- Source Runtime resource를 Project/History에 저장하지 않는 계약
- Preview/Export original source 경계
- Editor-only Overlay를 Render output에서 분리하는 구조

## 9. 권장 최종 책임 지도

후속 정리는 새 Renderer나 새 Engine을 추가하는 방향이 아니라 다음 네
경계를 명확히 하는 방향이 적절하다.

```text
Timeline Engine Runtime
  └─ frame / range / transport / clock

Project Owner Source Runtime
  └─ decoded resource lifecycle / resolution

Pure Render Module
  ├─ frame evaluation input contract
  ├─ Evaluated Scene
  ├─ Full Renderer → RenderFrame
  ├─ Fast Renderer → PreviewScene
  └─ Canvas2D painter contracts

Canvas Engine Runtime
  ├─ renderer mode / quality
  ├─ previous PreviewScene / draw state
  ├─ Dirty Region
  ├─ Composition Cache / Surface Pool
  ├─ Metrics / FPS
  └─ selection alpha / screen tone
```

Render는 독립 Panel이 없으므로 장기적으로 Panel Engine이라기보다
state를 소유하지 않는 pure/core module로 설명하는 편이 현재 헌법과
일치한다. 파일 이동이나 이름 변경은 영향이 크므로 별도 Sprint에서만
진행해야 한다.

## 10. 권장 정리 순서

### 1단계 — 비활성 경로 확정과 제거

- Timeline으로 대체된 Playback controller/model을 제거한다.
- 미사용 `renderWithRendererMode()`와 실제 mode 분기를 하나로 정한다.
- `usePreviewUpdatePipeline`, Dirty State와 Node Cache가 제품에서 정말
  불필요한지 동일 fixture로 마지막 확인 후 제거한다.
- 과거 문서 43~44의 현재 상태를 명시한다.

이 단계는 출력과 성능을 바꾸지 않는 dead-path cleanup이어야 한다.

### 2단계 — Runtime 소유권 이름 정리

- renderer mode를 Canvas Runtime 소유로 명시한다.
- Source Runtime 구현 위치를 Project lifecycle 책임과 맞춘다.
- `itemId` 중복을 제거한다.
- `renderItemId`의 실제 의미를 확정해 `sourceVisualId` 같은 Runtime
  identity로 이름을 바꿀지 결정한다.

저장 schema와 `layerDocumentId`, `sourceId`는 변경하지 않는다.

### 3단계 — 평가와 Renderer 경계 분리

- `LayerDocumentRuntimeReadModel`을 Editor frame evaluation으로 명확히
  정의한다.
- Overlay target projection과 Renderer scene input의 책임을 분리한다.
- Draft publish와 React read의 중복 evaluation을 먼저 계측한 뒤, 필요한
  경우 동일 revision/frame/draft 입력의 계산 결과만 재사용한다.

새 전역 Store나 Project 저장 원본을 만들지 않는다.

### 4단계 — 폴더 경계 정리

- Playback helper와 Timeline formatting은 Timeline 쪽으로 이동한다.
- Render 전용 model/renderer/painter는 pure Render module로 모은다.
- Canvas cache 구현과 retained draw state는 Canvas Engine에 둔다.
- Source resource lifecycle은 Project Owner의 Source Runtime 책임으로
  표현한다.

이 단계는 import 경로가 넓게 바뀌므로 1~3단계가 안정된 뒤 수행한다.

## 11. 검증 기준

정리 Sprint에서는 아래를 같은 fixture로 전후 비교해야 한다.

- full/fast pixel hash
- PSD/Timeline/Canvas painter order
- frame p95와 Canvas paint FPS
- animation evaluation/renderer 호출 수
- Dirty full/partial/skip
- Composition Cache hit/miss
- Surface create/reuse/dispose
- Source register/invalidate/dispose
- Draft 중 Project/History 0회
- PointerUp Project/History 각 1회
- Import/Refresh/Reconnect/Delete/Open lifecycle
- Undo/Redo 뒤 current frame 유지

비활성 코드 제거는 해당 코드의 기존 verification을 삭제하는 것으로 끝내지
말고, 실제 제품 경로를 검증하는 fixture가 같은 계약을 보장하는지 먼저
확인해야 한다.

## 12. 최종 판단

현재 Render는 기능적으로 망가진 구조가 아니다. 최적화도 실제 제품 경로에
연결되어 있다.

다만 다음 정리는 필요하다.

1. Timeline으로 이전된 Playback 잔재 제거
2. 미사용 Preview Dirty/Node 경로 제거
3. Renderer Mode의 Canvas Runtime 소유권 명시
4. LayerDocument/Source visual identity 명칭 정리
5. Editor frame evaluation과 순수 Renderer 경계 분리
6. 마지막에만 폴더와 public export 정리

가장 위험한 선택은 복잡해 보인다는 이유로 Scene 세 단계나 Cache 계층을
한꺼번에 합치는 것이다. 먼저 **사용 중인 Runtime과 사용하지 않는 Runtime을
분리**하는 것만으로도 구조가 크게 단순해지며, 기존 성능 계약을 보존할 수
있다.

## 13. 큰 파일

현재 Render 관련 500줄 이상 TypeScript 파일:

- `src/engines/playback-render/adapters/layerDocumentRuntimeInputAdapter.ts`:
  531줄
- `src/engines/playback-render/renderers/fastPreviewRenderer.ts`: 528줄

이번 조사는 리팩토링을 수행하지 않았다.
