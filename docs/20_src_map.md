# Source Map

> 현재 기준: Editor Project Owner와 다섯 Panel Engine의 최종 구조
>
> 영구 설계는 `docs/architecture/10_project_architecture.md`부터
> `docs/architecture/17_persistence_lifecycle_architecture.md`까지의
> Architecture 법전을 따른다. 이 문서는 현재 존재하는 소스와 책임만
> 설명하며 삭제된 이전 구현은 나열하지 않는다.

## 1. 현재 실행 흐름

```text
main.tsx
  → App
  → EditorShell
  → useEditorCompositionRoot
      → useLayerDocumentEditorOwner
      → LayerDocument Project Owner
      → useLayerDocumentEditorRuntime
      → Project Lifecycle / Save / Open / Reconnect ports
      → Source Runtime Resolution / Resource Registry
      → shared Transform Draft / Timeline Runtime
      → useLayerDocumentPanelEnginePorts
      → Owner / Panel Engine / Render public port wiring
      → Canvas / Timeline / Properties / Library / Audio Effects Engine
  → EditorShellLayout
      → Project Lifecycle Bar / Library / Canvas / Properties / Audio Effects / Timeline UI
```

`src/editor/useEditorCompositionRoot.ts`가 제품 Composition Root다. 동일
Project Owner와 저장되지 않는 Editor Runtime의 최소 port를 다섯 Panel
Engine에 주입하고 ViewProps를 Shell에 연결한다. Root는 current frame을
저장하지 않으며 Timeline Runtime의 동일 read/subscribe/command port를
Timeline과 Canvas/Properties frame input 경계로 전달한다.

## 2. 저장 데이터와 identity

### `src/models/layerDocumentModel.ts`

- `LayerDocumentProject`: metadata와 payload를 가진 유일한 Project 저장 루트
- `payload.layerDocumentsById`: 모든 편집 가능한 LayerDocument
- `payload.sourceRegistry.sourcesById`: 외부 원본 identity, linked-file locator, SHA-256 content fingerprint, reconciliation metadata
- `layerDocumentId`: 저장·선택·편집·History의 canonical identity
- `common.source`: Source Registry 참조
- `common.transform`, `placement`, `animation`, `effects`, `modifiers`: 모든 Type의 공통 편집 데이터. `effects` 배열 순서가 Audio를 포함한 effect chain 처리 순서다.
- `data`: PSD, Drawing, Text, Audio, Video, Shape, Group, Unknown별 discriminated data. Audio는 gain/muted/fade를 저장하고 timing/Cut 소속은 common placement를 재사용한다.

`renderItemId`는 저장 authority가 아니라 Render Runtime의
renderable-content identity다. drawable에서는 Source Runtime visual ID,
Group에서는 Group LayerDocument ID를 사용한다. Timeline row는 별도 저장
entity가 아니며 `LayerDocument.common.placement`의 projection이다.

### LayerDocument 모델 파일

- `layerDocumentNormalization.ts`: schema normalize와 기본값
- `layerDocumentSchemaMigration.ts`: 저장 데이터만 다루는 pure schema 1→2와 2→3 migration
- `layerDocumentSourceDescriptorHelpers.ts`: 저장 Source descriptor의 표시 경로와 visual fingerprint projection
- `layerDocumentValidation.ts`: 전체 공개 validation 조립
- `layerDocumentStructureValidation.ts`: Project/Layer 공통 구조 검증
- `layerDocumentGraphValidation.ts`: parent/root graph 검증
- `layerDocumentSourceValidation.ts`: Source Registry와 참조 검증
- `layerDocumentSelectionModel.ts`: `layerDocumentId` 기반 선택 및 Library의
  session-only Source 선택
- `layerDocumentGroupScopeModel.ts`: 활성 Group과 자식 scope
- `layerDocumentPlacementFrameHelpers.ts`: global/local frame 계산
- `layerDocumentTimelineReadModel.ts`: placement 기반 Timeline projection
- `layerDocumentTimelineIntentModel.ts`: Timeline semantic intent
- `layerDocumentTimelineIntentAdapter.ts`: intent를 transaction 입력으로 변환

Audio import 준비와 Runtime 경계:

- `engines/project/import/layerDocumentAudioImportAdapter.ts`: Cut 해석,
  browser decode metadata, SHA-256 fingerprint, Source/Audio Layer prepared command
- `engines/project/import/layerDocumentAudioRecordingAdapter.ts`: 마이크 권한,
  MediaRecorder start/stop/cancel, recorded File 준비와 stream/track dispose 경계
- `engines/project/models/layerDocumentAudioRuntimeModel.ts`: 저장되지 않는 decoded
  Audio resource와 registration public port
- `engines/project/state/layerDocumentAudioRuntimeStore.ts`: sourceId/fingerprint 기반
  decoded Audio 등록·재사용, active/suspended 전환과 Project-session dispose 경계
- `engines/library/adapters/layerDocumentAudioImportCommandAdapter.ts`: prepared
  lifecycle, Owner atomic confirm, Runtime 등록과 Source resolution 연결
- `editor/audio-runtime/editorAudioRuntime.ts`: single-active audition,
  play/stop/replace/seek/read/subscribe, 삭제 시 handle 정지와 decoded/waveform
  suspend/restore/targeted dispose를 분리한 Project/Source reconcile
- `editor/audio-runtime/browserAudioAuditionBackend.ts`: AudioBufferSourceNode와
  GainNode 및 compressor/delay/reverb/Noise Gate ordered graph를 사용하는 브라우저
  playback adapter. handle 종료 때 processing callback, node와 AudioContext를 정리한다.
- `editor/audio-runtime/noiseGateDsp.ts`: `소음 줄이기` strength를
  threshold/attack/release/floor로 해석하고 linked-channel envelope를 처리하는 pure DSP
- `editor/projectExportAudio.ts`: 현재 export Group 아래 Audio의 Cut/Layer placement를
  export 시간으로 투영하고 source offset, gain/fade, ordered effects를 Web Audio
  `MediaStreamDestination` mix로 만드는 경계
- `editor/projectExportVideoRuntime.ts`: Accurate visual capture track과 Audio mix track을
  단일 MediaRecorder stream으로 묶고 AudioContext clock 기준 frame scheduling, cancel/error
  cleanup을 소유하는 영상 출력 Runtime
- `editor/audio-runtime/editorAudioRuntimeModel.ts`: fake backend로도 검증 가능한
  audition/backend/Runtime public port
- `engines/audio-effects/`: 독립 Audio Effects Panel Engine의 catalog, Runtime
  parameter Draft, ordered envelope command와 Owner adapter
- `features/audio-effects/components/AudioEffectsPanel.tsx`: Audio 선택 때만 보이는
  effect 추가/삭제/순서/bypass/parameter 편집 Panel

### Transaction

- `layerDocumentTransactionModel.ts`: transaction/result 계약
- `layerDocumentTransactionHelpers.ts`: revision, clone, plain-data 공통 처리
- `layerDocumentTransactions.ts`: 공통 LayerDocument mutation
- `layerDocumentContentTransactions.ts`: Transform/Animation/Effect/Modifier 변경
- `layerDocumentStructuralTransactions.ts`: create/duplicate/delete/group 구조 변경
- `layerDocumentTimelineTransactions.ts`: placement move/trim/reorder/visibility/alias

Duplicate는 같은 Source를 참조하는 새 LayerDocument를 만들고 공통/Type별 편집 데이터는 deep copy한다. 새 `layerDocumentId`, 배치, 선택과 History 한 건이 하나의 Project transaction에서 처리된다.

## 3. Editor owner, session, draft, bootstrap

### `src/editor`

- `layerDocumentEditorBootstrap.ts`: 빈 Source Registry와 project-root Group 하나를 가진 초기 Project 생성
- `layerDocumentEditorProjectIdentity.ts`: 새 Project마다 고유 `projectId`를 생성하고 `projectId + locatorId` session-local handle key 구성
- `project-owner/index.ts`: Editor Project Owner의 단일 public entry
- `project-owner/useEditorProjectOwner.ts`: Project Owner 인스턴스 1개와 안정적인 read/command(effect result) port 생성
- `project-owner/models/editorProjectOwnerModel.ts`: Panel Runtime을 포함하지 않는 Owner 공개 port 계약
- `project-owner/helpers/editorProjectOwnerPortHelpers.ts`: canonical Editor
  Project Owner port factory
- `project-owner/helpers/editorProjectOwnerCommandHelpers.ts`: Layer/Source
  transaction과 selection/history intent를 Owner raw command로 전달
- `project-owner/helpers/editorProjectOwnerCommandAdapter.ts`: preparation
  rejection, Owner transition/effect 전달, Source Runtime cache effect와
  Layer/Source preparation commit을 소유하는 최종 Owner command adapter
- `useLayerDocumentEditorOwner.ts`: 단일 Editor Project Owner 인스턴스 생성
- `useLayerDocumentEditorRuntime.ts`: 단일 Owner command adapter,
  lifecycle/save/open/reconnect, Source Runtime, shared Draft와 Timeline
  Runtime의 StrictMode-safe 수명 관리
- `useLayerDocumentPanelEnginePorts.ts`: 최종 Owner/Panel Engine/동결된
  Render public port를 직접 연결하고 Canvas/Timeline/Properties/Library의
  최소 입력 port로 변환
- `useEditorCompositionRoot.ts`: 다섯 Panel Engine 생성과 ViewProps 연결만 수행하는 Editor Composition Root
- `projectLifecycleUi.ts`: lifecycle 공개 포트만 사용하는 New/Open/Save/Save As/Close/Reconnect UI command와 구조화 ViewModel
- `ProjectLifecycleBar.tsx`: 기존 공개 props를 UI Controller, Composer와
  `ProjectLifecycleView`에 연결하는 얇은 Project Lifecycle facade
- `project-lifecycle/adapters/projectLifecycleBrowserDirectoryAdapter.ts`:
  Browser directory picker, `.ziq` 단일 파일 탐색, 새 Project의 `psd/`·`audio/`
  준비, queued open selection과 asset directory 연결/복구 경계
- `project-lifecycle/controllers/projectLifecycleUiController.ts`: pending Project
  위치, create/open/close, 중복 intent와 stale async cleanup, Export open/prepare를
  소유하는 UI workflow Controller
- `project-lifecycle/state/useProjectLifecycleUiController.ts`: UI workflow
  Controller의 React 구독과 최신 Core/Export port 연결
- `project-lifecycle/composers/projectLifecycleUiComposer.ts`: Core ViewModel과 UI
  Controller 결과를 Toolbar, Start Screen, Dialog, Missing Source와 Export
  ViewProps로만 조립하는 Composer
- `project-lifecycle/helpers/projectLifecycleNameHelpers.ts`: Project 이름 정리,
  `.ziq` 파일명과 pending 표시 경로의 순수 계산
- `project-lifecycle/models/*`: Project Lifecycle presentation과 UI Controller의
  공개 Plain ViewProps 계약
- `features/project-lifecycle/components/*`: Toolbar, Start Screen, New Project
  Dialog, Missing Source Banner와 최종 Project Lifecycle 표시. picker와 Project
  mutation을 소유하지 않으며 overlay는 각 component가 한 번만 portal한다.
- `projectAssetDirectoryRuntime.ts`: 현재 Browser session의 Project directory
  권한과 `psd/`, `audio/` 충돌 없는 복사, relative locator 준비와 재열기 탐색.
  실패한 신규 write entry는 best-effort 정리하며 Library 삭제에 따른 물리 원본
  삭제는 제공하지 않는다.
- `libraryRecordingAssetStoreAdapter.ts`: 확인된 임시 녹음을 `audio/`에 저장하고
  실제 충돌 회피 파일명과 relative locator를 prepared command에 연결하는 Editor
  경계
- `state/useEditorCanvasRuntimeState.ts`: drag, hover, pan 같은 Canvas 전용 세션 상태
- `state/useEditorShellLayoutState.ts`: panel size 같은 Shell 세션 상태
- `useEditorHistoryShortcuts.ts`: owner undo/redo에 keyboard intent 전달
- `EditorShell.tsx`, `EditorShellLayout.tsx`: UI 배치

Project 저장 데이터는 Project Owner만 교체한다. lifecycle UI는
Owner/Runtime을 직접 변경하지 않고 lifecycle/save/open/reconnect 공개
port만 호출한다. 선택과 active Group은 Owner의 Selection Runtime이고,
playback range/current frame/isPlaying/clock/transport는 Timeline Runtime
한 곳에서만 소유한다. Undo/Redo와 Project/Group 전환은 현재 frame/range를
유지하며 새 duration을 벗어날 때만 Timeline validity command로 clamp한다.
PointerMove Transform은 `LayerDocumentTransformDraftSnapshot`만 바꾸며
PointerUp에서 transaction과 History 한 건으로 commit한다.

## 4. Project domain과 Owner 내부 구현

### `src/engines/project`

디렉터리명은 유지되지만 Editor의 Project state authority는
`src/editor/project-owner`의 Owner 하나다. 이 디렉터리는 reducer,
transaction preparation, persistence/lifecycle controller와 Source Runtime
adapter를 제공한다.

- `actions/layerDocumentProjectOwnerReducer.ts`: owner action dispatch
- `actions/layerDocumentProjectOwnerLayerCommitReducer.ts`: Layer transaction commit
- `actions/layerDocumentProjectOwnerSourceCommitReducer.ts`: Source lifecycle commit
- `actions/layerDocumentProjectOwnerReplaceReducer.ts`: 검증된 Project의 원자 교체와 Session/History 초기화
- `actions/layerDocumentProjectOwnerHistoryReducer.ts`: Project-only undo/redo와 현재 Runtime 유효성 보정
- `actions/layerDocumentProjectOwnerRuntimeSessionReducer.ts`: keyframe 선택과 Source status acknowledgment Runtime
- `actions/layerDocumentSourceImportTransaction.ts`: PSD import transaction
- `actions/layerDocumentPsdRefreshTransaction.ts`: stable Source identity 기반 refresh
- `actions/layerDocumentSourceDeleteTransaction.ts`: source/layer delete policy
- `actions/layerDocumentSourceLifecycleTransactions.ts`: source replace/reconnect
- `models/layerDocumentProjectPersistenceModel.ts`: `.ziq` envelope, 제한값, Load Candidate와 구조화 오류 계약
- `models/layerDocumentProjectLifecycleModel.ts`: document/dirty/operation 축, operation token과 lifecycle runtime port
- `models/layerDocumentProjectBrowserWriteModel.ts`: native handle/Blob download capability와 Runtime write target 계약
- `models/layerDocumentProjectSaveModel.ts`: Save/Save As controller 결과와 오류 계약
- `models/layerDocumentProjectOpenModel.ts`: native/file-input Open, linked Source lookup/preparation과 Ready-Degraded 계약
- `models/layerDocumentProjectReconnectModel.ts`: Missing/Error read model, fingerprint 확인과 reconnect 결과 계약
- `models/layerDocumentSourceRuntimeResolutionModel.ts`: unresolved/resolving/available/missing/error와 File/Handle/permission runtime port
- `adapters/layerDocumentProjectPersistenceCodec.ts`: canonical UTF-8 Save와 container dispatch/schema migration/normalize/validation Load
- `adapters/layerDocumentProjectBrowserWriteAdapter.ts`: native file picker/write와 Blob download fallback
- `adapters/layerDocumentProjectBrowserOpenAdapter.ts`: native open picker와 hidden `.ziq` file input fallback
- `adapters/layerDocumentProjectLinkedSourcePreparationAdapter.ts`: 저장된 PSD identity로 새 pixel Runtime 재생성
- `adapters/layerDocumentProjectReconnectBrowserAdapter.ts`: document Source 확장자 기준 native/hidden-input 파일 재지정
- `controllers/layerDocumentProjectLifecycleController.ts`: canonical savepoint, stale operation 폐기와 검증 후 Replace 조정
- `controllers/layerDocumentProjectSaveController.ts`: immutable snapshot, write 직렬화, 성공 시 savepoint/target commit
- `controllers/layerDocumentProjectOpenController.ts`: candidate 검증, linked Source 준비, 원자 Replace와 Runtime 등록
- `controllers/layerDocumentProjectReconnectController.ts`: fingerprint gate, dependent Source 복구와 targeted cache 교체
- `state/layerDocumentSourceRuntimeResolutionStore.ts`: Project/History 밖의 Source 해석 상태 저장소
- `controllers/layerDocumentPsdPreparedSessionController.ts`: prepare/confirm/cancel session
- `controllers/layerDocumentLibraryController.ts`: Library command/read port
- `import/*`: PSD parse, analysis, plan, LayerDocument/Source Registry build

Prepared PSD runtime은 confirm 전까지 Project 밖에 있고 cancel/failure에서 dispose된다. PSD import는 한 번 읽은 ArrayBuffer를 parse와 SHA-256 계산에 함께 사용한다. Confirm 성공 시 Plain Data transaction과 runtime registration이 일관되게 적용된다.

## 5. Render — `src/render`

### `src/render`

- `adapters/layerDocumentRuntimeInputAdapter.ts`: Project + Source descriptor + runtime resolution + frame + Draft를 `EvaluatedScene`으로 평가하고, Editor Overlay projection을 평가 후 별도로 조합
- `helpers/layerDocumentRuntimeEvaluationHelpers.ts`: Transform/Animation/Modifier/Draft 평가
- `helpers/layerDocumentRuntimeCacheKeyHelpers.ts`: Source resource key와 Layer result key 분리
- `models/layerDocumentRuntimeModel.ts`: Runtime target, Draft preparation,
  Frame Evaluation과 Editor frame read model의 현재 계약
- `models/evaluatedSceneModel.ts`: canonical `layerDocumentId`와
  LayerDocument별 local frame을 보존하는 evaluated scene
- `models/rendererResultModel.ts`: Preview/Accurate 결과와 Accurate 호출 계약
- `renderers/accurateRenderer.ts`: 현재 Frame 전체 `RenderFrame` command 생성
- `renderers/previewRenderer.ts`: PreviewScene 생성과 previous-scene node reuse
- `adapters/canvas2dPreviewNodeRenderer.ts`: node-native visual resolver로 Preview draw
- `adapters/canvas2dPreviewSceneAdapter.ts`: full/skip/dirty region Canvas2D 실행
- `adapters/canvas2dRenderAdapter.ts`: Accurate `RenderFrame` 전체 Canvas2D draw와
  reusable surface allocation
- `helpers/previewSceneDirtyRegionHelpers.ts`: dirty bounds와 incremental draw plan
- `state/layerDocumentSourceRuntimeResourceCache.ts`: Source별 runtime registration, suspend/restore, targeted invalidation, dispose-once
- `testing/index.ts`: Render 내부 helper를 제품 public barrel과 분리한
  verification seam

Preview/Accurate Renderer 모두 같은 `EvaluatedScene`을 입력으로 사용하고
`layerDocumentId`, `sourceId`, `sourceResourceCacheKey`,
`layerResultCacheKey`를 전달한다. Editor 제품 Canvas는 Preview Renderer만
사용하며 Accurate Renderer는 전체 Frame 생성용 direct callable로 유지한다.
저장 Project는 Canvas/ImageBitmap/decoded resource를 소유하지 않는다.

현재 Evaluated Scene과 Renderer output은 Placement/UI의 위→아래 순서를
유지한다. Canvas2D Preview/Accurate painter가 canonical 배열과 node reference를
복제하지 않고 각 깊이를 뒤에서 앞으로 순회해 아래→위 painter order를 만든다.
Direct Selection은 canonical 위→아래 순서를 그대로 사용한다. identity/cache
복구와 LayerDocument 전환 후 최적화 wiring 상태는
`docs/completed/59_render_runtime_optimization_architecture_audit.md`에 기록한다.
Preview/Accurate 역할 전환 완료 기록은
`docs/completed/62_preview_accurate_renderer_architecture.md`를 따른다.

## 6. Canvas Panel Engine과 cache

### `src/engines/canvas`

- `useLayerDocumentCanvasEngine.ts`: Canvas Panel의 controller/runtime 조립과
  공개 view props
- `useCanvasViewportRuntime.ts`: zoom, pan, workspace state와 Viewport
  Controller를 조립하는 Canvas 내부 Runtime
- `adapters/layerDocumentCanvasReadAdapter.ts`: Owner/Timeline/Draft 입력을
  단일 Canvas read model로 변환하고 `previewQuality`를 Source 요청의
  `sourceSamplingQuality`로 명시적으로 연결
- `adapters/layerDocumentCanvasRenderAssetAdapter.ts`: Source runtime을 renderer visual로 변환
- `models/canvasPreviewPaneModel.ts`: Feature Preview pane가 소비하는 Canvas
  public view props 계약
- `adapters/layerDocumentCanvasCommandAdapter.ts`: select/draft/commit semantic command
- `adapters/layerDocumentCanvasCommandPortAdapter.ts`: Canvas command를
  Draft/Owner selection/Timeline playback 공개 port에 연결
- `adapters/layerDocumentCanvasDraftAdapter.ts`: shared Draft port를 통한
  Canvas pointer/motion-path Draft publication, rejection과 commit 전달
- `models/layerDocumentCanvasReadModel.ts`: mode tag 없는 단일 Canvas read,
  renderer/overlay/interaction 계약
- `controllers/useCanvasRenderController.ts`: Preview draw, Dirty Region과
  Draft 중 cache bypass 조정
- `controllers/useLayerDocumentCanvasDirectSelectionController.ts`: direct selection
- `helpers/layerDocumentCanvasSelectionHelpers.ts`:
  selection-highlight/gizmo/motion-path projection
- `helpers/canvasSelectionHighlightHelpers.ts`: 선택된 Source Alpha를
  2px outline과 screen-tone Highlight로 그리는 제품 helper
- `adapters/canvasSelectionHighlightBrowserAdapter.ts`: Highlight scratch
  surface의 Browser Canvas adapter
- `models/canvasSelectionHighlightModel.ts`: Selection Highlight view model
- `state/compositionPreviewCacheStore.ts`: Preview Group composition surface cache
- `engines/library/runtime/libraryHoverPreviewRuntime.ts`: 라이브러리 레이어·그룹 합성 이미지와 오디오 파형 호버 미리보기
- `state/previewSurfaceCacheStore.ts`: quality/scale/size key surface pool과 LRU
- `state/runtimeMetricsStore.ts`: Preview/Accurate/Dirty/Cache/Surface 관찰 counter
- `state/canvasFpsRuntimeStore.ts`: 실제 Canvas paint 시각의 rolling FPS와
  낮은 빈도의 UI 구독값
- `useCanvasPreviewRuntime.ts`: backing-scale-only quality와 cache/runtime resource 조립
- `testing/index.ts`: Cache/Metrics/internal helper를 제품 public barrel과
  분리한 verification seam

Cache는 다음 네 층으로 분리된다.

1. Source runtime cache: Source 원본 resource
2. Layer result key: frame/revision/Draft별 evaluated result identity
3. Composition preview cache: Group 내부 content identity 기반 Preview surface
4. Surface pool: quality/scale/logical/pixel size별 재사용 Canvas

`previewQuality`는 root/offscreen Canvas의 backing scale을 소유하고,
`sourceSamplingQuality`는 Frame Evaluation/Source request의 sampling 계약을
소유한다. Canvas Read Adapter 한 곳에서 두 값을 연결한다. Source resource
수명은 LayerDocument Source Runtime Cache가 단독으로 관리하며 UI는 존재하지
않는 bitmap cache memory를 표시하지 않는다.

Group의 바깥 Transform Draft는 자식 content reference가 같으면 기존
Composition surface를 재사용한다. 자식 visual이 바뀐 경우에만 surface를
무효화하고 다시 합성하며, root Canvas는 이전/다음 Bounds의 Dirty Region만
다시 그린다. Canvas 직접 선택은 Source Alpha Mask를 유지하고 선택 강조는
같은 Mask 바깥에 2px 선과 거리에 따라 밀도가 줄어드는 점 스크린톤을
그린다. Group 외부 Transform에서는 Alpha/tone scratch를 재사용하고
Projection만 갱신하며 Blur Glow는 사용하지 않는다.

## 7. Timeline, Properties, Library

### `src/engines/timeline`

- `useLayerDocumentTimelineEngine.ts`: Timeline Engine facade
- `helpers/layerDocumentTimelineViewModelHelpers.ts`: placement/animation/selection을 row와 keyframe으로 projection
- `controllers/layerDocumentTimelineInteractionController.ts`: move/trim/reorder/keyframe Draft와 commit intent
- `controllers/timelinePointerDragSessionController.ts`: Timeline pointer ID,
  capture, global listener와 exactly-once commit/cancel DOM 수명
- `state/useTimelinePointerDragSessionRuntime.ts`: 공통 Pointer Drag
  Controller의 React wiring, active type과 선택적 auto-scroll 좌표 보정
- `features/timeline/components/TimelineFormulaTrackRow.tsx`: `입뻥긋(기본)`
  opacity segment와 내부 전환선 content UI
- `features/timeline/components/TimelineAccelerationTrackRow.tsx`: 가속·감속
  curve content UI
- `features/timeline/components/TimelineFormulaClip.tsx`: 수식 row label, box,
  양끝 trim, Draft와 commit을 공유하는 shell. 입뻥긋과 가속·감속 content를
  주입받고 공통 Pointer Drag Session Runtime을 사용한다.
- `controllers/layerDocumentTimelineNavigationController.ts`: active Group/selection navigation
- `state/layerDocumentTimelinePlaybackRuntime.ts`: current frame/range, isPlaying, clock, scheduler와 transport를 단독 소유하는 Timeline Runtime 및 validity command
- `adapters/layerDocumentTimelineConsumerAdapter.ts`: placement/Source
  resolution을 Timeline consumer row로 projection
- `adapters/layerDocumentTimelineIntentCommitAdapter.ts`: Timeline intent의
  transaction과 keyframe selection commit 준비

Timeline은 Layer를 저장하지 않고 LayerDocument placement/animation을 표시한다.

### `src/engines/properties`

- `useLayerDocumentPropertiesEngine.ts`: Composer만 호출하고 공개
  `PropertiesEngineViewProps`를 반환하는 얇은 Properties Panel Engine facade
- `composers/useLayerDocumentPropertiesComposer.ts`: 서로 독립인 Numeric Draft,
  Visual, Audio, Modifier Controller 결과를 공개 Controller와 ViewProps로 조립한다.
  Controller 실행 순서·조건과 제품 규칙은 결정하지 않는다.
- `composers/propertiesViewPropsComposer.ts`: 선택 종류와 Controller read 결과를
  기존 `PropertiesReadModel`/command 계약으로 조립한다.
- `controllers/propertiesNumericDraftController.ts`: focused input, 문자열 Draft,
  selection/revision/frame/reset scope와 cancel/reset 수명만 소유한다.
- `controllers/visualPropertiesController.ts`: Transform Preview→commit/cancel,
  scale link, Animation track와 keyframe selection command를 소유한다.
- `controllers/audioPropertiesController.ts`: Audio 이름·gain·mute·timing·source
  offset·fade Draft를 기존 `set-audio-properties` command 하나로 확정한다.
- `controllers/modifierPropertiesController.ts`: Modifier library/toggle/숫자 Draft,
  입뻥긋 연결 Audio와 가속·감속 command를 소유한다.
- `controllers/layerDocumentPropertiesController.ts`: 분리 전 Controller import를
  위한 호환 re-export이며 새 책임을 추가하지 않는다.
- `helpers/propertiesSelectionHelpers.ts`: 선택 종류와 Draft scope identity 순수 계산
- `helpers/propertiesDescriptorViewModelHelpers.ts`: type detail/capability/info 순수 projection
- `helpers/visualPropertiesHelpers.ts`: Transform patch/Animation track 순수 계산
- `helpers/visualPropertiesViewModelHelpers.ts`: Visual row/origin/keyframe 순수 projection
- `helpers/audioPropertiesHelpers.ts`: Audio descriptor/value/field 순수 projection
- `helpers/modifierPropertiesViewModelHelpers.ts`: Modifier view/library 순수 projection
- `adapters/layerDocumentPanelPreparationAdapter.ts`: Type별 panel descriptor
- `adapters/layerDocumentPropertiesCommandPreparationAdapter.ts`: Transform/Animation/Effect/Modifier command preparation
- `adapters/layerDocumentPropertiesCommandPortAdapter.ts`: 현재 frame과
  matching Draft를 반영한 Properties 표시 평가와 command port 구성
- `adapters/layerDocumentPropertiesOwnerCommandAdapter.ts`: panel
  preparation/commit, Canvas Draft rejection, transform/motion-path commit 조합
- `helpers/layerDocumentPropertiesDescriptorHelpers.ts`: 선택 LayerDocument의
  Properties descriptor projection
- `models/layerDocumentPropertiesModel.ts`: Properties 전용 capability,
  descriptor와 command preparation 계약
- `models/layerDocumentPanelModel.ts`: Type별 preparation port 계약

Properties는 선택된 동일 `layerDocumentId`의 committed 값과 matching Draft를 읽고, 외부 Source 가용성은 주입된 runtime resolution에서 읽는다.
Numeric Draft는 Project/Preview/History를 직접 바꾸지 않으며 각 type Controller가
제품별 clamp와 Owner command를 소유한다. Audio Effects Engine은 Properties와
직접 참조하지 않는 독립 형제 Engine이다.

### `src/engines/library`

- `useLayerDocumentLibraryEngine.ts`: Composer를 호출하고 공개 결과만 반환하는
  Library Panel Engine facade
- `composers/useLayerDocumentLibraryComposer.ts`: 서로 독립인 Controller 결과를
  `LibraryViewProps`와 외부 PSD import command로 조합한다. Controller의 실행
  순서·조건·비즈니스 규칙은 소유하지 않는다.
- `controllers/useLibraryPsdImportController.ts`: PSD picker, 다중 prepared plan,
  미리보기 편집, confirm/cancel/refresh와 external import 수명
- `controllers/useLibraryAudioImportController.ts`: 다중 Audio prepared resource,
  순서 보존 confirm과 partial-failure/stale cleanup
- `controllers/libraryRecordingSessionController.ts`: microphone request/start/stop,
  임시 prepared 검토, 다시 녹음, 확인 시 asset 저장→Owner confirm 순서와 stale/
  exactly-once cleanup을 소유하는 단일 workflow Controller
- `adapters/useLibraryRecordingControllerAdapter.ts`: Recording Controller를 React
  lifecycle과 external-store 구독에 연결하고 Project 교체 시 session을 dispose하는
  얇은 Adapter
- `controllers/useLibraryAssetCopyController.ts`: 원본 위치 유지/Project asset
  복사 확인 Promise와 Project replace/unmount 취소
- `controllers/useLibraryDragController.ts`: drag candidate 120ms 안정화,
  before/inside/after, drop/end와 keyboard move
- `controllers/useLibraryHoverPreviewController.ts`: 180ms hover delay,
  pending preview 위치와 Project replace/unmount cleanup
- `controllers/createLibraryNodeCommandController.ts`: visual/audio node의
  select, lock, visibility/mute, playback, rename, delete와 refresh routing
- `helpers/libraryPsdImportViewHelpers.ts`: PSD preview token/tree/plan과 순수
  preview reorder projection
- `helpers/libraryTreeProjectionHelpers.ts`: canonical Library tree projection,
  flatten/find와 keyboard target 계산
- `helpers/libraryDropTargetHelpers.ts`: drop 유효성, 위치와 hysteresis 계산
- `models/libraryModel.ts`: Library node/view props와 drag/drop 표시 계약
- `models/libraryEngineModel.ts`: Library Engine에 주입되는 Project/Audio/Recording/
  Recording Asset Store/Copy 최소 port 계약
- `models/libraryRecordingModel.ts`: 녹음 Dialog 상태와 가능한 intent snapshot 계약
- `adapters/layerDocumentLibrarySourceCommandAdapter.ts`: PSD Owner Source
  preparation/commit과 Runtime registration의 confirm/retry 원자성 및
  Library Source command port 조합
- 주입된 Project domain controller/port로
  import/refresh/delete/reorder/select intent를 연결
- Source Registry는 파일 상태를 제공하고, 실제 Library 계층과 순서는
  LayerDocument `parent/order`를 기준으로 표시한다. Source 가용성은 runtime
  resolution에서 읽는다.

Library Controller끼리는 직접 참조하지 않는다. 다단계 PSD/Audio/Recording
사용자 흐름은 각각 하나의 Controller가 처음부터 cleanup까지 소유한다. Composer는
Controller에 port를 주입하고 결과를 ViewProps로 모으기만 한다.

## 8. Pure Animation과 Layer Type 지원

- `src/models/layerModifierDefinition.ts`: canonical `LayerModifier` type별
  default, normalize/validate, Properties/Timeline descriptor와 evaluation kind를
  연결하는 typed Definition registry. 저장 원본이나 Runtime state는 소유하지 않는다.
- `src/animation/index.ts`: keyframe 조회/불변 갱신, 보간 평가, global/local
  frame 변환, Modifier 정규화/결정적 계산, motion-path sampling의 단일 pure
  public entry
- `src/animation/modifiers/mouthBasicAnalysis.ts`: decoded Audio PCM을
  RMS·smoothing·hysteresis로 분석해 전환 frame을 만들고, Audio/대상 placement를
  source-local 수식 clip으로 projection하며 opacity 0/100을 결정적으로 평가하는
  pure 모듈
- `src/animation/modifiers/accelerationEvaluation.ts`: 가속·감속 수식 클립의
  네 가지 preset progress와 선택 속성용 평가 frame 재배치

Animation은 state, Runtime authority, Project 편집 원본을 소유하지 않는다.
Timeline/Properties/Canvas/Render는 모두 `@/animation`을 canonical
public 경계로 사용하고 Project 편집은 계속 Owner command로 수행한다.
Render는 저장된 `LayerModifier`를 legacy `ModifierInstance`로 복제하지 않고
Definition evaluation kind를 통해 같은 Preview/Accurate 평가 경로에 연결한다.

- `src/layer-types/index.ts`: Drawing/Text/Audio query와 transaction preparation의
  단일 public entry
- `src/layer-types/drawingSupport.ts`: Drawing data clone query와 Owner에
  전달할 domain transaction 준비
- `src/layer-types/textSupport.ts`: Text data clone query와 Owner에 전달할
  domain transaction 준비
- `src/layer-types/audioSupport.ts`: Audio data clone query와 Owner에 전달할
  `replace-audio-document` transaction 준비
- `src/layer-types/ownerCommandSupport.ts`: Drawing/Text/Audio query와
  preparation/Owner commit을 조합하는 최종 adapter

Drawing/Text/Audio는 독립 Panel과 Runtime authority가 없으므로 Engine이
아니다. Properties Type section이 이 단일 entry를
소비하며 실제 변경은 Owner transaction으로 commit한다. Drawing/Text의
placeholder render와 Audio 저장·Owner command 계약은 유지하되 Audio
decode/재생/UI는 future work다. Video/Shape는 schema와 extension point만 있다.

## 9. Feature UI

- `src/features/preview`: Canvas, overlay, gizmo, quality UI
- `src/features/timeline`: Timeline rows, ruler, keyframes, interaction hooks
- `src/features/properties`: Properties sections와 controlled input UI
- `src/features/library`: `LibraryPanel` 조립, `LibraryProjectHeader`, `LibraryTree`,
  node 종류별 `LibraryNodeIdentity`, 공통 `LibraryNodeRow`/`LibraryNodeActions`/
  `LibraryTreeConnector`, Audio menu, 중앙 recording review Dialog, asset-copy dialog와 hover
  preview card presentation

Feature UI는 Project object를 직접 mutation하지 않고 Engine view props와
command를 사용한다. Engine barrel은 Feature component를 re-export하지
않으며 `src/editor/EditorShellLayout.tsx`가 네 Feature component를 직접
import해 배치한다.

## 10. Offline migration boundary

`src/models/offlineMigration/index.ts`만 이전 ProjectSource 문서를
LayerDocumentProject로 바꾸는 명시적 offline API를 공개한다.

- `compositionModel.ts`, `timelineItemModel.ts`, `selectionModel.ts`:
  이전 Composition/Timeline/Selection 입력 모델
- `projectSourceModel.ts`, `projectSourceNormalization.ts`,
  `projectSourceValidation.ts`: 이전 ProjectSource schema와
  normalization/validation
- `projectSourceToLayerDocumentMigration.ts`,
  `projectSourceMigrationInputValidation.ts`: offline migration 진입점과
  입력 검증
- `projectSourceMigrationSourceBuilder.ts`,
  `projectSourceMigrationLayerBuilder.ts`: Source Registry와 LayerDocument
  builder
- `projectSourceMigrationIdentity.ts`: migration identity와 결과 계약

이 경계는 bootstrap이나 active UI/Engine에서 import하지 않는다. `src/models/index.ts`의 active public barrel도 이전 모델을 export하지 않는다.

## 11. Verification

`scripts/runVerificationSuite.mjs`는 `scripts/verify*.ts`를 이름순 실행한다. LayerDocument 관련 핵심 fixture:

- schema/normalization/offline migration
- owner transaction/history/selection
- duplicate/group/animation/effect/modifier
- PSD import/refresh/source lifecycle/runtime GC
- Cut별 Audio prepare/confirm/cancel, shared Source와 decoded resource 재사용
- Editor Audio single-active audition과 Project/Source lifecycle cleanup
- Library Cut 하위 Audio Layer projection, imported/recorded 아이콘과 audition/mute/name/delete command
- Timeline Audio row/waveform, source-bounded timing Draft와 single-clock Audio synchronization
- Library Cut/Group/visual/Audio 공통 canonical hierarchy reorder와
  same/cross-parent drag/drop single-transaction command
- Library Engine facade, Composer/Controller/Helper import boundary와 순수 tree/drop
  helper, Project replace 시 prompt/prepared/drag/hover cleanup
- Project-root/Cut Audio import, 다중 Audio 선택, Project `psd/`·`audio/`
  asset copy와 relative locator
- fake microphone/recorder 기반 직접 녹음 cancel/error/stale/confirm과 자원 정리
- Audio Properties 전용 name/gain/mute/timing/source offset/fade Runtime Draft와
  단일 Owner transaction clamp/undo 계약
- Properties Numeric Draft/Visual/Audio/Modifier Controller 분리, 선택 type별
  command isolation과 Engine/Composer/Controller/Helper import boundary
- Audio Effects ordered envelope, Draft/단일 History command, stale selection 거부와
  audition graph reconcile
- Noise Gate strength/threshold/floor/attack/release pure DSP, AudioWorklet/fallback
  graph order와 비동기 준비 동기화/cleanup
- MP4/WebM Audio timing/effect mix, fake MediaRecorder track 포함과 cancel cleanup,
  GIF/WebP no-audio 경계
- `.ziq` canonical round trip/container·schema migration/input-limit 거부
- schema 1→2→3 migration, Source runtime resolution, 단일 PSD ArrayBuffer parse/hash
- Canvas/Timeline/Properties/Library public port integration
- pure Animation public entry의 keyframe/evaluation/frame conversion/modifier/motion-path 계산
- Audio 분석 기반 `입뻥긋(기본)` 전환 생성과 opacity 평가
- Drawing/Text/Audio Owner transaction과 기존 placeholder descriptor
- Engine import boundary와 최종 public barrel/Editor wiring
- Preview/Accurate contract, previous-scene reuse, dirty region,
  composition/surface/source cache
- active Preview Metrics 명칭과 zero-clone `painterClone` sentinel

`verifyLayerDocumentPreviewRuntimeCache.ts`가 runtime cache A-F 계약을 한 곳에서 검증한다.
`verifyLayerDocumentRenderObservationBaseline.ts`는 현재 LayerDocument
profiling identity와 painter clone, Dirty Region, Composition/Surface
Cache의 최적화 전 정적 Baseline을 고정한다.

정적 종료 검증은 `npm test`, `npm run lint`, `npm run build`, `git diff --check`다.
실제 Browser mic permission/MediaRecorder codec/AudioWorklet와 청감, Library drag,
Timeline/Properties pointer 조작 QA는 아직 실행하지 않았으며 별도 요청이 있을 때 수행한다.

## 12. 영구 Architecture 지도

- `docs/architecture/10_project_architecture.md`: Project, Layer Document,
  Project Owner, Panel Engine과 Composition Root
- `docs/architecture/11_render_architecture.md`: Frame Evaluation, Preview,
  Accurate, Canvas Draw와 Editor Overlay
- `docs/architecture/12_timeline_playback_architecture.md`: Placement, Timeline
  UI와 playback Runtime
- `docs/architecture/13_history_draft_architecture.md`: Transaction, History,
  Undo/Redo와 Draft/Commit
- `docs/architecture/14_canvas_overlay_architecture.md`: Canvas interaction,
  Selection, Handle, Motion Path와 선택 강조
- `docs/architecture/15_source_architecture.md`: Source Registry, Runtime
  resource, Refresh와 Reconnect
- `docs/architecture/16_animation_architecture.md`: Animation, Keyframe,
  Modifier, Evaluation과 Motion Path sampling
- `docs/architecture/17_persistence_lifecycle_architecture.md`: Save/Open,
  Project Replace, Migration과 Missing Source lifecycle

## 13. 완료 문서 지도

- `docs/completed/40_modifier_library.md`: Modifier Library
- `docs/completed/41_psd_import_workflow.md`: PSD import/refresh의 역사와 당시 구현
- `docs/completed/42_preview_quality_and_memory_cache.md`: backing-scale-only preview quality와 resource lifecycle
- `docs/completed/43_dual_renderer_architecture.md`: dual renderer 역사
- `docs/completed/44_preview_runtime_optimization.md`: preview runtime optimization
- `docs/completed/45_editor_draft_runtime_integration.md`: Draft runtime 도입
- `docs/completed/46_transform_origin_editing.md`: transform origin
- `docs/completed/47_canvas_engine_responsibility_refactoring.md`: Canvas 책임 분리
- `docs/completed/48_canvas_visual_layer_selection.md`: visual selection
- `docs/completed/49_transform_drag_runtime_continuity_optimization.md`: drag continuity
- `docs/completed/50_measured_preview_interaction_runtime_optimization.md`: measured optimization
- `docs/completed/51_timeline_navigation_ui_improvement.md`: Timeline navigation
- `docs/completed/52_radial_transform_handle_size_adjustment.md`: transform handle
- `docs/completed/53_layer_composition_icon_system.md`: icon system
- `docs/completed/54_editor_shared_state_cross_engine_synchronization_investigation.md`: cutover 전 정적 조사
- `docs/completed/55_layer_type_future_engine_foundation.md`: 이전 Foundation 기록, 현재 구조로 superseded
- `docs/completed/56_layer_document_architecture.md`: LayerDocument 전환 완료
  당시 Architecture 기록. 현재 기준은 `docs/architecture/10_project_architecture.md`
- `docs/completed/57_layer_document_persistence_project_lifecycle.md`: `.sfep` persistence,
  Save/Open/Reconnect 완료 기록. 현재 기준은
  `docs/architecture/17_persistence_lifecycle_architecture.md`
- `docs/completed/58_editor_project_owner_panel_engine_architecture.md`: Editor Project Owner,
  Composition Root와 네 Panel Engine 전환 완료 기록
- `docs/completed/59_render_runtime_optimization_architecture_audit.md`: 현재 Render/Canvas
  최적화 wiring, painter order identity 회귀, cache/metrics/quality 복구
  우선순위 조사
- `docs/completed/60_render_runtime_architecture_inventory.md`: 당시 Full/Fast
  명칭 기준의 Runtime, 소유권, Cache 계층, 비활성 잔여 경로 조사 기록
- `docs/completed/61_render_runtime_bible.md`: 비개발자도 이해할 수 있도록 정리한 Render
  전체 흐름, 모든 관련 Runtime의 소유권·수명·사용 관계·용어·사용 여부
- `docs/completed/62_preview_accurate_renderer_architecture.md`: Preview/Accurate
  Renderer 역할 전환과 공용 EvaluatedScene 완료 기록
- `docs/completed/63_library_audio_foundation.md`: Library 전환, Audio schema v3,
  import/녹음/Timeline/Properties/Effects/Noise Gate/영상 출력 Audio mix 완료 기록
- `docs/completed/84_library_engine_responsibility_split.md`: Library Engine을 얇은
  facade와 Composer/Controller/Helper/UI presentation으로 분리한 완료 기록
