# 최근 작업 보고

## 작업

Render Runtime Boundary & Terminology Cleanup Sprint 사전 조사와 계획 검토

## 수행 범위

- 기준 Architecture와 현재 Source Map 검토
- 실제 `src`/`scripts` import, caller와 public barrel 대조
- 제품 사용, verification 전용, 미래 Accurate 경계와 dead code 분류
- 삭제, rename, move와 보존 대상 판정
- `docs/98_sprint_plan.md` 작성

제품 코드는 수정하지 않았고 Build, Verification과 Browser QA는 실행하지
않았다.

## 최종 결론

현재 Render Architecture를 다시 만들 필요는 없다. 핵심 제품 흐름은 다음으로
일관되어 있다.

```text
Project + Timeline Frame + Draft + Source
→ Frame Evaluation
→ EvaluatedScene
├─ Preview Renderer → PreviewScene → Dirty Canvas Draw → Editor Canvas
└─ Accurate Renderer → RenderFrame → 검증 / 미래 Export 경계

Editor Overlay = 작품 Pixel 밖의 별도 Canvas UI
```

문제는 동작이 아니라 **현재 경로 주변에 남은 과거 코드와 이름**이다.

- 사용하지 않는 Preview update/Dirty/Node Cache 체계
- Timeline으로 이전된 뒤 남은 Playback controller
- 제품, verification와 미래 API가 섞인 public barrel
- mode가 하나인데 남은 Canvas Mode 명칭
- Preview와 Source가 함께 쓰는 `quality`
- LayerDocument 전환 전 identity 이름
- Preview Renderer에 남은 `playback*` Metrics
- 최신 Architecture보다 뒤처진 Source Map 표현

이 항목은 하나의 Cleanup Sprint에서 처리할 수 있다. 다만 검색·치환 한 번으로
처리하면 안 되며 `docs/98_sprint_plan.md`의 9개 Task 순서를 따라야 한다.

## 1. 실제 caller 조사

| 파일 / Symbol | 실제 caller | 제품 사용 | Verification | Public export | 판정 |
|---|---|---:|---:|---:|---|
| `usePreviewUpdatePipeline()` | 없음 | 아니오 | 아니오 | 아니오 | 확실한 삭제 |
| `previewDraftBaseSceneHelpers.ts` | 위 Pipeline만 | 아니오 | 아니오 | 아니오 | 확실한 삭제 |
| `useCanvasPreviewRuntime().dirty` | 소비자 없음 | 아니오 | 간접 fixture | 반환됨 | 생성·반환 제거 |
| `dirtyStateStore.ts` | 미사용 Pipeline, scripts | 아니오 | 예 | Canvas barrel | 실제 Dirty 검증으로 대체 후 제거 |
| `dirtyStateHelpers.ts` | 미사용 Pipeline, node cache, scripts | 아니오 | 예 | Canvas barrel | 같은 단계에서 정리 |
| `nodeCacheHelpers.ts` | 미사용 Pipeline, `verifyNodeCache` | 아니오 | 예 | Canvas barrel | retained Preview 검증으로 대체 후 제거 |
| `updatePreviewSceneFromPlaybackFrame*` | 없음 | 아니오 | 아니오 | Render barrel | 확실한 삭제 |
| `updatePreviewSceneNodeTransform*` | 미사용 Pipeline, 한 cache fixture | 아니오 | 예 | Render barrel | fixture 전환 후 삭제 |
| `PreviewSceneTransformPatch` | Canvas/Properties/Draft | 예 | 예 | Render barrel | active Draft model 위치로 이동·보존 |
| `collectRenderFrameSourceIds()` | 없음 | 아니오 | 아니오 | Canvas barrel | 확실한 삭제 |
| `usePlaybackController()` | 없음 | 아니오 | 아니오 | 아니오 | 확실한 삭제 |
| `usePlaybackLoopController()` | 없음 | 아니오 | 아니오 | 아니오 | 확실한 삭제 |
| `usePlaybackRangeController()` | 없음 | 아니오 | 아니오 | 아니오 | 확실한 삭제 |
| frame/range helper | Timeline Runtime/UI | 예 | 예 | Render barrel | Timeline으로 이동·보존 |
| `timeFormatting.ts` | Editor Root의 Timeline UI wiring | 예 | 아니오 | Render barrel | Timeline으로 이동·보존 |
| `renderPreviewRenderer()` | Canvas 제품 경로 | 예 | 예 | Render barrel | 보존 |
| `renderAccurateRenderer()` | verification, Canvas wrapper | UI 아니오 | 예 | Render barrel | 미래 전체 Frame 경계로 보존 |
| `buildLayerDocumentCanvasRenderFrame()` | observation fixture 1곳 | 아니오 | 예 | Canvas barrel | direct Accurate 호출로 바꾸고 삭제 |
| `renderFrameToCanvas()` | caller 없음 | 아니오 | 경계 대상 | Render barrel | Accurate 전체 draw 경계로 보존 |
| reusable Render surface | caller 없음 | 아니오 | 경계 대상 | Render barrel | Accurate 의미로 rename 후 보존 |
| `LayerDocumentCanvasMode*` | Canvas 제품과 fixture | 예 | 예 | Canvas barrel | 단일 Canvas Read 명칭으로 변경 |
| Canvas/Evaluation `quality` | Canvas, Properties, Source | 예 | 예 | 계약 일부 | Preview/Source 의미 분리 |
| Render `itemId` | Renderer와 fixture | 예 | 예 | Scene 계약 | 중복 alias 제거 |
| `localFrameByItemId` | 평가 결과와 fixture | 예 | 예 | Scene 계약 | 실제 key 이름으로 변경 |
| `renderItemId` | Source runtime visual resolve | 예 | 예 | Scene/Source 계약 | Source runtime 의미로 rename 검토 |
| `drawableId` | Source 내부 drawable resolve | 예 | 예 | Scene/Source 계약 | Source drawable 의미 보존 |
| `targetCompId` | Group node와 cache | 예 | 예 | Scene 계약 | Group ID 중복 여부에 따라 제거/명확화 |

## 2. 확실히 삭제 가능한 코드

현재 import/caller 기준으로 다음은 제품과 verification 양쪽에서 필요하지 않다.

- `usePreviewUpdatePipeline.ts`
- `previewDraftBaseSceneHelpers.ts`
- `collectRenderFrameSourceIds()`와 전용 helper 파일
- `updatePreviewSceneFromPlaybackFrame()`
- `updatePreviewSceneFromPlaybackFrameWithStats()`
- `usePlaybackController.ts`
- `usePlaybackLoopController.ts`
- `usePlaybackRangeController.ts`
- 위 controller만 사용하는 React state/read/command port

`useCanvasPreviewRuntime()`의 `dirty`도 만들어지기만 하고 읽히지 않으므로
제품 인스턴스에서 제거할 수 있다.

## 3. 바로 삭제하면 안 되는 코드

### 실제 제품 최적화

- Previous Preview Scene
- `PreviewCanvasDrawState`
- `previewSceneDirtyRegionHelpers.ts`
- Composition Preview Cache
- Preview Surface Cache
- Source Runtime Resource Cache
- Preview Renderer의 retained node reuse
- Canvas2D Preview painter

이 항목은 과거 Dirty/Node Cache와 이름이 비슷하지만 현재 제품이 실제로
사용하는 최적화다.

### Verification을 전환한 뒤 판단할 코드

- `dirtyStateStore.ts`
- `dirtyStateHelpers.ts`
- `nodeCacheHelpers.ts`
- `nodeCacheModel.ts`
- `verifyDirtyCache.ts`
- `verifyNodeCache.ts`
- `updatePreviewSceneNodeTransform*`

현재 제품 caller는 없지만 verification이 존재한다. 먼저 현재 제품의
Previous Scene + Draw State 계약으로 검증 목적을 옮긴 뒤 제거해야 한다.

### 미래 경계

- `accurateRenderer.ts`
- `RenderFrame`
- `canvas2dRenderAdapter.ts`
- Accurate reusable surface factory

제품 UI에 연결되지 않았다는 이유로 삭제하면 안 된다. 이들은 Accurate 전체
Frame과 미래 Export 사이의 의도된 직접 호출 경계다.

## 4. Playback과 Render 폴더 판단

현재 `src/engines/playback-render`에는 다음 책임이 함께 있다.

- Frame Evaluation
- Preview/Accurate Renderer
- Canvas2D painter
- Source Runtime Resource Cache
- Timeline frame/range helper
- Timeline time formatting
- 과거 Playback React controller

실제 Playback Runtime은 이미 Timeline Engine이 소유한다. 따라서 다음 순서가
가장 자연스럽다.

1. 과거 controller 삭제
2. active frame/range/time helper를 Timeline으로 이동
3. 남은 `playback-render`를 `src/render`로 이동

폴더 이동은 단순 미관 작업만은 아니다.

- Render가 독립 Panel Engine인 것처럼 보이는 문제를 줄인다.
- Timeline Runtime의 실제 소유자와 helper 위치가 일치한다.
- `@/render`가 Architecture의 Frame Evaluation/Renderer 경계를 직접 나타낸다.

다만 내부 파일을 다시 분류하거나 577줄 Evaluation 파일과 526줄 Preview
Renderer를 이번 Sprint에서 분해할 필요는 없다. parent folder와 import
boundary만 기계적으로 이동하는 것이 안전하다.

폴더 이동에서 alias, 순환 import 또는 verification loader 문제가 생기면
이동만 rollback하고 이름/export 정리는 유지하는 조건을 계획에 넣었다.

## 5. Canvas Mode 조사

현재 Canvas 계약의 `mode`는 `"layer-document"` 한 값뿐이다.

- mode dispatcher가 없다.
- 다른 mode 구현이 없다.
- Renderer mode도 이미 제거됐다.
- `buildLayerDocumentCanvasModeReadModel()`은 실제로 Evaluation 결과를 Canvas
  renderer/selection/overlay read model로 투영한다.

따라서 `Mode`보다 `Read`가 정확하다.

```text
LayerDocumentCanvasModeInput
→ LayerDocumentCanvasReadInput

LayerDocumentCanvasModeReadModel
→ LayerDocumentCanvasReadModel

buildLayerDocumentCanvasModeReadModel
→ buildLayerDocumentCanvasReadModel
```

`mode: "layer-document"` 필드는 제거해도 정보 손실이 없다.

## 6. Quality 계약 조사

현재 `quality`는 실제로 두 의미를 전달한다.

### Canvas Preview Quality

- `auto/original/high/medium/low`
- root/offscreen Canvas backing scale 결정
- Canvas Preview Runtime 소유

### Source sampling quality

- Source resolver request와 timed Source resource cache key에 전달
- PSD는 static policy라 key에 quality가 들어가지 않음
- 미래 Audio/Video 같은 timed Source는 frame과 quality를 key에 포함

현재 Evaluation identity에서는 quality가 이미 제거됐지만,
`layerDocumentRuntimeInputAdapter.ts`는 여전히 `quality: string`을 받아 Source
resolver로 전달한다.

따라서 값을 삭제하면 안 된다. 이름과 type만 다음처럼 분리해야 한다.

```text
Canvas: previewQuality
Adapter mapping
Frame Evaluation / Source: sourceSamplingQuality
```

mapping 전후 문자열과 Source cache key는 완전히 같아야 한다. 이번 Cleanup에서
가장 위험한 Task 중 하나다.

## 7. Identity 조사

| Identity | 실제 의미 | 생성 위치 | 저장 여부 | 판단 |
|---|---|---|---:|---|
| `layerDocumentId` | 작업 Layer의 canonical ID | Project transaction/import | 저장 | 보존 |
| Render `itemId` | 현재 제품에서는 `layerDocumentId` 복사본 | Frame Evaluation | 저장 안 함 | 제거 가능 |
| `identityKind` | `itemId`/`renderItemId` fallback 선택 | legacy fixture | 저장 안 함 | active Render에서 제거 가능 |
| `renderItemId` | PSD runtime resource가 만든 `runtime:{sourceId}` | PSD runtime 준비 | 저장 안 함 | `sourceRuntimeId` 후보 |
| `drawableId` | Source 내부 drawable 식별자 | PSD runtime 준비 | 저장 안 함 | `sourceDrawableId` 후보 |
| `sourceId` | 공유 Source descriptor ID | Project Source Registry | 저장 | 보존 |
| `targetCompId` | 현재 Group `layerDocumentId`와 같은 값 | Frame Evaluation | 저장 안 함 | 중복 제거 또는 Group 명칭 |
| `localFrameByItemId` | 실제 key는 `layerDocumentId` | Frame Evaluation | 저장 안 함 | 이름 변경 |

중요한 범위 제한:

- offline migration의 과거 `TimelineItem.itemId`는 이번 Render 정리 대상이
  아니다.
- Timeline UI가 내부적으로 사용하는 row `itemId`도 Render identity와
  무관하면 일괄 변경하지 않는다.
- `sourceId`와 `layerDocumentId` 값은 절대 변경하지 않는다.
- `renderItemId`, `drawableId`, `targetCompId`는 생성자와 소비자가 표의 의미와
  일치할 때만 변경한다.

identity는 이번 Sprint에 포함하는 것이 맞다. 현재 이름을 그대로 두면 다음
Source/Export 기능이 잘못된 ID를 Project identity로 사용할 위험이 남는다.
다만 Task 8 하나로 격리하고 개별 rename마다 rollback 가능해야 한다.

## 8. Metrics 조사

### 현재 제품에서 실제 기록

- `animationEvaluation`
- `previewRenderer`, `previewSceneGeneration`
- `playbackDirtyNode`, `playbackCleanNode`
- `playbackNodeUpdated`, `playbackNodeReused`
- `playbackCompositionReused`, `playbackFrameUpdateTime`
- `dirtyFull`, `dirtySkip`, `dirtyPartial`
- painter, composition/cache, surface, draw와 commit 계열

`playback*` 여섯 개는 dead metric이 아니다. Preview Renderer의 retained Scene
경로에서 현재 기록되므로 `preview*`로 rename해야 한다.

### dead Preview Pipeline counter

- `previewUpdate`
- `dirtyNode`
- `frameDirty`
- 기존 Pipeline의 `previewNodeUpdated`
- 기존 Pipeline의 `previewNodeReused`

이들은 미사용 `usePreviewUpdatePipeline()`에 연결돼 있다. dead path 제거와
함께 정리한다. active `playbackNodeUpdated/Reused`를 `previewNodeUpdated/Reused`
로 rename할 때 이름 충돌을 피하도록 같은 순서에서 처리해야 한다.

### Verification sentinel

`painterClone`은 제품에서 increment되지 않지만 Baseline이 계속 `0`임을
보장하는 회귀 sentinel이다. dead counter로 삭제하지 않는다.

### Source Runtime Metrics가 연결되지 않은 이유

Source Runtime Resource Cache는
`useLayerDocumentEditorRuntime()`에서 Project session 수명으로 먼저 생성된다.
Canvas Metrics는 `useCanvasPreviewRuntime()`에서 Canvas Panel 수명으로 생성된다.

현재 Source Cache 생성에는 metrics port가 주입되지 않으므로 등록·무효화
counter가 제품 Canvas Metrics에 기록되지 않는다. 이는 단순 누락이기도 하지만,
Canvas 수명 Metrics를 Editor/Source 수명에 역으로 주입하면 소유권이 꼬일 수
있다.

이번 Sprint에서는 새 관찰 Runtime을 만들지 않는다. 미연결 사실만 명확히
기록하고 기존 Preview 성능 counter만 정리하는 것이 안전하다.

## 9. Public export 최종 판단

### 제품 main boundary

`@/render`

- Frame Evaluation과 `EvaluatedScene`
- Preview Renderer와 `PreviewScene`
- Accurate Renderer와 `RenderFrame`
- Preview/Accurate Canvas draw 계약
- Source Runtime Resource port/cache
- active Draft/Evaluation 계약
- Metrics record port

`@/engines/canvas`

- Canvas Panel Engine
- Editor/Feature가 사용하는 read/command/view props
- Preview Quality와 FPS view 계약
- Canvas interaction/overlay view type

`@/engines/timeline`

- Timeline Panel Engine
- Timeline Runtime
- frame/range helper
- time formatting

### main boundary에서 제거

- dead Dirty/Node Cache API
- PreviewScene 직접 patch API
- verification-only cache helper
- redundant Canvas Accurate wrapper
- Timeline helper와 Playback model
- 내부 cache key/draw helper

필요한 verification seam이 남는다면 제품 `index.ts`가 아니라 `testing` entry
또는 내부 파일 직접 import로 격리한다.

## 10. 문서 정합성

`docs/architecture/11_render_architecture.md`의 큰 구조는 실제 코드와 맞는다.

현재 `docs/20_src_map.md`에서 바꿔야 할 표현:

- `full/fast draw`
- `fast composition surface`
- `full/fast render`
- 제품에서 사용되는 것처럼 적힌 `usePreviewUpdatePipeline`
- 제품 Dirty 경로처럼 적힌 `dirtyStateStore`
- `Canvas mode`라는 단일 mode 표현

`docs/completed/60~62`의 Full/Fast와 당시 Runtime 설명은 역사 기록이므로
수정하지 않는다. 현재 기준 문서는 Architecture와 Source Map이다.

## 11. Sprint 구성 판단

한 번의 Sprint로 처리할 수 있다. 새로운 기능이나 Architecture 변경이 아니라
경계 정리이기 때문이다.

안전한 Task 수는 9개다.

1. Caller와 Baseline 고정
2. Dead Preview 경로 제거
3. Public boundary 정리
4. Canvas 단일 Read 명칭
5. Playback 소유권 정리
6. Render 폴더 경계 정리
7. Quality 계약 분리
8. Render identity 정리
9. Metrics와 문서 정합성

이 순서를 바꾸면 안 되는 핵심 이유:

- dead path를 먼저 없애야 active/dead Metrics 이름이 충돌하지 않는다.
- public export를 줄인 뒤 rename해야 영향 범위를 정확히 알 수 있다.
- Playback을 먼저 꺼내야 `playback-render` 폴더 이동이 순수한 기계 작업이
  된다.
- Quality와 identity는 Cache key에 닿으므로 구조 이동이 끝난 뒤 각각
  독립적으로 검증해야 한다.
- 문서는 실제 구현 완료 후 마지막에 맞춰야 한다.

## 12. 위험과 보존 가능성

### 가장 위험

1. Quality rename 중 timed Source key 값 변경
2. identity 정리 중 Source visual resolve와 Group Cache key 변경
3. Render folder move 중 alias/verification loader/import boundary 오류

### 위험 완화

- Task 1의 동일 fixture Before/After 비교
- 이름 변경과 동작 변경을 섞지 않음
- Cache key 문자열과 painter/cache 수치 고정
- 각 Task 독립 rollback
- 500줄 이상 파일 분해 금지
- 최종 Browser QA는 사용자 승인 뒤 별도 실행

### 제품 동작과 성능 보존 판단

계획대로 진행하면 보존 가능하다.

- 실제 Preview Renderer와 draw/cache 알고리즘은 변경하지 않는다.
- Accurate 전체 Frame 경계도 보존한다.
- 모든 최적화 수치는 기존 Baseline과 직접 비교한다.
- Quality와 identity는 값이 아니라 이름/계약만 정리한다.
- 수치나 Cache key가 달라지면 해당 Task를 PASS 처리하지 않는다.

## 감독관 최종 답변

### 이 정리를 한 번의 Sprint로 처리해도 되는가?

가능하다. 9개 순차 Task와 독립 rollback이 조건이다.

### 몇 개의 Task가 안전한가?

9개가 안전하다. Quality와 identity를 다른 Task에 섞으면 안 된다.

### 지금 삭제해도 확실한 코드는 무엇인가?

caller가 전혀 없는 Preview pipeline/base helper, Render source ID collector,
playback-frame update 함수 2개와 과거 Playback controller 3개다.

### 아직 삭제하면 안 되는 코드는 무엇인가?

실제 Dirty Region/Preview Cache, verification 전환 전 Dirty/Node Cache helper,
Accurate Renderer/Canvas adapter/surface와 active Draft patch type이다.

### 폴더 이동은 필요한가?

필요하다. Playback helper를 Timeline으로 옮긴 뒤
`playback-render`를 `src/render`로 바꾸는 것은 실제 책임을 명확히 한다.
내부 파일 재분해는 필요하지 않다.

### identity 정리는 이번 Sprint에 포함해야 하는가?

포함해야 한다. 단 Render Runtime 범위로 제한하고 저장 schema와 offline
migration identity는 건드리지 않는다.

### 현재 제품 동작과 성능을 보존할 수 있는가?

가능하다. 각 Task의 Before/After 숫자, Cache key와 정적 검증을 Gate로
사용한다. Browser QA는 정적 완료 후 사용자 승인 시에만 실행한다.

## 변경

- `docs/98_sprint_plan.md`: 새 Cleanup Sprint 계획으로 전체 교체
- `docs/99_recent_task.md`: 이번 조사와 감독관 검토 결과로 전체 교체
- 제품 코드와 `docs/20_src_map.md`: 수정하지 않음
