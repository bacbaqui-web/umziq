# Shortform Editor source map

> 점검 기준: 2026-07-21, 현재 작업 폴더의 소스 코드 기준
> 현재 상태: Transform Drag Runtime Continuity Task 1~8 완료 / 전체 정적 검증 완료 / 사용자 승인 범위 Edge 대상 QA 완료
> 목적: 다음 작업자가 파일 책임, 상태 소유권, Engine 연결 경계를 빠르게 파악하기 위한 지도다.

## 추천 읽기 순서

새로운 작업을 시작할 때 현재 상태를 가장 빠르게 이해하기 위한 순서다.

1. `99_recent_task.md`: 바로 직전 Task의 결과와 검증 상태
2. `98_sprint_plan.md`: 현재 Sprint 목표와 진행률, 다음 Task
3. `97_next_sprint.md`: 다음 Sprint 인수인계가 있을 때 확인
4. `20_src_map.md`: 프로젝트 구조, 책임과 연결 경계
5. 수정 대상과 관련된 `40~96_*.md` 영구 기능 문서

Sprint가 진행 중이지 않고 완료된 기능을 조사하는 경우에는 이 문서의 문서 지도에서 관련 `40~96_*.md` 영구 기능 문서를 찾아 먼저 읽는다.

## 문서 지도

| 문서 | 책임 |
|---|---|
| `00_rule.md` | 프로젝트 운영 규칙 |
| `20_src_map.md` | 현재 코드 구조, 파일 책임, 문서 지도 |
| `40_modifier_library.md` | Properties Modifier 수식 라이브러리 설계 |
| `41_psd_import_workflow.md` | PSD Import Preview/Refresh 설계 |
| `42_preview_quality_and_memory_cache.md` | Preview 품질과 Memory Cache 설계 |
| `43_dual_renderer_architecture.md` | Dual Renderer Architecture 영구 기능 문서 |
| `44_preview_runtime_optimization.md` | Preview Runtime Optimization Sprint 완료 구조와 성능 QA 결과 |
| `45_editor_draft_runtime_integration.md` | Editor Draft Runtime 통합 구조와 검증 결과 |
| `46_transform_origin_editing.md` | Properties/Canvas Transform Origin 편집 구조와 QA 결과 |
| `47_canvas_engine_responsibility_refactoring.md` | Canvas Transform Input과 Preview Canvas Render 책임 분리 구조 |
| `48_canvas_visual_layer_selection.md` | Evaluated Scene 기반 alpha-aware Canvas 직접 선택과 Editor-only outer glow 구조 |
| `49_transform_drag_runtime_continuity_optimization.md` | Transform Draft의 Selection/Renderer/Motion/Direct Selection/Alpha/Panel memo 연속성 최적화와 호출 수·중간 QA 결과 |
| `97_next_sprint.md` | 다음 Sprint 인수인계와 계획 초안 |
| `98_sprint_plan.md` | 현재 진행 중인 Sprint 하나의 계획과 진행 상황 |
| `99_recent_task.md` | 바로 직전 Task 한 건의 보고 |

## 실행과 검증

Node.js 24 환경을 기준으로 한다.

```bash
npm install
npm run dev
```

프로덕션 결과 확인:

```bash
npm run build
npm run preview
```

검증 명령:

```bash
npm test
npm run lint
npm run build
npm run qa
git diff --check
```

## 1. 프로젝트 한눈에 보기

PSD를 불러와 Photoshop group을 Composition으로, pixel layer를 Layer/drawable로 바꾸고 세로형 Canvas에서 transform과 keyframe을 편집하는 React/Vite 프로토타입이다.

현재 주요 기능:

- 여러 PSD import, 같은 이름 교체, refresh, source 상태 승인/삭제
- PSD composition tree 탐색, 선택, 정렬, 삭제
- 중첩 Composition의 Canvas 2D 렌더
- position/scale/rotation/opacity 정적 값과 keyframe 편집
- Layer/Sub Composition별 Properties 수식 라이브러리와 결정적 `부들부들` position Modifier
- Canvas gizmo, anchor, motion path/keyframe drag
- Canvas 실제 불투명 pixel 기반 Layer/Sub Composition 직접 선택과 선택 silhouette outer glow
- Playback, scrub, range, duration 편집
- Timeline item move/resize/reorder/duplicate/split/rename/delete
- Composition 단위 Undo/Redo와 drag 1회당 history 1회

아직 없는 큰 기능은 프로젝트 영속 저장/불러오기, 영상 export, 오디오/텍스트 편집이다.

## 2. 앱 실행과 Composition Root

```text
src/main.tsx
  → src/app/App.tsx
    → src/editor/EditorShell.tsx
      → useEditorCompositionRoot
        ├─ useEditorState
        │   ├─ Shell-owned Engine State Stores
        │   ├─ Editor Session/Layout State
        │   └─ Project Commands/History
        ├─ Project Selection + PSD Engine
        ├─ PSD Tree Engine
        ├─ Playback Engine
        ├─ Timeline Engine
        ├─ Properties Engine
        ├─ Animation Engine
        ├─ Canvas Composition + Render Engine
        ├─ History Shortcut
        └─ Shell Layout
             ↓ ViewProps
        EditorShellLayout
          ├─ PsdTree
          ├─ PreviewWorkspacePane
          ├─ PropertiesPanel
          └─ TimelinePanel
```

`src/editor/useEditorCompositionRoot.ts`가 일곱 Engine을 모두 아는 유일한 앱 파일이다. 여기서 공개 Engine hook을 호출하고 read/command/history port를 서로 연결한다. 내부 Controller나 Helper를 직접 호출하지 않는다.

### 핵심 입력 흐름

```text
PSD File/FileHandle
  → PSD Tree picker
  → Project prepare(parse 1회 + Plain Data Import Plan)
  → PSD Tree Import Preview/Plan 편집
  → Confirm 시 Project builder/import controller
  → Project records + runtime render records
  → Project Selection ReadModel
  → Timeline / Properties / Canvas / Render
```

```text
Timeline / Properties / Preview DOM event
  → 해당 UI Engine Command
  → Project 또는 Animation 공개 Command
  → History Port + State Store
  → ReadModel 재계산
  → ViewProps 갱신
```

```text
Playback currentFrame
  → Timeline item global/local frame 계산
  → Animation evaluation
  → Render Frame Command
  → Canvas 2D Adapter
```

## 3. Import 경계 규칙

- Engine 외부에서는 `@/engines/<engine>`의 `index.ts`만 import한다.
- 외부에서 Engine façade 아래의 어떤 구현 하위 경로도 직접 참조하지 않는다.
- Core Engine인 Project, Animation, Playback & Render는 Editor/Feature/UI Engine을 import하지 않는다.
- UI Engine인 PSD Tree, Canvas, Properties, Timeline은 서로 import하지 않는다.
- Controller는 다른 Controller나 Composer를 직접 import하거나 호출하지 않는다.
- Composer는 여러 Controller 조립과 공개 API 구성만 담당하며 제품 계산이나 mutation을 구현하지 않는다. 여러 Controller 조립을 위한 Controller import는 Composer에서만 하고 Composer끼리는 import하지 않는다.
- Engine hook은 독립 Controller와 필요한 Composer를 조립한다. Controller 하나를 연결하기 위한 기계적 Composer는 추가하지 않는다.
- 순수 Helper는 React, DOM, setter, Command를 사용하지 않는다.
- 공유 가능한 저장 Domain은 `src/models`, Engine별 runtime/session/view model은 해당 Engine이 소유한다.
- `scripts/verifyEngineImportBoundaries.ts`가 위 규칙을 검사한다.

현재 검사 결과:

- Engine 외부 내부 경로 import: 0
- Core → UI/Editor/Feature: 0
- UI Engine → 다른 UI Engine: 0
- Controller → Controller 직접 import: 0

## 4. 공유 Domain Model

| 파일 | 책임 |
|---|---|
| `src/models/transformModel.ts` | `Position`, `Scale` 값 구조 |
| `src/models/animationModel.ts` | animatable property, track state, keyframe 타입과 기본 생성 |
| `src/models/modifierModel.ts` | 객체별로 저장하는 Modifier discriminated union과 숫자 필드 계약 |
| `src/models/psdSourceIdentityModel.ts` | PSD 원본 파일명과 Photoshop layer ID 기반 stable source key Plain Data 계약 |
| `src/models/psdImportSettingsModel.ts` | PSD Main Composition 이름과 숨김 source 처리 정책 Plain Data 계약 |
| `src/models/compositionModel.ts` | Composition/Layer/meta/tree/source sync 저장 계약 |
| `src/models/timelineItemModel.ts` | Timeline item kind/timing/instance 계약 |
| `src/models/selectionModel.ts` | UI Engine이 공유하는 `TimelineSelection` 계약 |
| `src/models/index.ts` | 공유 Domain 공개 barrel |

`HTMLCanvasElement`, `File`, file handle, React draft/hover/drag state는 공유 저장 Domain에 넣지 않는다.

## 5. Editor Shell 파일

| 파일 | 책임 |
|---|---|
| `src/editor/EditorShell.tsx` | Composition Root 결과를 Layout에 전달하는 최상위 View 경계 |
| `src/editor/useEditorCompositionRoot.ts` | state 생성, 일곱 Engine 호출, port wiring, Layout props 조립 |
| `src/editor/EditorShellLayout.tsx` | 네 panel과 resize separator 배치. 기능 계산 없음 |
| `src/editor/useEditorShellLayout.ts` | panel resize mouse lifecycle |
| `src/editor/editorShellLayoutConstants.ts` | panel 기본/최소/최대 크기 |
| `src/editor/useEditorHistoryShortcuts.ts` | Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z 전역 listener와 History port 호출 |
이전 Shell controller/features/models와 Editor actions/import/preview/types compatibility 구현은 참조가 없어 삭제됐다.

### Editor State

| 파일 | 책임 |
|---|---|
| `state/useEditorState.ts` | Shell state hook과 공개 Project Commands/History를 조립하고 History restore의 raw/semantic/Preview draft 폐기 port를 Root에 제공 |
| `state/useEditorEngineStateStores.ts` | Project record/master/runtime, Playback, Canvas, Timeline React state와 기본 ON인 `showSelectionGlow` Editor UI state 생성 |
| `state/useEditorSessionState.ts` | selection, 마지막 선택, keyframe, transform/property draft, import feedback |
| `state/useEditorShellLayoutState.ts` | panel 폭/높이와 resize session |

State store는 값을 저장할 뿐 mutation 정책, geometry, rendering, Timeline 계산을 구현하지 않는다.

## 6. Project Engine

공개 경계: `src/engines/project/index.ts`

주요 공개 API:

- `useProjectCommands`, `ProjectCommands`
- `useProjectHistory`, `ProjectHistory`
- `useProjectPsdEngine`
- `useProjectSelectionModel`
- Project constants와 외부에 필요한 PSD/runtime type

### Command와 History

| 파일 | 책임 |
|---|---|
| `useProjectCommands.ts` | 내부 Command Controller를 공개 hook으로 감싼다 |
| `models/projectCommandModel.ts` | Project record bundle과 Command Port 계약 |
| `controllers/useProjectCommandController.ts` | composition/meta/timeline/render record 교체·갱신 command |
| `useProjectHistory.ts` | History state와 Controller를 하나의 공개 hook으로 조립하고 최신 Controller를 가리키는 stable command façade 제공 |
| `state/useProjectHistoryState.ts` | composition별 past/future/pending capture ref |
| `controllers/useProjectHistoryController.ts` | push/undo/redo/begin/dirty/commit/cancel/reset |
| `history/projectHistorySnapshot.ts` | snapshot clone/capture/restore, runtime canvas 참조 보존, restore 시 Editor Draft Runtime 폐기 호출 |

### Selection과 Project 구조

| 파일 | 책임 |
|---|---|
| `useProjectSelectionModel.ts` | hook-local memoized deriver로 master virtual comp, ID map, 현재 selection/meta/items, Properties target를 실제 입력별 안정 reference로 파생 |
| `helpers/projectModelHelpers.ts` | tree 탐색/map/selection 복원/master model/reorder 동기화 |
| `helpers/compositionTreeHelpers.ts` | composition tree 불변 갱신과 timeline 순서 기반 reorder |
| `constants/projectConstants.ts` | master ID/1080×1920, 30fps, 기본 duration, history limit |

### PSD Lifecycle

```text
useProjectPsdEngine
  ├─ usePsdSourceController
  ├─ useProjectNavigationController
  ├─ usePsdImportController
  ├─ usePsdRefreshController
  ├─ usePsdLibraryController
  └─ usePsdSourceSyncController
```

| 영역 | 파일/폴더 | 책임 |
|---|---|---|
| Engine | `useProjectPsdEngine.ts` | 독립 Controller와 source port 조립 |
| Navigation | `controllers/useProjectNavigationController.ts` | selected composition 진입/이동과 새 Group의 History 없는 NEW 승인 |
| Source | `controllers/usePsdSourceController.ts` | file handle 등록/조회/삭제 |
| Import | `controllers/usePsdImportController.ts` | PSD prepare/confirm/cancel, 같은 이름 교체, 원자적 record commit과 prepared runtime 정리 |
| Refresh | `controllers/usePsdRefreshController.ts` | 저장된 Import Settings로 최신 source 재로딩, diff/merge, selection/history 후처리 |
| Library | `controllers/usePsdLibraryController.ts` | main 삭제와 reorder |
| Sync | `controllers/usePsdSourceSyncController.ts` | History 없이 updated/new 승인, deletePending/missing 처리 |
| Preview 분석 | `import/psdImportAnalyzer.ts` | parsed PSD → 전체 Tree/count/중복 표시 이름 Plain Data Plan과 source-node map |
| Source identity | `import/psdSourceIdentityHelpers.ts` | Photoshop layer ID 유일성 검사, stable/legacy source key와 Plain identity 생성 |
| Import settings | `import/psdImportSettingsHelpers.ts` | 기본 설정 생성, legacy/unknown 설정 normalize와 안전한 기본값 적용 |
| Parser | `import/psdParser.ts`, `psdLoader.ts` | File → parsed PSD/document. Preview Prepare는 한 번 parse한 PSD를 runtime store에 보관 |
| Builder | `import/psdCompositionBuilder.ts`, `psdDocumentFactory.ts`, `psdLayerConverter.ts`, `psdImportHelpers.ts` | PSD 또는 확정 Preview Plan + Import Settings → composition/meta/timeline/render records |
| Merge | `helpers/psd/*` | stable identity match, editor 구조 보존, 신규 source 맨 위 삽입, Timeline/Render 동기화와 NEW 상태 승인 |
| Import Plan/runtime | `models/psdImportPlanModel.ts`, `state/preparedPsdImportStore.ts` | Plain Data Plan/result 계약과 token별 parsed PSD runtime 등록·조회·폐기 |
| Runtime model | `models/psdSourceRuntimeModel.ts`, `runtimeRenderModel.ts` | File handle/source와 Canvas drawable/render item |
| Refresh model | `models/psdRefreshResultModel.ts` | 신규 Group/Layer, updated/missing/deletePending과 성공 summary Plain Data 계약 |

## 7. Animation Engine

공개 경계: `src/engines/animation/index.ts`

```text
useAnimationEngine
  ├─ useTransformValueController
  ├─ usePropertyTrackController
  ├─ useKeyframeController
  ├─ useModifierController
  └─ useTransformInputAdapter
       ↓
  Project / Master / Session / History Port
```

| 영역 | 파일/폴더 | 책임 |
|---|---|---|
| Engine | `useAnimationEngine.ts` | Controller 결과를 `AnimationCommands`로 조립 |
| Transform | `controllers/useTransformValueController.ts` | static/animated position/scale/rotation/opacity/anchor 적용 |
| Track | `controllers/usePropertyTrackController.ts` | track on/off, initial keyframe, scale link |
| Keyframe | `controllers/useKeyframeController.ts` | upsert/move/remove/select/save |
| Modifier | `controllers/useModifierController.ts` | 선택 객체의 Modifier 추가·제거·설정 변경과 History 연결 |
| Input adapter | `adapters/useTransformInputAdapter.ts` | Preview/Properties input을 command로 변환 |
| Pure mutation | `actions/animationProjectMutations.ts` | Composition tree 불변 변경. React state 호출 없음 |
| Command model | `models/animationCommandModel.ts` | Project/Master/Session/History port |
| Session model | `models/animationSessionModel.ts` | selected keyframe, transform target/edit mode |
| Constants | `constants/animationConstants.ts` | 지원 animatable property 목록 |
| Track helpers | `helpers/keyframeTrackHelpers.ts`, `keyframeTargetHelpers.ts`, `propertyTrackHelpers.ts` | keyframe/track 순수 조작 |
| Evaluation | `helpers/animationEvaluationHelpers.ts` | frame별 transform 보간과 fallback |
| Modifier registry/evaluation | `modifiers/modifierRegistry.ts`, `helpers/modifierEvaluationHelpers.ts` | 수식 등록·기본값·정규화와 local frame 기반 결정적 wiggle 계산 |
| Frame/selection | `helpers/animationFrameHelpers.ts`, `animationSelectionHelpers.ts` | global/local frame과 selection descriptor |
| Motion/value | `helpers/motionPathSamplingHelpers.ts`, `transformValueHelpers.ts` | motion sample, opacity/rotation 정규화 |

Animation Controller는 History를 구현하지 않고 주입된 History Port만 호출한다.

## 8. Playback & Render Engine

공개 경계: `src/engines/playback-render/index.ts`

### Playback

| 파일 | 책임 |
|---|---|
| `usePlaybackEngine.ts` | playback/range/loop Controller와 read/command 조립 |
| `controllers/usePlaybackController.ts` | play/pause/toggle/seek/step/reset |
| `controllers/usePlaybackRangeController.ts` | composition별 exclusive-end range 정규화 |
| `controllers/usePlaybackLoopController.ts` | frame rate 기반 interval lifecycle과 끝 처리 |
| `helpers/playbackFrameHelpers.ts` | frame clamp/step/advance 순수 계산 |
| `helpers/playbackRangeHelpers.ts` | range 생성/정규화/축소 순수 계산 |
| `models/playbackModel.ts` | Playback state/read/command port와 Renderer Mode Runtime 선택 계약 |
| `timeFormatting.ts` | timeline/compact time 문자열 포맷 |

Playback state 자체는 Shell-owned `useEditorPlaybackState`가 한 번 생성하고 Engine에 Port로 주입한다. Renderer Mode 역시 Project/History가 아니라 이 Playback Runtime state에 속하며, 현재 기본값은 `full-render`다. Preview의 `표시 모드` control은 이 state를 복제하지 않고 기존 `usePlaybackEngine.setRendererMode`만 호출한다.

### Render

| 파일 | 책임 |
|---|---|
| `useRenderEngine.ts` | selected composition/frame/runtime records로 Evaluated Scene을 만든 뒤 mode에 따라 Render Frame 또는 Preview Scene을 반환 |
| `controllers/buildRenderFrame.ts` | 기존 호출 호환 wrapper. Evaluated Scene을 Renderer Mode로 전달하고 RenderFrame을 반환 |
| `helpers/activeTimelineItemHelpers.ts` | global frame에서 active item/local frame/order 계산 |
| `helpers/evaluatedSceneHelpers.ts` | Timeline active/local frame과 Animation helper 결과를 Renderer 독립 Evaluated Scene으로 평가 |
| `helpers/previewSceneUpdateHelpers.ts` | 기존 Preview Scene을 target drag patch 또는 다음 playback frame scene 값으로 immutable 갱신 |
| `helpers/renderTransformHelpers.ts` | Evaluated Scene transform을 Canvas 표시용 origin 포함 transform으로 변환하는 Renderer 공통 helper |
| `helpers/renderSourceHelpers.ts` | Layer/Composition source와 transform evaluation 결합 |
| `models/evaluatedSceneModel.ts` | CanvasImageSource 없는 현재 frame 계산 완료 Runtime Scene 계약 |
| `models/previewSceneModel.ts` | Canvas/bitmap/source 없는 Fast Preview용 Preview Scene과 Layer/Composition Preview Node 계약 |
| `models/renderFrameModel.ts` | logical size와 source가 분리된 Render Frame/Command 계약 |
| `models/renderSourceModel.ts` | original/preview CanvasImageSource, source pixel size와 optional resolver 계약 |
| `models/rendererModeModel.ts` | `full-render` / `fast-render` mode와 renderer 입출력 계약 |
| `models/runtimeMetricPortModel.ts` | Core Render 경로가 Canvas Metrics 구현을 모르고 optional counter만 기록하기 위한 구조적 port |
| `models/previewCanvasRenderModel.ts` | Preview Canvas surface/factory/cache/draw-state/node-bounds 공개 계약 |
| `renderers/rendererMode.ts` | Renderer Mode dispatcher |
| `renderers/accurateRenderer.ts` | Evaluated Scene을 기존 RenderFrame command graph로 변환하는 Accurate Renderer |
| `renderers/fastPreviewRenderer.ts` | Evaluated Scene을 Preview Scene Tree로 변환하는 Fast Preview Renderer |
| `adapters/canvas2dRenderAdapter.ts` | source를 logical destination 크기로 그리고 Preview scale의 backing buffer와 재사용 가능한 중첩 Composition surface를 관리하는 CanvasRenderingContext2D adapter |
| `adapters/canvas2dPreviewSceneAdapter.ts` | 기존 두 공개 draw API를 유지하며 full/skip/dirty 분기, main Canvas clear, metric과 retained draw-state 갱신을 조율하는 entry adapter |
| `adapters/canvas2dPreviewNodeRenderer.ts` | drawable/source fallback, transform, Layer/Composition 재귀 draw, Composition/Surface Cache lifecycle과 원래 node 배열 순서를 담당하는 Canvas2D renderer |
| `adapters/canvas2dPreviewSurfaceAdapter.ts` | pixel scale/size 정규화, offscreen surface 준비와 browser canvas 생성을 격리하는 환경 adapter |
| `helpers/previewSceneDirtyRegionHelpers.ts` | node reference와 이전/현재 bounds, Composition 변화, pixel scale로 full/skip/dirty draw plan을 만드는 순수 helper |

### 최종 Animation Evaluation → Renderer Mode → Canvas 흐름

Dual Renderer Sprint 종료 기준 최종 흐름은 다음과 같다. `RenderFrame`은 Accurate Renderer의 출력 계약으로 유지하고, Fast Preview는 별도 `PreviewScene` 표시 경로와 Playback/drag용 Preview Update Pipeline을 가진다. Renderer Mode는 Playback Runtime이 소유하고, Canvas Render 경로는 Playback이 선택한 mode만 전달받아 표시 경로를 고른다.

```text
useEditorCompositionRoot
  → usePlaybackEngine.currentFrame/playheadFrame
      └─ rendererMode
  → useCanvasComposition
  → useRenderEngine
  → buildEvaluatedScene
      ├─ buildLocalFrameBySourceId
      ├─ getActiveRenderItems
      ├─ evaluateLayer/Composition Position/Scale/Rotation/Opacity
      └─ Evaluated Scene
  → renderWithRendererMode(playback.rendererMode)
      ├─ full-render
      │   → Accurate Renderer
      │       ├─ attach original/preview source
      │       ├─ optional Preview source resolver
      │       └─ RenderFrame commands
      └─ fast-render
          → Fast Preview Renderer
          → Preview Scene
  → useCanvasEngine
  → usePreviewUpdatePipeline
      ├─ Playback frame 변화: 기존 Preview Scene을 다음 frame 값으로 갱신
      └─ Drag 변화: 기존 Preview Scene node transform/opacity draft 갱신
  → useCanvasRenderController
      ├─ RenderFrame이면 renderFrameToCanvas
      └─ Preview Scene이면 pipeline 결과를 renderPreviewSceneToCanvas
  → CanvasRenderingContext2D.drawImage
```

`Evaluated Scene`은 `compositionId`, `globalFrame`, frame size, `localFrameBySourceId`, drawable/composition node의 visibility/order/local frame/transform/opacity/anchor/logical size를 포함한다. `CanvasImageSource`, preview bitmap, preview resolver, original source, `HTMLCanvasElement`, Render Command는 포함하지 않는다.

`Renderer Mode`는 Playback Runtime read/command 계약에 포함된다. 현재 기본값은 `full-render`이며, Preview UI의 `완성본`은 `full-render`, `작업용`은 `fast-render`를 선택한다. Root는 `playbackEngine.rendererMode`와 `playbackEngine.setRendererMode`를 `useCanvasComposition`에 전달하고, Canvas Composition은 이를 `PreviewWorkspacePane` → `PreviewWorkspaceControls` → `PreviewRendererModeControl` props로 투영한다. UI는 주입된 Playback command만 호출한다. Playback은 mode를 소유·선택할 뿐 Animation Evaluation을 직접 수행하거나 Renderer를 생성하지 않는다.

`Accurate Renderer`는 `Evaluated Scene`을 입력으로 받아 `CanvasImageSource`와 Preview resolver 결과를 붙인 `RenderCommand[]`를 만든다. 기존 accurate Canvas 2D adapter는 계속 `RenderFrame`을 소비한다. Resolver가 없으면 original source를 사용하므로 Export의 Original Source 계약을 유지할 수 있다.

`fast-render` mode와 renderer 함수는 `Evaluated Scene`을 `Preview Scene`으로 변환한다. `Preview Scene`은 Layer/Composition Preview Node, parent/children, transform, opacity, visibility, order, local/global frame, logical size와 identity만 가진다. Canvas, drawImage, bitmap, resolver, CanvasImageSource, HTMLCanvasElement, RenderCommand는 포함하지 않는다.

Preview Scene 표시 경로의 공개 entry는 `canvas2dPreviewSceneAdapter.ts`다. Entry는 retained draw state로 full/skip/dirty plan을 선택하고 main Canvas clear, metrics와 draw-state 갱신만 조율한다. 순수 plan 계산은 `previewSceneDirtyRegionHelpers.ts`, 실제 `LayerPreviewNode`/`CompositionPreviewNode` 재귀 draw와 cache/surface lifecycle은 `canvas2dPreviewNodeRenderer.ts`, pixel size와 browser surface 생성은 `canvas2dPreviewSurfaceAdapter.ts`가 담당한다. Layer는 source resolver 또는 original source를 logical size로 그리고, Composition Cache miss이면 Surface Cache에서 작업 surface를 acquire해 자식을 먼저 그린 뒤 Composition node의 transform/opacity/visibility를 적용해 부모 context에 표시한다. Preview Scene 자체는 여전히 Canvas, drawImage, bitmap, resolver, HTMLCanvasElement를 모른다.

Task 6에서는 정확한 Composition 표시 구조를 구현했고, Sprint 99 Task 5에서 Composition Cache, Task 6에서 Surface Cache, Task 8에서 retained canvas 기반 drawImage 최소화를 추가했다.

Preview Update Pipeline은 `usePreviewUpdatePipeline.ts`가 담당한다. Pipeline은 Canvas 표시 경로에서 Renderer를 다시 호출하지 않고 기존 `PreviewScene`을 갱신한다. `full-render` mode에서는 평상시 `RenderFrame` 표시를 유지하고 Preview node tree를 만들지 않는다. 첫 drag update가 들어올 때만 최신 `Evaluated Scene`을 가진 lazy resolver가 draft base를 1회 생성하고, 같은 drag의 후속 PointerMove는 현재 draft를 재사용한다. Playback frame 변화와 Canvas drag draft 결과는 Dirty State 판정 뒤 Node Cache를 통과한다. Dirty가 없는 `PreviewNode.id`는 기존 Layer/Composition Preview Node reference를 유지하고, Dirty가 있는 node만 새 reference로 교체한다. PointerMove는 Animation Evaluation/Fast Preview Renderer를 호출하지 않고 Pipeline command만 호출한다. Pipeline 결과는 `useCanvasRenderController`로 전달되고, Preview Scene 표시 adapter는 Node Cache 이후 Composition Cache와 Surface Cache를 조회한다. Canvas Adapter는 retained draw state를 사용해 dirty bounds와 겹치지 않는 clean top-level node의 `drawImage`를 생략한다.

Runtime Metrics는 Canvas Preview Runtime이 소유하는 Runtime Resource다. Project Plain Data, History snapshot, Export에는 저장하지 않는다. Metrics는 Global Counter와 Frame Snapshot을 분리하고, `increment` / `resetFrame` / `resetGlobal` / snapshot read API를 제공한다. Performance QA 요청 시에만 쓰는 Sprint Baseline / Task Baseline 저장과 비교 API도 Runtime Resource 안에만 존재한다. Baseline 비교는 Current와 Baseline의 difference와 percent를 계산하지만 평소 QA에서 자동 실행하지 않는다. Render Engine과 Canvas adapter는 `RuntimeMetricRecordPort`라는 optional 구조적 port만 알며, 실제 Metrics 구현은 Canvas Engine 안에 있다. 현재 계측 대상은 Animation Evaluation, Fast/Accurate Renderer, Preview Scene generation/update, updated/reused/dirty/frame-dirty node, playback dirty/clean/updated/reused/composition-reused/frame-update-time, composition render/cache hit/miss/create/reuse, surface create/reuse/dispose/active/pool-size, `drawImage`, drawImage skipped, layer draw, composition draw, canvas draw time, project update, history commit이다.

Dirty State는 Canvas Preview Runtime이 소유하는 Runtime Resource다. Preview Scene 계약을 바꾸지 않고 Preview Scene을 Dirty Snapshot으로 변환해 이전 snapshot과 비교한다. Dirty 종류는 Transform / Opacity / Visibility / Hierarchy / Order / Source / Frame / Logical Size / Composition으로 독립 구분한다. Dirty 대상은 Layer / Composition / Preview Scene이다. `usePreviewUpdatePipeline`은 base scene 변화와 drag transform/opacity draft 결과를 Dirty State에 반영하고, Dirty Summary를 Runtime Metrics의 Dirty Node / Frame Dirty counter에 연결한다. Dirty 정보는 Project Plain Data, History, Export에 저장하지 않으며 Node Cache의 reference 재사용 판정에 사용한다. Composition Cache, Surface Cache, drawImage 최소화는 Dirty/Node reference 결과를 소비하지만 Dirty State 계약을 변경하지 않는다.

Node Cache는 Canvas Preview Runtime helper가 담당한다. `PreviewNode.id`를 cache key로 사용하고, Dirty State가 clean으로 판정한 Layer/Composition Preview Node는 이전 reference를 그대로 재사용한다. Dirty가 있는 node는 정확성을 우선해 새 Preview Node reference로 교체한다. Composition node는 자식 reference가 바뀌었는데 부모만 stale reference로 남지 않도록 children reference도 함께 확인한다. Node Cache 결과는 Runtime Metrics의 Preview Node Updated / Preview Node Reused counter로 측정하며 Project Plain Data, History, Export에는 저장하지 않는다.

Composition Cache는 Canvas Preview Runtime Resource다. Composition Preview Node id, logical size, preview quality, preview scale, `fast-render` renderer mode, runtime id로 key를 만들고, 같은 key와 같은 Composition Preview Node reference일 때만 기존 합성 surface를 재사용한다. Node Cache가 clean Composition reference를 유지하면 cache hit가 가능하고, Composition Dirty / child dirty / logical size / preview quality / preview scale 변화는 miss가 되어 새 합성 결과를 만든다. Composition Cache는 Preview Scene, Dirty State, Node Cache 계약을 변경하지 않고 Project Plain Data, History, Export에도 저장하지 않는다.

Surface Cache는 Canvas Preview Runtime Resource다. Logical width/height, preview quality, preview scale, pixel width/height로 key를 만들며 Composition id는 key에 포함하지 않는다. Composition Cache hit이면 새 surface를 요청하지 않고, miss이면 Surface Cache에서 작업 surface를 acquire한다. 같은 조건의 유휴 surface가 있으면 재사용하고 없으면 새 Canvas surface를 만든다. Composition Cache가 stale result surface를 내려놓으면 Surface Cache pool로 반환하고, pool limit을 넘으면 오래 사용하지 않은 surface부터 dispose한다. Surface Cache는 Preview Scene, Composition Cache 공개 계약, Dirty State, Node Cache, Accurate Renderer, Export를 변경하지 않는다.

Playback Dirty Update는 Fast Preview Renderer가 담당한다. `useRenderEngine`은 Project나 History에 저장하지 않는 Runtime Resource로 직전 Fast Preview Scene을 보관하고, frame 변화 시 `renderFastPreviewRenderer`에 전달한다. Renderer는 `Evaluated Scene`의 계산 완료 결과와 직전 Preview Scene을 비교해 표시 결과가 같은 Layer/Composition Preview Node reference를 그대로 유지한다. Frame 번호만 바뀌었지만 transform / opacity / visibility / hierarchy / order / source / logical size가 같으면 clean node로 처리하고, Keyframe/Modifier 결과처럼 표시 결과가 달라진 node만 새 reference로 만든다. Composition node는 자식 reference가 바뀌면 parent도 dirty로 간주한다. 첫 Fast Preview 생성 또는 composition 변경 때만 Preview Scene generation으로 보고, 이후 playback frame update는 Playback Dirty/Clean/Updated/Reused metrics로 측정한다. Composition Cache는 clean Composition reference가 유지될 때 hit하고, Composition Cache hit이면 Surface Cache를 새로 acquire하지 않는다.

drawImage 최소화는 `useCanvasRenderController.ts`가 소유한 Preview Canvas retained draw state를 Playback Render의 분리된 표시 경로가 소비해 수행한다. `previewSceneDirtyRegionHelpers.ts`가 직전 Preview Scene / node bounds / pixel scale을 비교해 full/skip/dirty plan을 만들고, `canvas2dPreviewSceneAdapter.ts`는 dirty bounds만 clear한 뒤 `canvas2dPreviewNodeRenderer.ts`에 겹치는 top-level node draw를 요청한다. 겹치지 않는 clean Layer / Composition은 `drawImage`를 생략하고 DrawImage Skipped metric을 올린다. Clean Composition이 다시 표시되어야 하면 Composition Cache hit surface를 사용하므로 자식 Layer를 다시 `drawImage`하지 않는다. Accurate Renderer, Export, Preview Scene 계약, Composition Cache 계약, Surface Cache 계약은 변경하지 않는다.

Stress Test는 `scripts/verifyPreviewStressTest.ts`가 담당한다. 이 script는 새 기능을 추가하지 않고 Preview Runtime Resource의 장시간 안정성을 검증한다. 검증 범위는 10000 frame playback, retained canvas 반복 draw, 300 Composition / 1000 Layer 대형 scene, Preview Quality 반복 변경, Import / Refresh / Delete 유사 source set 반복, Composition/Surface/Preview Bitmap cache dispose다. Memory는 Runtime tracked bytes 기준으로 peak / final을 확인하고, final preview cache bytes가 0으로 회수되는지 검증한다. 이 stress script는 Dirty State, Node Cache, Composition Cache, Surface Cache, Playback Dirty Update, drawImage 최소화의 연결 상태를 통합 확인한다.

Performance QA는 `scripts/verifyPreviewPerformanceQa.ts`가 담당한다. Sprint Baseline API로 시작 기준을 runtime에 저장한 뒤 현재 Runtime Metrics와 비교한다. 400 frame 기준 Preview Scene Generation은 400 → 1, Composition Cache Miss는 400 → 15, Surface Create는 400 → 15, `drawImage`는 2000 → 87로 감소하고 `drawImageSkipped`는 1895회 기록된다. 이 결과는 Sprint 99 완료 문서 `44_preview_runtime_optimization.md`에 영구 기록한다.

Canvas visual direct selection은 `useRenderEngine.evaluatedScene`의 top-level drawable/composition node만 candidate 원본으로 사용한다. Full/Fast Renderer 결과인 `RenderFrame`/`PreviewScene`은 selection identity나 alpha 의미에 관여하지 않는다. Candidate는 active Timeline item과 runtime Render item을 source/kind/target/render identity로 exact join하며 중복 Timeline/Render, split scene identity, reorder mismatch는 blocked로 남겨 alpha readback, fallthrough, clear와 drag를 수행하지 않는다. Hit는 scene node 배열의 역순으로 평가해 실제 painter order를 유지한다.

Source Alpha는 source-local pixel plane이고 viewport 위치는 별도 Projection이다. Layer는 원본 drawable canvas와 opacity를, Sub Composition은 ordered child source alpha와 evaluated child transform/opacity/visibility/order를 합성한다. 정적 PSD는 stable frame visual key를 사용하므로 local frame 숫자만 바뀌어도 rebuild하지 않는다. Source canvas/fingerprint/revision, 명시적 frame visual key, logical size, opacity/visibility 또는 SubComp child visual/transform/order가 바뀔 때만 fingerprint가 달라진다. Position/Scale/Rotation/Anchor/Transform Offset과 zoom/pan은 Projection만 바꾸며 같은 alpha entry를 재사용한다.

Pointer 우선순위는 viewport capture의 middle/Space pan, Handle/Anchor/MotionPath의 전용 cursor와 propagation 차단, Preview toolbar/form control 제외 뒤에 viewport body direct selection이 온다. Selection rectangle polygon/fill/stroke와 두 diagonal 및 quad 전체를 가로채던 hit layer는 없다. Viewport body가 Layer/SubComp 공용 Alpha hit를 수행하며 alpha-ready pixel 위 hover만 `pointer`, 투명/none/blocked/unavailable은 `default`를 사용한다. Position/Scale/Rotation/Anchor/Opacity 중 하나라도 Transform Drag 중이면 stale hover를 즉시 clear하고 hover `moveTarget`과 provider get/build/readback을 실행하지 않는다. Scale은 명시적 drag state를 가지며 Motion Path interaction도 같은 lock을 따른다. 실제 Position drag 중에는 `grabbing`이고 middle/Space pan의 `grab`/`grabbing`과 Handle/Anchor 전용 cursor가 alpha hover cursor보다 우선한다. 선택된 exact item의 visible-alpha hit만 기존 Position drag를 시작하고, 다른 item hit는 selection만 변경한다. 성공적으로 모든 candidate를 통과한 빈 영역은 selection을 clear한다. Alpha unavailable 또는 ambiguous blocked candidate는 현재 selection을 보존한다.

Viewport body 더블클릭은 같은 candidate/identity/공용 Alpha hit를 다시 사용한다. 두 번째 `mousedown`은 `event.detail >= 2`에서 기존 Position press를 시작하지 않고, ready hit가 immediate Sub Composition일 때만 Project Engine의 기존 `enterComposition()`을 호출한다. 일반 Layer, 투명 pixel, 빈 공간, blocked/unavailable candidate에서는 진입하지 않는다. Handle/Anchor/Motion Path와 Pan/Transform drag 우선순위는 더블클릭에서도 유지한다.

선택 glow는 direct selection과 같은 ready candidate, provider entry, visual fingerprint, alpha threshold와 Projection을 사용한다. 기본 ON인 plain Editor UI state `showSelectionGlow`를 Preview toolbar의 `선택 강조` 버튼(`aria-pressed`)이 전환한다. OFF 전환은 provider의 selected retain entry와 renderer의 selected source scratch를 해제하고 target backing을 1×1로 축소하며, 선택 대상 provider get/retain/draw를 수행하지 않는다. Direct selection hit/hover는 그대로 동작한다. ON 전환은 기존 exact-selected candidate와 공용 Source Alpha lifecycle을 다시 실행해 자연스럽게 rebuild/redraw한다. 선택된 fingerprint 하나에 대해서만 source scratch canvas를 유지하며 full interaction viewport 크기의 DPR backing canvas에 blur한 mask를 투영한 뒤 같은 mask를 `destination-out`으로 빼 내부를 제거한다. Hover hit는 같은 provider의 제한된 cache를 쓰되 ready hit를 retain하지 않고 transparent miss만 release하므로 selected glow retain entry를 축출하지 않는다. Overlay 순서는 Preview Canvas → Glow → Motion Path → Gizmo Handle/Anchor/Pivot/connection/readout이며 Glow는 pointer event를 받지 않는다. Selection rectangle polygon과 diagonal은 표시하지 않는다. 자세한 구조와 안전 차단 정책은 `48_canvas_visual_layer_selection.md`에 기록한다.

### Renderer Runtime Verification

Dual Renderer Sprint Task 10 기준 Runtime 경계가 정리됐고, Sprint 99 Task 1에서 drag move와 Project commit 경로를 분리했다. 현재 실제 Runtime 흐름은 다음과 같다.

Drag 표시 경로:

```text
Canvas pointer move
  ← useRenderEngine.evaluatedScene
  → useCanvasPointerController
  → requestAnimationFrame 단위 sample 병합
  → useCanvasTransformComposer
  → 동작별 drag controller.onMove
      └─ useCanvasTransformDraftController.updateTransform()
          → usePreviewUpdatePipeline
          → 첫 update에서만 lazy drag seed 생성
          → updatePreviewSceneNodeTransform()
          → `fast-render` scene 또는 `full-render` drag seed node patch
  → useCanvasRenderController
  → renderPreviewSceneToCanvas 또는 renderFrameToCanvas
```

Drag move는 Project state를 변경하지 않는다. 동작별 drag controller는 최신 Position / Scale / Rotation / Opacity / Anchor 값을 Runtime draft로만 보관하고, Draft controller를 통해 Preview Update Pipeline에 transform/opacity patch를 전달한다.

Drag commit 경로:

```text
PointerUp
  → 동작별 drag controller.onCommit
      ├─ 최종값 1회 Animation command apply*
      ├─ history.markDirty()
      ├─ previewUpdates.reset()
      └─ history.commit()
  → Project state update
  → useRenderEngine 재계산 가능
  → Renderer Mode
  → Canvas
```

Escape / pointer cancel은 Preview draft를 제거하고 `history.cancel()`만 호출한다. Project state는 변경하지 않는다. 따라서 drag move는 Animation Evaluation과 Fast Preview Renderer를 재호출하지 않고, PointerUp commit 이후에만 Project update와 History commit을 수행한다.

Playback Fast Preview 경로:

```text
Playback currentFrame 변경
  → useRenderEngine
  → buildEvaluatedScene()
  → renderWithRendererMode("fast-render")
  → renderFastPreviewRenderer(previousPreviewScene)
  → 변경된 Preview Node만 새 reference로 갱신
  → usePreviewUpdatePipeline
  → Dirty State / Node Cache / Composition Cache / Surface Cache 경계 유지
  → renderPreviewSceneToCanvas
```

Playback은 frame 변화마다 Animation Evaluation 정확성을 유지하기 위해 `Evaluated Scene`은 계산한다. 다만 Fast Preview Renderer는 직전 Preview Scene을 입력으로 받아 표시 결과가 달라지지 않은 node reference를 재사용하므로, 전체 Preview Scene node를 매 frame 새로 만들지 않는다. Preview Scene wrapper는 global frame 변경 때문에 새 객체가 될 수 있지만 clean Layer/Composition node reference는 유지된다. 따라서 Node Cache, Composition Cache, Surface Cache가 playback에서도 유지된다.

Accurate 경로:

```text
Playback currentFrame 변경
  → useRenderEngine
  → buildEvaluatedScene()
  → renderWithRendererMode("full-render")
  → renderAccurateRenderer()
  → RenderFrame
  → renderFrameToCanvas
```

Accurate Renderer는 Fast Preview Runtime의 Pipeline state를 사용하지 않는다. `full-render` mode의 평상시 출력은 계속 `RenderFrame`이며 Preview draft node tree 생성 횟수는 0이다. 첫 drag update 때만 같은 `Evaluated Scene`에서 runtime-only draft base를 lazy 생성해 Preview Pipeline으로 활성화한다. Fast Preview도 Accurate Renderer의 `RenderFrame`에 의존하지 않는다. 두 경로가 공유하는 것은 `Evaluated Scene`, source resolver 계약, Canvas source lookup뿐이다.

현재 cache/retained draw 적용 경계:

- Dirty Cache: `useRenderEngine`의 `evaluatedScene`과 `rendererResult`, 또는 `updatePreviewSceneFromPlaybackFrame()` 앞뒤의 변경 판정 경계
- Node Cache: `PreviewNode.id` 기반 `updatePreviewNodeFromPlaybackFrame()` / `updatePreviewSceneNodeTransform()` 경계
- Composition Cache: `canvas2dPreviewNodeRenderer.ts`에서 Composition children을 surface에 그려 부모 context에 합성하는 경계
- Surface Cache: `canvas2dPreviewNodeRenderer.ts`의 acquire/release와 `canvas2dPreviewSurfaceAdapter.ts`의 browser surface factory 경계

### Renderer 결과 비교 QA

Dual Renderer Sprint Task 11~12 종료 기준 검증 결과는 다음과 같다.

- Fast Preview와 Accurate Renderer는 같은 `Evaluated Scene`을 입력으로 받는다.
- Position, Scale, Rotation, Opacity, Visibility, Hierarchy, Layer Order, Composition 결과, Timeline local/global frame은 Evaluated Scene 기준으로 일치한다.
- Preview Quality와 source resolver는 source pixel size와 image 선택만 바꾸며 Animation 결과를 바꾸지 않는다.
- Resolver가 없거나 null을 반환하면 original source fallback이 유지된다.
- Accurate Runtime은 `RenderFrame`을 출력하고, Fast Preview Runtime은 `Preview Scene`을 출력한다.
- 두 Runtime의 차이는 표시 방식이며, Animation 계산은 Renderer 내부에서 반복하지 않는다.
- Engine Import Boundary, Runtime/Plain Data 경계, Preview Quality, Memory Cache, PSD Import, History, Timeline, Properties, Canvas regression QA가 통과했다.

Preview Runtime Optimization Sprint는 종료됐으며 결과는 `44_preview_runtime_optimization.md`에 승격했다. 다음 Sprint가 결정되기 전까지 `98_sprint_plan.md`는 대기 상태를 유지한다.

## 9. PSD Tree Engine

공개 경계: `src/engines/psd-tree/index.ts`

| 파일/폴더 | 책임 |
|---|---|
| `usePsdTreeEngine.ts` | picker/import dialog/source/selection/reorder Controller와 ViewModel을 조립하고 Draft-only root render에서 안정 ViewProps 유지 |
| `controllers/usePsdPickerController.ts` | import 파일 선택 뒤 Prepare, refresh picker intent |
| `controllers/usePsdImportDialogController.ts` | Plan session의 Prepare 완료, Confirm/Cancel, node 이동 intent와 분석 중 Cancel 경합 정리 |
| `controllers/useSourceActionController.ts` | refresh/delete action과 성공 summary 1회 session 반영 |
| `controllers/useTreeSelectionController.ts` | composition 선택 intent |
| `controllers/useTreeReorderController.ts` | drag/drop order intent |
| `state/usePsdTreeState.ts` | picker/main drag, Import Plan/Dialog와 최근 Refresh summary UI session state |
| `adapters/psdFilePickerAdapter.ts` | File System Access API와 file input fallback |
| `helpers/psdTreeDropHelpers.ts` | drop 위치와 order 순수 계산 |
| `helpers/psdTreeViewModelHelpers.ts` | Project tree → node ViewModel |
| `helpers/psdImportPlanTreeHelpers.ts` | Preview node 불변 reorder/reparent, 순환 방지, 부모별 중복 이름 재계산 |
| `models/psdTreeModel.ts` | read/command/selection port와 ViewProps |
| `features/psdtree/components/PsdTree.tsx`, `PsdTreeNode.tsx` | memo 경계 안에서 편집기 tree와 Group NEW 배지를 렌더하고 실제 선택 intent 전달 |
| `features/psdtree/components/PsdImportPreviewDialog.tsx`, `PsdImportPreviewNode.tsx` | PSD 정보/전체 Preview Tree/빨간 중복 이름/drag/drop/Confirm/Cancel 렌더 |
| `features/psdtree/components/PsdRefreshSummaryCard.tsx` | Refresh 여섯 개 결과/무변경 표시와 수동·8초 자동 닫기 비모달 카드 |

## 10. Canvas Engine과 Preview View

공개 경계: `src/engines/canvas/index.ts`

```text
useCanvasComposition
  ├─ useRenderEngine
  └─ useCanvasEngine
      ├─ useCanvasViewportEngine
      ├─ Guide/Selection/Render Controller
      ├─ Pointer/Motion Controller
      ├─ Direct Selection/Source Alpha/Glow Controller
      ├─ Transform Composer
      │   └─ Position/Scale/Rotation/Opacity/Anchor/Arrow/Draft Controller
      └─ Gizmo Controller
           ↓
      PreviewWorkspacePane ViewProps
```

### 조립, Composer와 Controller

| 파일 | 책임 |
|---|---|
| `useCanvasComposition.ts` | Project 원본 source를 Canvas Preview runtime에 전달하고 resolver가 적용된 Render/Canvas와 Playback Renderer Mode read/command를 Preview props에 연결 |
| `useCanvasEngine.ts` | 독립 Canvas Controller와 Transform Composer 조립, Editor Session-owned Draft Transform Snapshot 주입, pointer/overlay/gizmo와 외부 Draft command 연결 |
| `useCanvasPreviewRuntime.ts` | quality 예상/선택, generation build, atomic resolver 전환, Cache/Dirty/Metrics runtime resource와 unmount lifecycle 조립 |
| `useCanvasViewportEngine.ts` | viewport/workspace/pan Controller 조립 |
| `controllers/useCanvasViewportController.ts` | zoom/reset/1:1/pointer zoom |
| `controllers/useCanvasWorkspaceController.ts` | workspace ResizeObserver lifecycle |
| `controllers/useCanvasPanController.ts` | pan pointer/keyboard modifier lifecycle |
| `controllers/useCanvasGuideController.ts` | shortform/safe-zone guide read/command |
| `controllers/useCanvasSelectionController.ts` | selected Layer/Composition overlay read model과 Draft Snapshot 기반 selection overlay 전환 |
| `controllers/useCanvasDirectSelectionController.ts` | static identity/descriptor, viewport projection, scoped selected Draft overlay의 독립 memo 경계와 공용 Source Alpha Provider, direct-selection single/double-click pointer intent, enable/release 가능한 selected-only glow lifecycle 및 source 교체/unmount cleanup 조립 |
| `controllers/useCanvasRenderController.ts` | Render Frame 또는 Preview Scene pipeline 결과와 active Preview scale을 Canvas Adapter에 전달하고 중첩 surface pool을 frame/unmount 단위로 정리 |
| `controllers/useCanvasPointerController.ts` | global pointer session/listener와 frame 단위 최신 pointer sample 전달 조립 |
| `composers/useCanvasTransformComposer.ts` | 공통 pointer context를 만들고 Transform Controller 7개를 조립해 기존 7개 command를 구성하는 Transform Input Composer |
| `controllers/useCanvasTransformDraftController.ts` | 직전 accepted semantic snapshot과 같은 transform patch를 공통 차단하고 변경된 `DraftTransformSnapshot`과 Preview Scene draft만 같은 순서로 반영·reset하는 동기화 경계 |
| `controllers/useCanvasPositionDragController.ts` | Position 시작 frame/base 평가와 begin/move/commit/cancel transaction |
| `controllers/useCanvasScaleDragController.ts` | Scale PointerDown world 위치를 현재 값의 100% baseline으로 캡처하고 이후 축 투영 거리의 상대 배율, Shift snap, draft/readout과 begin/move/commit/cancel transaction 처리 |
| `controllers/useCanvasRotationDragController.ts` | pointer angle, Shift snap, rotation draft/readout과 begin/move/commit/cancel transaction |
| `controllers/useCanvasOpacityDragController.ts` | screen-space Anchor 거리 25~50px를 0~100%로 선형 매핑하는 radial Opacity, Shift snap, draft/readout과 begin/move/commit/cancel transaction |
| `controllers/useCanvasAnchorTransformController.ts` | Canvas Anchor drag와 Properties Anchor live draft가 공유하는 clamp/transformOffset 보정/command transaction |
| `controllers/useCanvasArrowNudgeController.ts` | editable target을 제외한 전역 Arrow key의 `history.push` 기반 즉시 Position command |
| `controllers/useCanvasMotionPathController.ts` | 선택 target/item/local frame과 Position/Anchor/TransformOffset `DraftTransformSnapshot` scope를 검증하고 duration geometry sampling과 current-frame 표식을 독립 memo 경계로 유지하며 point/keyframe drag interaction 처리 |
| `controllers/useCanvasGizmoController.ts` | radial handle geometry, Motion Path viewport projection/polyline, hover·hit point ViewModel과 readout/cursor를 독립 memo 경계로 조립 |
| `controllers/buildPreviewCacheGeneration.ts` | 제한된 동시성으로 Factory 요청, Cache hit/commit, generation progress와 stale 결과 조립 |
| `controllers/usePreviewUpdatePipeline.ts` | `fast-render` scene 또는 `full-render` mode의 lazy Evaluated Scene drag seed에서 transform/opacity draft를 갱신하며 Dirty State/Metrics와 Node Cache를 연결하는 Canvas Runtime pipeline |
| `state/compositionPreviewCacheStore.ts` | Preview Runtime 전용 Composition 합성 결과 cache와 begin/end frame, hit/store/dispose API |
| `state/dirtyStateStore.ts` | Preview Runtime 전용 Dirty State Resource와 update/clear/reset/query API |
| `state/previewSurfaceCacheStore.ts` | Preview Runtime 전용 Composition 작업 surface pool과 acquire/release/dispose API |
| `state/runtimeMetricsStore.ts` | Preview Runtime 전용 Global Counter/Frame Snapshot Metrics Resource와 Sprint/Task Baseline runtime 저장소 |

Transform Input의 의존 흐름은 다음과 같다. 각 전용 controller가 자기 History transaction 순서를 소유하며 History 저장소와 Project mutation 구현은 계속 주입된 port 뒤에 있다.

```text
Preview UI / Gizmo
  → useCanvasTransformComposer
      ├─ Position / Scale / Rotation / Opacity / Anchor drag controller
      │   ├─ move: property draft와 interaction state
      │   ├─ useCanvasTransformDraftController
      │   │   ├─ Editor DraftTransformSnapshot
      │   │   └─ usePreviewUpdatePipeline → Preview Scene draft
      │   └─ commit/cancel: Animation command + Project History port
      └─ useCanvasArrowNudgeController
          └─ history.push + Position command

Properties Anchor input
  → 기존 CanvasTransformDraftCommands 공개 경계
  → useCanvasAnchorTransformController
  → useCanvasTransformDraftController
```

Preview Canvas Render의 의존 흐름은 다음과 같다. Canvas Engine은 Playback Render를 호출하지만 Playback Render는 Canvas Engine이나 Overlay/UI를 import하지 않는다.

```text
useCanvasRenderController
  ├─ retained PreviewCanvasDrawState
  ├─ Composition/Surface Cache frame lifecycle
  └─ canvas2dPreviewSceneAdapter
      ├─ previewSceneDirtyRegionHelpers → full/skip/dirty plan
      ├─ canvas2dPreviewNodeRenderer → Layer/Composition draw + cache lifecycle
      └─ canvas2dPreviewSurfaceAdapter → pixel size + browser surface
```

### Helper/Model/Adapter

- `helpers/canvasViewportHelpers.ts`: zoom/pan/fit/pointer 좌표
- `helpers/canvasCoordinateHelpers.ts`: world/canvas transform와 anchor 보정
- `helpers/canvasGuideHelpers.ts`: 9:16/safe-zone guide
- `helpers/previewDraftBaseSceneHelpers.ts`: `full-render` mode 첫 drag update까지 Preview draft base 생성을 미루고 resolver당 1회 결과를 재사용하는 Runtime helper
- `helpers/draftTransformRuntimeHelpers.ts`: Project/evaluate transform과 draft patch를 병합해 Canvas Draft Transform Snapshot, semantic equality, Preview Scene patch, overlay-facing runtime 값, Selection overlay geometry, 공통 local-anchor clamp/보정 command를 만드는 Runtime helper
- `helpers/canvasSelectionHelpers.ts`: Layer/Sub Composition selection overlay
- `helpers/canvasDirectSelectionCandidateHelpers.ts`: 사전 구축한 Timeline/Render/Scene/drawable index로 Evaluated Scene top-level Layer/SubComp identity와 static descriptor를 exact join하고 ambiguous duplicate/split/reorder를 blocked 처리한 뒤, viewport projection과 scoped selected Draft spatial Projection/root opacity만 단계적으로 적용하는 순수 helper
- `helpers/canvasDirectSelectionGeometryHelpers.ts`: source↔viewport affine matrix, signed inverse, transformed quad/bounds와 negative scale을 포함한 point-in-quad 계산
- `helpers/canvasDirectSelectionHitHelpers.ts`: reverse painter order의 Bounds → Quad → 공용 Alpha entry → source-local sample 흐름, selection/hover cache mode, drag/select/clear/preserve intent, immediate Sub Composition 진입 대상과 viewport cursor 우선순위 계산
- `helpers/canvasSelectionAlphaFingerprintHelpers.ts`: source canvas token, source/revision/frame visual key, visibility/logical size와 SubComp ordered child visual/transform을 포함하되 top-level positive opacity만 동일 shape로 분류하는 결정적 fingerprint
- `helpers/selectionSourceAlphaProvider.ts`: 최대 2개 ready entry, failure memo, retain/release/clear/dispose를 소유하는 Canvas Editor-only Source Alpha Provider
- `helpers/canvasSelectionGlowHelpers.ts`: exact selected ready candidate 조회, 같은 provider entry 선택, threshold mask와 DPR-aware outer-glow draw plan 계산
- `helpers/canvasPointerHelpers.ts`: pointer session 초기 상태와 좌표
- `helpers/canvasPointerFrameHelpers.ts`: 같은 animation frame의 pointer sample을 최신 값 하나로 병합하고 commit 전에 마지막 sample을 flush하는 scheduler
- `helpers/canvasInteractionHelpers.ts`: drag delta, snap, clamp, readout과 공통 Transform Drag active/viewport hover gate
- `helpers/canvasMotionPathHelpers.ts`: Project Position/keyframe과 기존 scoped `DraftTransformSnapshot | null`을 직접 받아 Commit 의미와 같은 base/keyframe 입력을 기존 Animation Evaluation/Modifier/transform geometry로 재평가한 공통 motion path point geometry
- `helpers/previewMemoryHelpers.ts`: source pixel size 기반 품질별 RGBA bytes 추정, stable source dedupe와 B/KB/MB/GB formatter
- `helpers/previewCacheKeyHelpers.ts`: stable source identity/fingerprint/quality/logical size 기반 결정적 cache key
- `helpers/previewAutomaticQualityHelpers.ts`: device memory/override budget과 품질별 예상 bytes만 사용하는 결정적 자동 품질 정책
- `helpers/compositionCacheKeyHelpers.ts`: Composition Preview Node id/logical size/quality/scale/renderer mode 기반 cache key helper
- `helpers/surfaceCacheKeyHelpers.ts`: logical/pixel size, preview quality, preview scale 기반 Composition 작업 surface cache key helper
- `helpers/dirtyStateHelpers.ts`: Preview Scene → Dirty Snapshot 변환, Dirty 종류별 diff, Summary 생성 helper
- `helpers/nodeCacheHelpers.ts`: Dirty State 결과를 기준으로 변경 없는 Preview Node reference를 재사용하고 dirty node만 새 reference로 교체하는 Runtime helper
- `helpers/runtimeMetricsHelpers.ts`: Runtime Metrics counter 초기화, safe record port adapter, Expected/Actual 비교와 Baseline difference/percent helper
- `models/dirtyStateModel.ts`: Dirty 종류, Layer/Composition/Scene snapshot, Dirty State Resource와 Summary 계약
- `models/compositionCacheModel.ts`: Composition Cache key/result/runtime snapshot 계약
- `models/nodeCacheModel.ts`: Node Cache updated/reused stats와 result 계약
- `models/surfaceCacheModel.ts`: Surface Cache acquire input, key input, runtime snapshot 계약
- `models/runtimeMetricsModel.ts`: Runtime Metrics counter 이름, Global/Frame snapshot, Sprint/Task Baseline comparison, Expected Metrics와 비교 결과 계약
- `helpers/previewBuildSourceHelpers.ts`: Project runtime drawable을 stable identity 기준 고유 source로 변환하고 fingerprint 기반 build source-set key와 lifecycle 유지 cache key 생성
- `helpers/previewResolverHelpers.ts`: 활성 sourceId→cache key map을 Render preview source resolver로 변환
- `helpers/previewRenderFrameHelpers.ts`: 현재 Render Frame이 사용하는 drawable source ID 수집
- `helpers/previewQualityControlHelpers.ts`: 품질별 예상 memory와 실제 active 품질을 Preview control Plain Data ViewModel로 변환
- `factories/previewBitmapFactory.ts`: 원본 canvas를 변경하지 않고 별도 Preview runtime resource를 생성하며 실패를 결과로 반환
- `helpers/canvasGizmoGeometryHelpers.ts`, `canvasGizmoHelpers.ts`: Anchor 중심 radial handle geometry와 Motion Path viewport point/polyline, hover·hit point ViewModel의 분리된 순수 계산. W=`x`, H=`y`, WH=`xy` 기존 Scale command에 매핑하고 Scale/Rotation은 50px, Opacity는 현재 Draft-aware 값에 따라 25~50px screen-space 반지름에 배치
- `models/canvasEngineModel.ts`: viewport/guide/selection/read port
- `models/canvasInteractionModel.ts`: pointer/gizmo/motion session/command와 명시적 Scale drag 상태 port
- `models/canvasTransformControllerModel.ts`: Transform Input이 주입받는 History/Animation/Preview/Draft port와 기존 공개 options/command 타입
- `models/canvasViewModel.ts`: overlay/handle/motion point view type
- `models/canvasDirectSelectionModel.ts`: ready/blocked candidate, 공용 source↔viewport Projection, hit result/pointer intent와 controller-local hover ViewModel 계약
- `models/canvasSelectionAlphaModel.ts`: Layer/SubComp Source Alpha descriptor, `alphaBytes`/sample entry, unavailable reason, provider와 browser adapter 계약
- `models/canvasSelectionGlowModel.ts`: selected glow canvas attach ViewModel, draw input/result와 renderer adapter 계약
- `models/previewQualityModel.ts`: Preview quality preference/resolved Plain Data 계약
- `models/previewMemoryModel.ts`: Canvas-only memory estimator 입력과 source/project 결과 계약
- `models/previewBitmapFactoryModel.ts`: bitmap factory 입력, adapter와 성공/실패 결과 계약
- `models/previewCacheModel.ts`: cache key, commit/retain 결과, snapshot과 runtime command 계약
- `models/previewAutomaticQualityModel.ts`: budget 출처와 자동 품질 선택 이유를 포함하는 Plain Data read model
- `models/previewBuildModel.ts`: runtime build source, Factory port, generation progress/result와 build read model
- `models/previewQualityControlModel.ts`: Preview 품질 selector 옵션/상태 ViewModel과 Canvas command 계약
- `models/previewRuntimeModel.ts`: Canvas-owned bitmap과 Preview resource runtime-only 계약
- `state/previewCacheRuntimeStore.ts`: generation, hit/miss, commit, tracked bytes, active 보호 LRU, source retain/delete, budget과 cleanup을 소유하는 Canvas runtime cache
- `adapters/canvasWorkspaceAdapter.ts`: ResizeObserver adapter
- `adapters/canvasSelectionAlphaBrowserAdapter.ts`: Layer source canvas 또는 ordered SubComp child 합성을 source-local alpha plane 한 장으로 readback하고, top-level positive opacity를 shape-neutral하게 유지하며 임시 surface를 즉시 폐기하는 browser 경계
- `adapters/canvasSelectionGlowBrowserAdapter.ts`: 선택된 fingerprint 하나의 source scratch만 생성/재사용하고 full interaction viewport canvas에 blur mask → `destination-out` interior 제거 순서로 그리는 browser 경계
- `adapters/previewBitmapBrowserAdapter.ts`: `createImageBitmap` resize와 별도 offscreen/HTML canvas copy fallback, bitmap dispose
- `adapters/previewEnvironmentAdapter.ts`: browser device memory 값을 한 경계에서 읽어 순수 quality policy 입력으로 변환
- `constants/canvasConstants.ts`: workspace/zoom/shortform/gizmo 상수
- `constants/canvasSelectionAlphaConstants.ts`: Hit와 Glow가 함께 쓰는 단일 alpha threshold와 static PSD frame visual key
- `constants/canvasSelectionGlowConstants.ts`: screen-space blur/color, `pointer-events:none`, Glow → MotionPath → Gizmo overlay 순서 계약
- `constants/previewQualityConstants.ts`: resolved quality 순서와 단일 pixel scale table
- `constants/previewAutomaticQualityConstants.ts`: device memory tier별 budget과 미지원 fallback budget

### Preview View

- `features/preview/components/PreviewWorkspacePane.tsx`: canvas/overlay/control 배치, viewport body Alpha hover/press, 공통 Transform Drag hover lock과 pan/Position cursor 우선순위, Renderer Mode/Selection Glow props 투영
- `PreviewViewportLayers.tsx`, `PreviewGuideLayers.tsx`: Canvas와 guide layer 렌더
- `PreviewInteractionOverlay.tsx`, `PreviewOverlay.tsx`: Preview Canvas 위에 full-viewport Editor-only Glow canvas를 두고 그 위에 Motion Path와 Gizmo control을 배치. Glow는 `pointer-events:none`
- `PreviewGizmoLayer.tsx`, `PreviewGizmoActiveLayer.tsx`, `PreviewGizmoBackdrop.tsx`, `PreviewGizmoHandles.tsx`, `PreviewGizmoControls.tsx`, `PreviewGizmoReadouts.tsx`: Anchor 중심의 파란 Position ring, ring 바깥 경계에서 시작해 shaft와 두 wing을 handle당 단일 SVG path로 그리는 line-only W/H/WH 화살표, 같은 경계에서 시작하는 hollow Rotation/Opacity connection/endpoint, 중앙 Anchor 점과 readout 표시 및 DOM intent 전달. Controls의 공통 paint 순서는 Handles → Anchor → Readouts로 고정해 Position/Scale/Rotation/Opacity readout과 direct numeric input이 모든 gizmo visual보다 앞에 표시된다.
- `PreviewGizmoConnectionHitLayer.tsx`: visible Backdrop과 분리된 투명 12px `pointer-events:stroke` hit line으로 W/H/WH shaft와 Rotation/Opacity connection을 endpoint와 같은 hover/cursor/pending drag/double-click input command에 연결. butt cap으로 Position ring 안쪽을 침범하지 않고 zero-length Opacity line은 렌더하지 않음
- `PreviewOverlay.tsx`: 기존 다섯 Transform handle drag flag 중 하나가 active인 동안 `document.body` portal의 투명 fixed cursor shield를 최상위 hit surface로 렌더한다. shield의 `cursor:none`과 `pointer-events:auto`가 실제 브라우저 cursor를 숨기며 mousemove/mouseup은 기존 window pointer tracker로 bubble된다. drag 종료/cancel/unmount에는 조건부 portal이 즉시 unmount되고 pending press/hover에는 생성되지 않는다.
- `PreviewAnchorControl.tsx`, `PreviewMotionPathLayer.tsx`: anchor/motion path 표시와 event 전달
- `PreviewWorkspaceControls.tsx`: zoom/guide, Preview 품질, Renderer Mode와 `선택 강조` toggle을 독립 배치. toggle은 `aria-pressed`와 active/inactive styling을 사용하며 기존 toolbar/form exclusion에 포함
- `PreviewRendererModeControl.tsx`: Playback Renderer Mode를 `작업용`(`fast-render`) / `완성본`(`full-render`) radio와 항상 보이는 설명으로 표시하고 주입된 setter만 호출
- `PreviewQualityControl.tsx`: 다섯 품질, 예상 memory, build 진행/오류 상태와 keyboard 접근 가능한 selector 표시
- `features/preview/types/*`: View 전용 gizmo props/type

Feature View는 Canvas 공개 façade만 사용하며 interaction 계산을 갖지 않는다.

Anchor Handle DOM은 `useCanvasSelectionController`가 만든 Selection ReadModel의 draft-backed `previewAnchor`를 Gizmo ViewModel과 Preview View props를 거쳐 직접 소비한다. `PreviewAnchorControl`은 이 값을 `left`/`top`에 투영할 뿐, Anchor 위치를 위한 별도 state나 ref를 소유하지 않는다. 2026-07-19 Runtime 원인 조사에서 `DraftTransformSnapshot.geometry.anchorWorld` → Selection Overlay → `previewAnchor` → Gizmo → Anchor DOM/paint 경로가 PointerMove 중 함께 갱신됨을 확인했다. 이 확인은 QA 통과 판정이 아니며, 조사로 인한 제품 코드·구조·API 변경은 없다.

Motion Path Controller는 선택 target, 대응 Timeline item과 local frame이 모두 일치하고 Position 변경이 표시된 기존 `DraftTransformSnapshot` 객체 자체 또는 `null`만 공통 geometry 생성부에 전달한다. 별도 Position Draft 객체나 projection type은 없다. Static 편집은 `snapshot.position`을 임시 base position으로, Animated 편집은 기존 Position Commit과 동일하게 임시 base position과 `snapshot.localFrame` keyframe에 함께 적용한 뒤 기존 Animation Evaluation, Modifier, scale/rotation 평가와 transform geometry를 재사용한다. 그 결과 Current/Keyframe/Sample point와 모든 polyline vertex가 하나의 Draft-aware `PreviewMotionPathPoint[]`를 소비하며 hover halo, hit target과 readout도 같은 point 좌표를 공유한다. Snapshot이 없거나 scope가 맞지 않으면 같은 sample 생성 경계에서 기존 Project/Animation 입력으로 fallback한다.

## 11. Properties Engine과 View

공개 경계: `src/engines/properties/index.ts`

| 파일/폴더 | 책임 |
|---|---|
| `usePropertiesEngine.ts` | Controller와 draft scope를 조립해 ReadModel/Command/ViewProps 반환 |
| `controllers/usePropertiesDraftController.ts` | 선택/frame scope별 draft 동기화 |
| `controllers/usePropertiesNumericInputController.ts` | focus/input/Enter/Blur/Escape lifecycle, 최신 Anchor Draft command 보관, 단일 Project/History commit 또는 cancel |
| `controllers/usePropertiesPropertyViewController.ts` | property row/info ViewModel과 Root가 target/local frame 검증 후 projection한 plain Draft Anchor 우선 resolved 값 |
| `controllers/usePropertiesTrackController.ts` | Animation track command adapter |
| `controllers/usePropertiesKeyframeController.ts` | save/delete keyframe command adapter |
| `controllers/usePropertiesModifierInputController.ts` | Modifier 숫자 draft의 Enter/Blur commit, Escape cancel과 History transaction |
| `helpers/propertiesNumericHelpers.ts` | partial number parse/clamp/precision/scale link |
| `helpers/propertiesViewModelHelpers.ts` | row/info/draft scope 순수 계산 |
| `helpers/propertiesModifierHelpers.ts` | 활성 Modifier 카드와 수식 라이브러리 태그 ViewModel |
| `models/propertiesEngineModel.ts` | 공개 ReadModel/Command/ViewProps |
| `models/propertiesInternalModel.ts` | 내부 Animation port와 draft state 계약 |
| `constants/propertiesConstants.ts` | property label |
| `features/properties/components/PropertiesTransformRow.tsx` | 기준/위치/크기/회전/투명 행이 공유하는 높이·여백·label·숫자 입력·색상·간격·정렬 presentation |
| `features/properties/components/PropertiesPropertyRow.tsx` | 공통 Transform Row에 animatable property track checkbox와 Scale 연동 control 주입 |
| `features/properties/components/PropertiesTransformOriginRow.tsx` | 공통 Transform Row에 선두 정렬 placeholder를 주입하는 track 없는 Transform Origin 숫자 입력 View |
| `features/properties/components/*` | Properties Panel과 나머지 component View |
| `features/properties/sections/*` | transform/keyframe section View |
| `features/properties/sections/PropertiesModifier*` | 활성 수식 설정 카드와 라이브러리 태그 View |
| `features/properties/types/propertiesPanelTypes.ts` | 공개 ViewProps compatibility type |
| `features/propertyVisualTokens.ts` | property별 UI 색 token |

Properties는 Animation Command만 사용하고 Project setter를 직접 사용하지 않는다.

## 12. Timeline Engine과 View

공개 경계: `src/engines/timeline/index.ts`

```text
useTimelineEngine
  ├─ View Controller
  ├─ Navigation Controller
  ├─ Playback UI Controller
  ├─ Duration Controller
  ├─ Item / Resize / Reorder Controller
  ├─ Rename / Duplicate / Split Controller
  ├─ Keyframe Controller
  └─ Pointer Controller
```

`useTimelineEngine`은 Controller input, read model, command/interaction과 최종 ViewProps를 실제 Timeline 입력별로 메모해 Draft-only root render가 Timeline Panel까지 전파되지 않게 한다.

### Controller

| 파일 | 책임 |
|---|---|
| `useTimelineViewController.ts` | header/rows/track ViewModel 조립 |
| `useTimelineNavigationController.ts` | breadcrumb/switcher navigation |
| `useTimelinePlaybackUIController.ts` | ruler, scrub, range, playback UI command |
| `useTimelineDurationController.ts` | Project duration command와 Playback normalize |
| `useTimelineItemController.ts` | select/move/delete/source decision |
| `useTimelineResizeController.ts` | left/right resize |
| `useTimelineReorderController.ts` | timeline/render/composition order 동기화 |
| `useTimelineRenameController.ts` | draft, Enter/Blur commit, Escape cancel |
| `useTimelineDuplicateController.ts` | item/render 복제와 selection |
| `useTimelineSplitController.ts` | current frame split |
| `useTimelineKeyframeController.ts` | select/drag/move/delete와 Animation command |
| `useTimelinePointerController.ts` | global pointer listener와 edge auto-scroll |

### Helper/Model

- `helpers/timelineBreadcrumbHelpers.ts`: ancestor path/switcher
- `helpers/timelineLayoutHelpers.ts`: row layout/ruler/duration parsing/px
- `helpers/timelineSourceStatusHelpers.ts`: Layer/Group source status와 `NEW` 배지 표시 모델
- `helpers/timelineViewModelHelpers.ts`: header/duration/rows/overlay ViewModel
- `helpers/timelineInteractionHelpers.ts`: snap/delta/clamp/resize/reorder/flatten/rename/split
- `models/timelineViewModel.ts`: Timeline Read/View model
- `models/timelineEngineTypes.ts`: 공개 Timeline/Interaction Commands와 ViewProps
- `models/timelineInteractionModel.ts`: move/resize/keyframe/pointer session
- `constants/timelineConstants.ts`: px/frame, row/gap/editor 치수

### Timeline View

- `features/timeline/components/TimelinePanel.tsx`: memo 경계 안의 Header/Ruler/Rows 배치와 scroll ref
- `TimelineHeader.tsx`, `TimelineTransportControls.tsx`: header/transport View
- `TimelineSelectionBreadcrumb.tsx`, `TimelineCompositionSwitcher.tsx`: navigation View
- `TimelineRuler.tsx`, `TimelineDurationSplitEditor.tsx`: ruler/duration View와 DOM event 전달
- `TimelineTrackRows.tsx`, `TimelineTrackOverlays.tsx`: 계산된 grid/overlay 렌더
- `TimelineItemTrackRow.tsx`, `TimelinePropertyTrackRow.tsx`: row 렌더와 interaction intent 전달

Timeline item mutation은 Project Commands, keyframe mutation은 Animation Commands, frame은 Playback Read/Command, drag history는 기존 History Port를 사용한다.

## 13. 상태 소유권과 중요한 정책

- Project records/master/runtime, Playback, Canvas, Timeline session state는 Shell이 각각 한 번 생성한다.
- Project History stack/capture state는 Project History 내부에 있다.
- PSD Tree picker/drop state는 PSD Tree Engine 내부에 있다.
- 선택, Properties raw 입력 draft, 공유 Draft Transform Snapshot은 Editor Session State가 소유한다.
- master comp는 `comps` 배열에 저장하지 않고 Project Selection Model이 가상으로 만든다.
- Timeline instance timing은 `TimelineItem`, transform은 `Layer`/`Composition`, pixel/runtime은 `RenderItem`에 나뉜다.
- reorder/delete/refresh는 timeline/render/composition records를 함께 맞춰야 한다.
- Playback range의 `endFrame`은 exclusive다. 마지막 표시 frame은 `endFrame - 1`이다.
- Project duration은 `CompositionMeta.durationFrames`가 소유하며 Timeline duration command 뒤 Playback을 정규화한다.
- keyframe frame은 선택 item의 global frame과 source local frame을 구분한다.
- drag History는 `begin → markDirty → commit/cancel`이며 한 drag가 Undo 한 번이어야 한다.
- Render canvas와 PSD File/FileHandle은 직렬화 Domain이 아닌 runtime resource다.
- Anchor는 animatable property가 아니며 Canvas 계산 결과를 Animation command가 적용한다.

## 14. 스타일과 설정

| 파일 | 책임 |
|---|---|
| `src/app/index.css` | 전역 reset/font/root와 editor 색상·간격·radius 디자인 토큰, 공통 panel/card/button/input/badge/focus/scrollbar 스타일 |
| `index.html` | Vite HTML entry와 `#root` |
| `vite.config.ts` | React plugin, `@` → `src` alias |
| `tsconfig*.json` | strict browser/Vite TypeScript 설정 |
| `eslint.config.js` | TypeScript/React lint 설정 |
| `package.json`, `package-lock.json` | scripts와 의존성 |
| `00_rule.md` | 모든 작업 전에 읽는 프로젝트 철학·구조·데이터·작업·종료 규칙 |
| `20_src_map.md` | 소스 책임, 상태 소유권, Engine 연결 경계를 설명하는 구조 지도 |
| `40_modifier_library.md` | 수식 라이브러리의 파일별 책임, 클릭·입력·평가 흐름과 확장 지점 설명 |
| `41_psd_import_workflow.md` | PSD Import Preview, 전체 Tree 편집, 중복 이름, editor-order Refresh, NEW 상태와 Source Identity 설계 |
| `42_preview_quality_and_memory_cache.md` | Canvas Preview 전용 bitmap 품질, memory 추정/cache lifecycle과 원본 Render 경계 설계 |
| `43_dual_renderer_architecture.md` | Animation Evaluation / Evaluated Scene / Renderer Mode / Fast Preview / Accurate Renderer 구조 |
| `44_preview_runtime_optimization.md` | Dirty State, Node/Composition/Surface Cache, Playback Dirty Update, drawImage 최소화와 Performance QA 결과 |
| `45_editor_draft_runtime_integration.md` | Editor Draft Runtime의 소유권, Preview 동기화와 취소/Commit 경계 |
| `46_transform_origin_editing.md` | Properties와 Canvas가 공유하는 Anchor/Transform Origin Draft Runtime과 QA 결과 |
| `47_canvas_engine_responsibility_refactoring.md` | Canvas Transform Input과 Playback Render Preview Canvas 책임 분리 결과 |
| `48_canvas_visual_layer_selection.md` | Evaluated Scene candidate, 공용 Source Alpha Mask, direct-selection intent와 Editor-only outer glow 구조 |
| `49_transform_drag_runtime_continuity_optimization.md` | Project Selection identity, semantic Draft no-op, positive Alpha shape, Candidate/Motion/Gizmo/Panel memo 경계와 호출 수 결과 |
| `98_sprint_plan.md` | 현재 Sprint 하나의 목표, Task 진행률, 완료 조건과 운영 순서 |
| `99_recent_task.md` | 바로 직전 Task 한 건만 기록하는 작업 보고 |

## 15. 검증 스크립트

모든 검증은 Node 24에서 `scripts/typescriptAliasLoader.mjs`와 TypeScript strip mode로 실행한다.

| 스크립트 | 검증 범위 |
|---|---|
| `verifyEngineImportBoundaries.ts` | façade/internal/Core/UI/Controller import 경계 |
| `verifyAnimationHelpers.ts` | track/evaluation/frame/motion/selection/value |
| `verifyAnimationCommands.ts` | static/animated mutation, track, anchor, keyframe collision |
| `verifyPlaybackHelpers.ts` | clamp/step/range/exclusive end |
| `verifyRenderHelpers.ts` | active source, original/preview resolver, logical/source size 분리와 canvas adapter 순서 |
| `verifyPreviewQualityContracts.ts` | quality scale, Plain Data preference와 Preview runtime의 Project/History 경계 |
| `verifyPreviewMemoryHelpers.ts` | 전 품질 scale/bytes, stable/legacy source 중복 제거, 0/tiny/large size와 B/KB/MB/GB formatter |
| `verifyPreviewBitmapFactory.ts` | 원본 size/pixel 불변, original 별도 bitmap, resize/fallback, logical/pixel size, dispose와 실패 결과 |
| `verifyPreviewCacheRuntime.ts` | cache key/hit/miss, generation/stale commit, allocated bytes, active 보호 LRU, budget와 unmount cleanup |
| `verifyRuntimeMetrics.ts` | Runtime Metrics counter 증가, frame/global reset, snapshot read, Sprint/Task Baseline 저장·비교·reset, Expected/Actual 비교 |
| `verifyDirtyCache.ts` | 같은 입력 clean, Transform/Opacity/Visibility/Hierarchy/Order/Source/Frame/Logical Size/Composition Dirty, Summary와 reset |
| `verifyNodeCache.ts` | Dirty 없는 Preview Node reference 재사용, dirty node 교체, Composition children 안전성, Metrics와 Baseline 비교 |
| `verifyCompositionCache.ts` | 동일 Composition 합성 결과 hit, Composition/child/quality/scale/logical size miss, Metrics와 Baseline 비교 |
| `verifySurfaceCache.ts` | 같은 크기 surface 재사용, size/quality/scale miss, pool 반환, dispose, Metrics와 Baseline 비교 |
| `verifyPreviewAutomaticQuality.ts` | device tier/fallback/override budget, 전 품질 선택, 경계/초대형/결정성과 Cache memory 분리 |
| `verifyCanvasPreviewIntegration.ts` | source dedupe, build/cache hit, generation 교체, atomic resolver, logical geometry, 원본 fallback과 static/animated Position Draft Motion Path의 Commit 결과 동등성 fixture |
| `verifyCanvasDragPerformance.ts` | Transform-only SourceSet/generation 안정성, accurate 평시 drag seed 0회/첫 update 1회/후속 update 재사용/다음 drag 최신 scene seed, Preview node 실시간 갱신, Accurate Frame 불변, Cache 무변경, pointer 병합/최종 commit, 품질별 backing buffer와 완전 frame draw 구조 지표 |
| `verifyCanvasTransformDragIntegration.ts` | Layer 전체 Transform handle 및 대표 SubComp drag의 100 raw/10 RAF accepted 동일 fixture에서 root/useRenderEngine/Canvas memo dependency identity를 재현하고 Animation/Full/Fast/Draft/Motion Path/Direct Selection static·viewport·Draft 단계/Alpha/Glow/Project/History Before·After·Difference를 비교하며, Handle별 100 semantic Motion Path build와 viewport-only projection 경계도 계측 |
| `verifyCanvasTransformSemanticNoop.ts` | Position/Anchor/Scale W·H·WH/Rotation/Opacity별 동일 semantic·snap/clamp 결과 100 accepted의 Draft/Readout/Snapshot/Preview 1회, 100개 변경값 전부 반영, final pending flush, commit/history 1회와 cancel 복원 검증 |
| `verifyProjectSelectionModelIdentity.ts` | 동일 입력/Draft-only render reference 안정성, selection/timeline/meta/master transform/project refresh별 필요한 identity invalidation과 최신 값·fallback 회귀 |
| `verifyDraftPanelRenderIsolation.ts` | PSD Tree/Timeline의 memo export와 안정 `viewProps` 경계를 정적으로 확인하고, 100 Draft-only root frame에서 두 패널 0회·Preview/Properties 100회 및 실제 입력 변경 시 invalidation되는 shallow render-count fixture |
| `verifyPreviewQualityControl.ts` | 다섯 품질/예상 memory ViewModel, active 품질, 진행/오류 상태, 접근성과 command-only View 경계 |
| `verifyPreviewSourceLifecycle.ts` | Import/Refresh/Delete 단일 SourceSet lifecycle, fingerprint 부분 재생성, cache reuse, atomic resolver와 tracked memory 회수 |
| `verifyPreviewSprintStress.ts` | 1,000개 대용량 source 추정, 전 품질 반복, Import/Refresh/Delete 반복, generation 경합과 unmount memory 누수 Sprint QA |
| `verifyPreviewStressTest.ts` | 10000 frame playback, retained canvas 반복 draw, 대형 Preview Scene, source lifecycle, cache dispose와 memory leak 검증 |
| `verifyPreviewPerformanceQa.ts` | Sprint Baseline 대비 Preview Scene generation, cache miss/create, drawImage 감소와 skipped draw 증가 비교 |
| `verifyPsdTreeHelpers.ts` | 기존 drop/order/NEW view model/file picker와 Preview reorder/reparent/순환 방지/중복 재계산 |
| `verifyPsdPipeline.ts` | PSD identity/settings, Preview Plan 직렬화와 runtime 분리, 신규 Layer/Group 맨 위 삽입, Timeline/Render 동기화, NEW 유지/승인 후 반복 Refresh 회귀 |
| `verifyProjectHistory.ts` | snapshot 보존, undo/redo, drag transaction/reset |
| `verifyCanvasHelpers.ts` | viewport/coordinate/guide/selection/workspace |
| `verifyCanvasInteractionHelpers.ts` | transform/motion/gizmo interaction 계산, 모든 Transform Drag flag의 공통 hover lock과 provider 접근 차단, radial geometry와 Motion Path viewport/polyline/point ViewModel 분리 결과 및 공통 geometry 일치 fixture |
| `verifyCanvasSelectionAlpha.ts` | Layer/SubComp alpha 합성, positive root opacity shape/readback 재사용과 0/child fingerprint invalidation, static frame 규칙, bounded provider retain/release/failure/dispose와 browser readback 의미 |
| `verifyCanvasDirectSelection.ts` | exact/ambiguous/split candidate, reverse painter order, transparent fallthrough/safe-block, Map 기반 static join과 100 Draft selected-only Projection/descriptor reuse, opacity 0/positive 복구, signed inverse, selection intent, hover cache 보존/제한과 cursor 우선순위 |
| `verifyCanvasDirectSelectionUi.ts` | selection polygon/diagonal/quad hit layer 제거, viewport body direct-selection/hover 연결, `선택 강조` toolbar/default/state/reset/form exclusion source contract |
| `verifyCanvasSelectionGlow.ts` | Hit/Glow 공용 provider entry/fingerprint/threshold/Projection, positive root opacity의 entry/scratch 재사용, OFF release와 provider 접근 차단, ON rebuild, selected scratch reuse/교체, target backing 1×1 clear, outer-only 합성, DPR와 overlay 순서 |
| `verifyPropertiesHelpers.ts` | numeric draft/parse/clamp/view model |
| `verifyModifierSystem.ts` | Modifier 기본값/정규화/중복 방지/mutation/결정적 평가 |
| `verifyTimelineHelpers.ts` | breadcrumb/layout/duration/source ViewModel |
| `verifyTimelineInteractionHelpers.ts` | move/resize/snap/order/keyframe/auto-scroll/split |

Transform Drag Runtime Continuity Sprint 마감 검증 기록:

- 전체 ESLint 성공
- `npm test`: 42개 검증 스크립트 성공
- `npm run build`: 성공, 307 modules. 기존 500 kB chunk 경고만 존재
- `git diff --check`: 성공
- Engine Import Boundary와 기존 Preview/Dirty/Node/Composition/Surface Cache, History/Animation/Project 회귀 스크립트 성공
- Task 7 대상 Edge 중간 QA에서 최초 memo import TDZ를 발견·수정하고 PSD import, 대표 Transform/Properties/History/Timeline/Tree smoke를 재확인
- Sprint 마감 Edge 대상 QA에서 Position·Anchor Draft/Commit, Undo/Redo, Renderer Mode 전환, Glow OFF/ON과 Console 오류 부재를 확인
- Scale/Rotation/Opacity의 작은 radial hit target은 좌표 자동화 한계 때문에 실제 Edge 통과로 과장하지 않으며, Handle별 계약은 통합 fixture와 42개 verification 결과로 기록
- 실제 FPS/frame time/GPU profiler, 전 Handle 장시간 수동 체감과 Preview/Export pixel 비교는 별도 성능 QA 범위

정적 검증과 대상 Edge QA는 실제 profiler 수치나 포괄 수동 성능 QA를 뜻하지 않는다.

## 16. 알려진 한계

- `useEditorCompositionRoot.ts`는 의도적으로 모든 wiring을 모으므로 길다. 기능 계산을 다시 넣지 않는다.
- 실제 PSD picker/File System Access API와 Canvas/Timeline pointer visual regression은 자동화하지 않았다.
- 단일 JS chunk가 Vite 500 kB 경고 기준을 넘는다.
- persistence/export가 없어 reload 시 편집 상태와 runtime file binding이 사라진다.
- Project History snapshot은 현재 runtime RenderItem의 canvas 참조를 보유한다. Refresh는 History를 초기화해 stale runtime 충돌을 막지만, 장기적으로 History Plain Data와 Render runtime을 분리할 필요가 있다.
