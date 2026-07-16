# Shortform Editor source map

> 점검 기준: 2026-07-16, 현재 작업 폴더의 소스 코드 기준
> 리팩토링 상태: Seven-engine Task 1~17 완료. 구조 리팩토링과 자동 QA를 종료했다.
> 목적: 다음 작업자가 파일 책임, 상태 소유권, Engine 연결 경계를 빠르게 파악하기 위한 지도다.

## 1. 프로젝트 한눈에 보기

PSD를 불러와 Photoshop group을 Composition으로, pixel layer를 Layer/drawable로 바꾸고 세로형 Canvas에서 transform과 keyframe을 편집하는 React/Vite 프로토타입이다.

현재 주요 기능:

- 여러 PSD import, 같은 이름 교체, refresh, source 상태 승인/삭제
- PSD composition tree 탐색, 선택, 정렬, 삭제
- 중첩 Composition의 Canvas 2D 렌더
- position/scale/rotation/opacity 정적 값과 keyframe 편집
- Canvas gizmo, anchor, motion path/keyframe drag
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
  → Project PSD parser/builder/import controller
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
- Controller는 다른 Controller를 직접 import하거나 호출하지 않는다. Engine hook이 각 Controller를 조립한다.
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
| `state/useEditorState.ts` | Shell state hook과 공개 Project Commands/History를 조립해 Root에 제공 |
| `state/useEditorEngineStateStores.ts` | Project record/master/runtime, Playback, Canvas, Timeline React state 생성 |
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
| `useProjectHistory.ts` | History state와 Controller를 하나의 공개 hook으로 조립 |
| `state/useProjectHistoryState.ts` | composition별 past/future/pending capture ref |
| `controllers/useProjectHistoryController.ts` | push/undo/redo/begin/dirty/commit/cancel/reset |
| `history/projectHistorySnapshot.ts` | snapshot clone/capture/restore, runtime canvas 참조 보존 |

### Selection과 Project 구조

| 파일 | 책임 |
|---|---|
| `useProjectSelectionModel.ts` | master virtual comp, ID map, 현재 selection/meta/items, Properties target 파생 |
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
| Navigation | `controllers/useProjectNavigationController.ts` | selected composition 진입/이동 |
| Source | `controllers/usePsdSourceController.ts` | file handle 등록/조회/삭제 |
| Import | `controllers/usePsdImportController.ts` | 여러 PSD 변환, 같은 이름 교체, 원자적 record commit |
| Refresh | `controllers/usePsdRefreshController.ts` | 최신 source 재로딩, diff/merge, selection/history 후처리 |
| Library | `controllers/usePsdLibraryController.ts` | main 삭제와 reorder |
| Sync | `controllers/usePsdSourceSyncController.ts` | updated/new/deletePending/missing 처리 |
| Parser | `import/psdParser.ts`, `psdLoader.ts` | File → parsed PSD/document |
| Builder | `import/psdCompositionBuilder.ts`, `psdDocumentFactory.ts`, `psdLayerConverter.ts`, `psdImportHelpers.ts` | PSD → composition/meta/timeline/render records |
| Merge | `helpers/psd/*` | source match/status, timeline/render/composition merge, cleanup, import 정책 |
| Runtime model | `models/psdSourceRuntimeModel.ts`, `runtimeRenderModel.ts` | File handle/source와 Canvas drawable/render item |
| Refresh model | `models/psdRefreshResultModel.ts` | refresh 중간 결과 계약 |

## 7. Animation Engine

공개 경계: `src/engines/animation/index.ts`

```text
useAnimationEngine
  ├─ useTransformValueController
  ├─ usePropertyTrackController
  ├─ useKeyframeController
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
| Input adapter | `adapters/useTransformInputAdapter.ts` | Preview/Properties input을 command로 변환 |
| Pure mutation | `actions/animationProjectMutations.ts` | Composition tree 불변 변경. React state 호출 없음 |
| Command model | `models/animationCommandModel.ts` | Project/Master/Session/History port |
| Session model | `models/animationSessionModel.ts` | selected keyframe, transform target/edit mode |
| Constants | `constants/animationConstants.ts` | 지원 animatable property 목록 |
| Track helpers | `helpers/keyframeTrackHelpers.ts`, `keyframeTargetHelpers.ts`, `propertyTrackHelpers.ts` | keyframe/track 순수 조작 |
| Evaluation | `helpers/animationEvaluationHelpers.ts` | frame별 transform 보간과 fallback |
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
| `models/playbackModel.ts` | Playback state/read/command port |
| `timeFormatting.ts` | timeline/compact time 문자열 포맷 |

Playback state 자체는 Shell-owned `useEditorPlaybackState`가 한 번 생성하고 Engine에 Port로 주입한다.

### Render

| 파일 | 책임 |
|---|---|
| `useRenderEngine.ts` | selected composition/frame/runtime records로 Render Frame 생성 |
| `controllers/buildRenderFrame.ts` | drawable/composition render command graph 생성 |
| `helpers/activeTimelineItemHelpers.ts` | global frame에서 active item/local frame/order 계산 |
| `helpers/renderSourceHelpers.ts` | Layer/Composition source와 transform evaluation 결합 |
| `models/renderFrameModel.ts` | Render Frame/Command 계약 |
| `adapters/canvas2dRenderAdapter.ts` | 유일한 CanvasRenderingContext2D draw adapter |

## 9. PSD Tree Engine

공개 경계: `src/engines/psd-tree/index.ts`

| 파일/폴더 | 책임 |
|---|---|
| `usePsdTreeEngine.ts` | picker/source/selection/reorder Controller와 ViewModel 조립 |
| `controllers/usePsdPickerController.ts` | import/refresh picker intent |
| `controllers/useSourceActionController.ts` | refresh/delete/source status UI action |
| `controllers/useTreeSelectionController.ts` | composition 선택 intent |
| `controllers/useTreeReorderController.ts` | drag/drop order intent |
| `state/usePsdTreeState.ts` | picker ref, pending mode, dragged/drop UI state |
| `adapters/psdFilePickerAdapter.ts` | File System Access API와 file input fallback |
| `helpers/psdTreeDropHelpers.ts` | drop 위치와 order 순수 계산 |
| `helpers/psdTreeViewModelHelpers.ts` | Project tree → node ViewModel |
| `models/psdTreeModel.ts` | read/command/selection port와 ViewProps |
| `features/psdtree/components/PsdTree.tsx`, `PsdTreeNode.tsx` | 계산된 tree를 렌더하고 DOM event 전달 |

## 10. Canvas Engine과 Preview View

공개 경계: `src/engines/canvas/index.ts`

```text
useCanvasComposition
  ├─ useRenderEngine
  └─ useCanvasEngine
      ├─ useCanvasViewportEngine
      ├─ Guide/Selection/Render Controller
      ├─ Pointer/Transform/Motion Controller
      └─ Gizmo Controller
           ↓
      PreviewWorkspacePane ViewProps
```

### 조립과 Controller

| 파일 | 책임 |
|---|---|
| `useCanvasComposition.ts` | Project/Animation/Playback data와 Render/Canvas를 연결하고 Preview props 생성 |
| `useCanvasEngine.ts` | Canvas Controller 전체 조립, pointer port와 gizmo command 연결 |
| `useCanvasViewportEngine.ts` | viewport/workspace/pan Controller 조립 |
| `controllers/useCanvasViewportController.ts` | zoom/reset/1:1/pointer zoom |
| `controllers/useCanvasWorkspaceController.ts` | workspace ResizeObserver lifecycle |
| `controllers/useCanvasPanController.ts` | pan pointer/keyboard modifier lifecycle |
| `controllers/useCanvasGuideController.ts` | shortform/safe-zone guide read/command |
| `controllers/useCanvasSelectionController.ts` | selected Layer/Composition overlay read model |
| `controllers/useCanvasRenderController.ts` | Render Frame를 Canvas Adapter에 전달 |
| `controllers/useCanvasPointerController.ts` | global pointer session/listener 조립 |
| `controllers/useCanvasTransformController.ts` | move/scale/rotate/opacity/anchor interaction |
| `controllers/useCanvasMotionPathController.ts` | motion path point/keyframe drag interaction |
| `controllers/useCanvasGizmoController.ts` | geometry/readout/hover/cursor ViewModel과 command 조립 |

### Helper/Model/Adapter

- `helpers/canvasViewportHelpers.ts`: zoom/pan/fit/pointer 좌표
- `helpers/canvasCoordinateHelpers.ts`: world/canvas transform와 anchor 보정
- `helpers/canvasGuideHelpers.ts`: 9:16/safe-zone guide
- `helpers/canvasSelectionHelpers.ts`: Layer/Sub Composition selection overlay
- `helpers/canvasPointerHelpers.ts`: pointer session 초기 상태와 좌표
- `helpers/canvasInteractionHelpers.ts`: drag delta, snap, clamp, readout
- `helpers/canvasMotionPathHelpers.ts`: motion path point geometry
- `helpers/canvasGizmoGeometryHelpers.ts`, `canvasGizmoHelpers.ts`: handle/path/overlay ViewModel
- `models/canvasEngineModel.ts`: viewport/guide/selection/read port
- `models/canvasInteractionModel.ts`: pointer/gizmo/motion session/command
- `models/canvasViewModel.ts`: overlay/handle/motion point view type
- `adapters/canvasWorkspaceAdapter.ts`: ResizeObserver adapter
- `constants/canvasConstants.ts`: workspace/zoom/shortform/gizmo 상수

### Preview View

- `features/preview/components/PreviewWorkspacePane.tsx`: canvas/overlay/control 배치
- `PreviewViewportLayers.tsx`, `PreviewGuideLayers.tsx`: Canvas와 guide layer 렌더
- `PreviewInteractionOverlay.tsx`, `PreviewOverlay.tsx`: interaction overlay 배치
- `PreviewGizmoLayer.tsx`, `PreviewGizmoActiveLayer.tsx`, `PreviewGizmoBackdrop.tsx`, `PreviewGizmoHandles.tsx`, `PreviewGizmoControls.tsx`, `PreviewGizmoReadouts.tsx`: gizmo 표시와 DOM intent 전달
- `PreviewAnchorControl.tsx`, `PreviewMotionPathLayer.tsx`: anchor/motion path 표시와 event 전달
- `PreviewWorkspaceControls.tsx`: zoom/guide control
- `features/preview/types/*`: View 전용 gizmo props/type

Feature View는 Canvas 공개 façade만 사용하며 interaction 계산을 갖지 않는다.

## 11. Properties Engine과 View

공개 경계: `src/engines/properties/index.ts`

| 파일/폴더 | 책임 |
|---|---|
| `usePropertiesEngine.ts` | Controller와 draft scope를 조립해 ReadModel/Command/ViewProps 반환 |
| `controllers/usePropertiesDraftController.ts` | 선택/frame scope별 draft 동기화 |
| `controllers/usePropertiesNumericInputController.ts` | focus/input/Enter/Blur/Escape commit lifecycle |
| `controllers/usePropertiesPropertyViewController.ts` | property row/info/resolved value ViewModel |
| `controllers/usePropertiesTrackController.ts` | Animation track command adapter |
| `controllers/usePropertiesKeyframeController.ts` | save/delete keyframe command adapter |
| `helpers/propertiesNumericHelpers.ts` | partial number parse/clamp/precision/scale link |
| `helpers/propertiesViewModelHelpers.ts` | row/info/draft scope 순수 계산 |
| `models/propertiesEngineModel.ts` | 공개 ReadModel/Command/ViewProps |
| `models/propertiesInternalModel.ts` | 내부 Animation port와 draft state 계약 |
| `constants/propertiesConstants.ts` | property label |
| `features/properties/components/*` | Panel/info/property row View |
| `features/properties/sections/*` | transform/keyframe section View |
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
- `helpers/timelineSourceStatusHelpers.ts`: source status 표시 모델
- `helpers/timelineViewModelHelpers.ts`: header/duration/rows/overlay ViewModel
- `helpers/timelineInteractionHelpers.ts`: snap/delta/clamp/resize/reorder/flatten/rename/split
- `models/timelineViewModel.ts`: Timeline Read/View model
- `models/timelineEngineTypes.ts`: 공개 Timeline/Interaction Commands와 ViewProps
- `models/timelineInteractionModel.ts`: move/resize/keyframe/pointer session
- `constants/timelineConstants.ts`: px/frame, row/gap/editor 치수

### Timeline View

- `features/timeline/components/TimelinePanel.tsx`: Header/Ruler/Rows 배치와 scroll ref
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
- 선택과 입력 draft는 Editor Session State가 소유한다.
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
| `src/app/index.css` | 전역 reset/font/root |
| `index.html` | Vite HTML entry와 `#root` |
| `vite.config.ts` | React plugin, `@` → `src` alias |
| `tsconfig*.json` | strict browser/Vite TypeScript 설정 |
| `eslint.config.js` | TypeScript/React lint 설정 |
| `package.json`, `package-lock.json` | scripts와 의존성 |
| `README.md` | 실행, 검증, 일곱 Engine 구조와 현재 범위 |

## 15. 검증 스크립트

모든 검증은 Node 24에서 `scripts/typescriptAliasLoader.mjs`와 TypeScript strip mode로 실행한다.

| 스크립트 | 검증 범위 |
|---|---|
| `verifyEngineImportBoundaries.ts` | façade/internal/Core/UI/Controller import 경계 |
| `verifyAnimationHelpers.ts` | track/evaluation/frame/motion/selection/value |
| `verifyAnimationCommands.ts` | static/animated mutation, track, anchor, keyframe collision |
| `verifyPlaybackHelpers.ts` | clamp/step/range/exclusive end |
| `verifyRenderHelpers.ts` | active source, render command, canvas adapter 순서 |
| `verifyPsdTreeHelpers.ts` | drop/order/view model/file picker adapter |
| `verifyPsdPipeline.ts` | 합성 PSD binary parse/import/replace와 record 정리 |
| `verifyProjectHistory.ts` | snapshot 보존, undo/redo, drag transaction/reset |
| `verifyCanvasHelpers.ts` | viewport/coordinate/guide/selection/workspace |
| `verifyCanvasInteractionHelpers.ts` | transform/motion/gizmo interaction 계산 |
| `verifyPropertiesHelpers.ts` | numeric draft/parse/clamp/view model |
| `verifyTimelineHelpers.ts` | breadcrumb/layout/duration/source ViewModel |
| `verifyTimelineInteractionHelpers.ts` | move/resize/snap/order/keyframe/auto-scroll/split |

Task 17 최종 상태:

- `npm run build`: 성공, 226 modules. 기존 500 kB chunk 경고만 존재
- `npm run lint`: 성공
- `npm test`: 13개 검증 스크립트 성공
- `npm run qa`: lint + test + build 성공
- `git diff --check`: 성공
- production preview HTML/JS asset 응답: 성공
- PSD binary import/replace와 Project History undo/redo 회귀: 성공
- 인앱 브라우저 대상이 없어 실제 pointer/keyboard 클릭 smoke는 미실행

## 16. 알려진 한계

- `useEditorCompositionRoot.ts`는 의도적으로 모든 wiring을 모으므로 길다. 기능 계산을 다시 넣지 않는다.
- 실제 PSD picker/File System Access API와 Canvas/Timeline pointer visual regression은 자동화하지 않았다.
- 단일 JS chunk가 Vite 500 kB 경고 기준을 넘는다.
- persistence/export가 없어 reload 시 편집 상태와 runtime file binding이 사라진다.

## 17. 다음 작업자 추천 읽기 순서

1. `recent_task.md`
2. `refactor_plan.md`
3. `src_map.md`
4. `src/editor/useEditorCompositionRoot.ts`
5. `src/editor/state/useEditorState.ts`, `useEditorEngineStateStores.ts`, `useEditorSessionState.ts`
6. 각 `src/engines/*/index.ts`
7. 수정 대상 Engine의 `use*Engine.ts` → model → controller → helper → feature View
8. `scripts/verifyEngineImportBoundaries.ts`
9. 관련 Helper/Command 검증 스크립트
