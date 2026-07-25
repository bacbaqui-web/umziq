# Source Map

> 현재 기준: LayerDocument cutover 이후
>
> 아키텍처 설명은 `56_layer_document_architecture.md`, 저장/불러오기와 Project lifecycle 상세는 `57_layer_document_persistence_project_lifecycle.md`를 함께 본다. 이 문서는 현재 존재하는 소스와 책임만 설명하며 삭제된 이전 구현은 나열하지 않는다.

## 1. 현재 실행 흐름

```text
main.tsx
  → App
  → EditorShell
  → useEditorCompositionRoot
      → useLayerDocumentEditorOwner
      → LayerDocument Project Owner
      → useLayerDocumentEditorRuntime
      → LayerDocument Consumer Assembly
      → Project Lifecycle / Save / Open / Reconnect ports
      → Source Runtime Resolution / Resource Registry
      → shared Transform Draft / Timeline Runtime
      → useLayerDocumentPanelEnginePorts
      → Canvas / Timeline / Properties / PSD Tree Engine
  → EditorShellLayout
      → Project Lifecycle Bar / PSD Tree / Canvas / Properties / Timeline UI
```

`src/editor/useEditorCompositionRoot.ts`가 제품 Composition Root다. 동일
Project Owner와 저장되지 않는 Editor Runtime의 최소 port를 네 Panel
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
- `common.transform`, `placement`, `animation`, `effects`, `modifiers`: 모든 Type의 공통 편집 데이터
- `data`: PSD, Drawing, Text, Audio, Video, Shape, Group, Unknown별 discriminated data

`renderItemId`는 renderer 결과에서 쓰이는 derived compatibility 이름일 뿐 저장 authority가 아니다. Timeline row는 별도 저장 entity가 아니며 `LayerDocument.common.placement`의 projection이다.

### LayerDocument 모델 파일

- `layerDocumentNormalization.ts`: schema normalize와 기본값
- `layerDocumentSchemaMigration.ts`: 저장 데이터만 다루는 pure schema 1→2 migration
- `layerDocumentSourceDescriptorHelpers.ts`: 저장 Source descriptor의 표시 경로와 visual fingerprint projection
- `layerDocumentValidation.ts`: 전체 공개 validation 조립
- `layerDocumentStructureValidation.ts`: Project/Layer 공통 구조 검증
- `layerDocumentGraphValidation.ts`: parent/root graph 검증
- `layerDocumentSourceValidation.ts`: Source Registry와 참조 검증
- `layerDocumentSelectionModel.ts`: `layerDocumentId` 기반 선택
- `layerDocumentGroupScopeModel.ts`: 활성 Group과 자식 scope
- `layerDocumentPlacementFrameHelpers.ts`: global/local frame 계산
- `layerDocumentTimelineReadModel.ts`: placement 기반 Timeline projection
- `layerDocumentTimelineIntentModel.ts`: Timeline semantic intent
- `layerDocumentTimelineIntentAdapter.ts`: intent를 transaction 입력으로 변환

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
- `project-owner/helpers/editorProjectOwnerPortHelpers.ts`: Owner port factory와 기존 Project Engine/cutover용 무상태 compatibility adapter
- `useLayerDocumentEditorOwner.ts`: 단일 Editor Project Owner 인스턴스 생성
- `useLayerDocumentEditorRuntime.ts`: consumer assembly, lifecycle/save/open/reconnect, Source Runtime, shared Draft와 Timeline Runtime 수명 관리
- `useLayerDocumentPanelEnginePorts.ts`: 동일 Owner/Runtime을 Canvas/Timeline/Properties/PSD Tree의 최소 입력 port로 변환
- `useEditorCompositionRoot.ts`: 네 Panel Engine 생성과 ViewProps 연결만 수행하는 Editor Composition Root
- `projectLifecycleUi.ts`: lifecycle 공개 포트만 사용하는 New/Open/Save/Save As/Close/Reconnect UI command와 구조화 ViewModel
- `ProjectLifecycleBar.tsx`: clean/dirty/saving/loading, 오류, Missing Source와 Reconnect entry를 표시하는 Shell 상단 UI
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

## 4. Project Owner 내부 구현과 compatibility

### `src/engines/project`

- `useLayerDocumentProjectOwner.ts`: Editor Project Owner를 위임하는 임시 React compatibility entry
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
- `models/layerDocumentProjectPersistenceModel.ts`: `.sfep` envelope, 제한값, Load Candidate와 구조화 오류 계약
- `models/layerDocumentProjectLifecycleModel.ts`: document/dirty/operation 축, operation token과 lifecycle runtime port
- `models/layerDocumentProjectBrowserWriteModel.ts`: native handle/Blob download capability와 Runtime write target 계약
- `models/layerDocumentProjectSaveModel.ts`: Save/Save As controller 결과와 오류 계약
- `models/layerDocumentProjectOpenModel.ts`: native/file-input Open, linked Source lookup/preparation과 Ready-Degraded 계약
- `models/layerDocumentProjectReconnectModel.ts`: Missing/Error read model, fingerprint 확인과 reconnect 결과 계약
- `models/layerDocumentSourceRuntimeResolutionModel.ts`: unresolved/resolving/available/missing/error와 File/Handle/permission runtime port
- `adapters/layerDocumentProjectPersistenceCodec.ts`: canonical UTF-8 Save와 container dispatch/schema migration/normalize/validation Load
- `adapters/layerDocumentProjectBrowserWriteAdapter.ts`: native file picker/write와 Blob download fallback
- `adapters/layerDocumentProjectBrowserOpenAdapter.ts`: native open picker와 hidden `.sfep` file input fallback
- `adapters/layerDocumentProjectLinkedSourcePreparationAdapter.ts`: 저장된 PSD identity로 새 pixel Runtime 재생성
- `adapters/layerDocumentProjectReconnectBrowserAdapter.ts`: document Source 확장자 기준 native/hidden-input 파일 재지정
- `controllers/layerDocumentProjectLifecycleController.ts`: canonical savepoint, stale operation 폐기와 검증 후 Replace 조정
- `controllers/layerDocumentProjectSaveController.ts`: immutable snapshot, write 직렬화, 성공 시 savepoint/target commit
- `controllers/layerDocumentProjectOpenController.ts`: candidate 검증, linked Source 준비, 원자 Replace와 Runtime 등록
- `controllers/layerDocumentProjectReconnectController.ts`: fingerprint gate, dependent Source 복구와 targeted cache 교체
- `adapters/layerDocumentSourceRuntimeResolutionStore.ts`: Project/History 밖의 Source 해석 상태 저장소
- `adapters/layerDocumentPsdPreparedSessionController.ts`: prepare/confirm/cancel session
- `adapters/layerDocumentPsdTreeController.ts`: PSD Tree command/read port
- `import/*`: PSD parse, analysis, plan, LayerDocument/Source Registry build

Prepared PSD runtime은 confirm 전까지 Project 밖에 있고 cancel/failure에서 dispose된다. PSD import는 한 번 읽은 ArrayBuffer를 parse와 SHA-256 계산에 함께 사용한다. Confirm 성공 시 Plain Data transaction과 runtime registration이 일관되게 적용된다.

## 5. Active consumer assembly

### `src/cutover`

이 디렉터리는 이름과 달리 현재 실행 경로의 active wiring이다.

- `createLayerDocumentConsumerCutoverAssembly.ts`: Project/selection/scope/runtime/source command 및 read port 조립
- `layerDocumentConsumerCutoverModel.ts`: 조립 port 계약
- `layerDocumentCanvasCommandPortAdapter.ts`: Canvas semantic command 연결
- `layerDocumentTimelineConsumerAdapter.ts`: Timeline projection
- `layerDocumentTimelineIntentCommitAdapter.ts`: Timeline intent commit
- `layerDocumentUiControllerPortAdapters.ts`: Properties/PSD Tree UI port
- `applyLayerDocumentRuntimeCacheEffect.ts`: owner effect에 따른 targeted runtime invalidation/GC

Engine은 이 디렉터리를 import하지 않는다. Editor owner가 assembly를 생성하고 필요한 port를 각 Engine에 주입한다.

## 6. Playback/Render Core Engine

### `src/engines/playback-render`

- `adapters/layerDocumentRuntimeInputAdapter.ts`: Project + Source descriptor + runtime resolution + frame + Draft를 node-native runtime input으로 평가
- `helpers/layerDocumentRuntimeEvaluationHelpers.ts`: Transform/Animation/Modifier/Draft 평가
- `helpers/layerDocumentRuntimeCacheKeyHelpers.ts`: Source resource key와 Layer result key 분리
- `models/evaluatedSceneModel.ts`: `layerDocumentId`를 보존하는 evaluated scene
- `renderers/accurateRenderer.ts`: full-render command 생성
- `renderers/fastPreviewRenderer.ts`: PreviewScene 생성과 previous-scene node reuse
- `adapters/canvas2dPreviewNodeRenderer.ts`: node-native visual resolver로 fast draw
- `adapters/canvas2dPreviewSceneAdapter.ts`: full/skip/dirty region Canvas2D 실행
- `helpers/previewSceneDirtyRegionHelpers.ts`: dirty bounds와 incremental draw plan
- `helpers/previewSceneUpdateHelpers.ts`: Draft/commit preview transform 갱신
- `adapters/layerDocumentSourceRuntimeResourceCache.ts`: Source별 runtime registration, suspend/restore, targeted invalidation, dispose-once

Full/fast renderer 모두 `layerDocumentId`, `sourceId`, `sourceResourceCacheKey`, `layerResultCacheKey`를 전달한다. 저장 Project는 Canvas/ImageBitmap/decoded resource를 소유하지 않는다.

## 7. Canvas Core Engine과 cache

### `src/engines/canvas`

- `useLayerDocumentCanvasComposition.ts`: Canvas controller composer와 공개 view props
- `adapters/layerDocumentCanvasModeAdapter.ts`: owner read model을 Canvas mode로 변환
- `adapters/layerDocumentCanvasRenderAssetAdapter.ts`: Source runtime을 renderer visual로 변환
- `adapters/layerDocumentCanvasCommandAdapter.ts`: select/draft/commit semantic command
- `controllers/usePreviewUpdatePipeline.ts`: immutable base scene와 active Draft scene
- `controllers/useCanvasRenderController.ts`: full/fast draw와 Draft cache bypass
- `controllers/useLayerDocumentCanvasDirectSelectionController.ts`: direct selection
- `helpers/layerDocumentCanvasSelectionHelpers.ts`: glow/gizmo/motion-path projection
- `state/dirtyStateStore.ts`: node dirty-kind snapshot
- `state/compositionPreviewCacheStore.ts`: fast composition surface cache
- `state/previewSurfaceCacheStore.ts`: quality/scale/size key surface pool과 LRU
- `state/runtimeMetricsStore.ts`: runtime counter
- `useCanvasPreviewRuntime.ts`: quality, memory estimate, cache/runtime resource 조립

Cache는 다음 네 층으로 분리된다.

1. Source runtime cache: Source 원본 resource
2. Layer result key: frame/revision/Draft별 evaluated result identity
3. Composition preview cache: fast renderer composition surface
4. Surface pool: quality/scale/logical/pixel size별 재사용 Canvas

Draft 중에는 composition cache 전체를 우회해 immutable committed snapshot을 오염시키지 않는다.

## 8. Timeline, Properties, PSD Tree

### `src/engines/timeline`

- `useLayerDocumentTimelineEngine.ts`: Timeline Engine facade
- `helpers/layerDocumentTimelineViewModelHelpers.ts`: placement/animation/selection을 row와 keyframe으로 projection
- `adapters/layerDocumentTimelineInteractionController.ts`: move/trim/reorder/keyframe Draft와 commit intent
- `adapters/layerDocumentTimelineNavigationController.ts`: active Group/selection navigation
- `adapters/layerDocumentTimelinePlaybackAdapter.ts`: current frame/range, isPlaying, clock, scheduler와 transport를 단독 소유하는 Timeline Runtime 및 validity command

Timeline은 Layer를 저장하지 않고 LayerDocument placement/animation을 표시한다.

### `src/engines/properties`

- `adapters/layerDocumentPropertiesController.ts`: 선택 LayerDocument read/command controller
- `adapters/useLayerDocumentPropertiesEngine.ts`: React facade
- `adapters/layerDocumentPanelPreparationAdapter.ts`: Type별 panel descriptor
- `adapters/layerDocumentPanelCommandAdapter.ts`: Transform/Animation/Effect/Modifier commit

Properties는 선택된 동일 `layerDocumentId`의 committed 값과 matching Draft를 읽고, 외부 Source 가용성은 주입된 runtime resolution에서 읽는다.

### `src/engines/psd-tree`

- `useLayerDocumentPsdTreeEngine.ts`: PSD Tree UI Engine
- Project Engine의 controller/port를 받아 import/refresh/delete/reorder/select intent를 연결
- Source Registry와 Group LayerDocument graph를 Tree read model로 표시하며 Source 가용성은 runtime resolution에서 읽음

## 9. Pure Animation과 Layer Type 지원

- `src/animation/index.ts`: keyframe 조회/불변 갱신, 보간 평가, global/local
  frame 변환, Modifier 정규화/결정적 계산, motion-path sampling의 단일 pure
  public entry
- `src/engines/animation/index.ts`: Render Sprint까지 유지하는
  `@/engines/animation` compatibility re-export

Animation은 state, Runtime authority, Project 편집 원본을 소유하지 않는다.
Timeline/Properties/Canvas 같은 비-Render 소비자는 `@/animation`만 사용하고
Project 편집은 계속 Owner command로 수행한다. Playback/Render는 동결된 기존
import 경로를 compatibility entry를 통해 사용한다.

- `src/layer-types/index.ts`: Drawing/Text query와 transaction preparation,
  Audio unsupported capability의 단일 public entry
- `src/layer-types/drawingSupport.ts`: Drawing data clone query와 Owner에
  전달할 domain transaction 준비
- `src/layer-types/textSupport.ts`: Text data clone query와 Owner에 전달할
  domain transaction 준비
- `src/layer-types/audioSupport.ts`: 빈 Audio domain query와 변경 없는
  unsupported preparation

Drawing/Text/Audio는 독립 Panel과 Runtime authority가 없으므로 Engine이
아니다. Properties Type section과 cutover compatibility가 이 단일 entry를
소비하며 실제 변경은 Owner transaction으로 commit한다. Drawing/Text의
placeholder render와 최소 데이터 준비는 유지하고 Audio 편집/재생은 future
work다. Video/Shape는 schema와 extension point만 있다.

## 10. Feature UI

- `src/features/preview`: Canvas, overlay, gizmo, quality UI
- `src/features/timeline`: Timeline rows, ruler, keyframes, interaction hooks
- `src/features/properties`: Properties sections와 controlled input UI
- `src/features/psdtree`: PSD Tree, import dialog, refresh status UI

Feature UI는 Project object를 직접 mutation하지 않고 Engine view props와 command를 사용한다.

## 11. Offline migration boundary

`src/models/offlineMigration/index.ts`만 이전 ProjectSource 문서를 LayerDocumentProject로 바꾸는 명시적 offline API를 공개한다.

- 이전 모델/normalization/validation
- migration input validation
- Source Registry/LayerDocument builder
- identity mapping

이 경계는 bootstrap이나 active UI/Engine에서 import하지 않는다. `src/models/index.ts`의 active public barrel도 이전 모델을 export하지 않는다.

## 12. Verification

`scripts/runVerificationSuite.mjs`는 `scripts/verify*.ts`를 이름순 실행한다. LayerDocument 관련 핵심 fixture:

- schema/normalization/offline migration
- owner transaction/history/selection
- duplicate/group/animation/effect/modifier
- PSD import/refresh/source lifecycle/runtime GC
- `.sfep` canonical round trip/container·schema migration/input-limit 거부
- schema 1→2 migration, Source runtime resolution, 단일 PSD ArrayBuffer parse/hash
- Canvas/Timeline/Properties/PSD Tree consumer cutover
- pure Animation public entry의 keyframe/evaluation/frame conversion/modifier/motion-path 계산
- Drawing/Text Owner transaction, Audio unsupported capability와 기존
  placeholder descriptor
- engine import boundary와 active public barrel removal
- full/fast render, previous-scene reuse, dirty region, composition/surface/source cache

`verifyLayerDocumentPreviewRuntimeCache.ts`가 runtime cache A-F 계약을 한 곳에서 검증한다.

정적 종료 검증은 `npm test`, `npm run lint`, `npm run build`, `git diff --check`다. Browser QA와 실제 조작 QA는 별도 요청이 있을 때만 수행한다.

## 13. 영구 문서 지도

- `40_modifier_library.md`: Modifier Library
- `41_psd_import_workflow.md`: PSD import/refresh의 역사와 당시 구현
- `42_preview_quality_and_memory_cache.md`: preview quality/memory
- `43_dual_renderer_architecture.md`: dual renderer 역사
- `44_preview_runtime_optimization.md`: preview runtime optimization
- `45_editor_draft_runtime_integration.md`: Draft runtime 도입
- `46_transform_origin_editing.md`: transform origin
- `47_canvas_engine_responsibility_refactoring.md`: Canvas 책임 분리
- `48_canvas_visual_layer_selection.md`: visual selection
- `49_transform_drag_runtime_continuity_optimization.md`: drag continuity
- `50_measured_preview_interaction_runtime_optimization.md`: measured optimization
- `51_timeline_navigation_ui_improvement.md`: Timeline navigation
- `52_radial_transform_handle_size_adjustment.md`: transform handle
- `53_layer_composition_icon_system.md`: icon system
- `54_editor_shared_state_cross_engine_synchronization_investigation.md`: cutover 전 정적 조사
- `55_layer_type_future_engine_foundation.md`: 이전 Foundation 기록, 현재 구조로 superseded
- `56_layer_document_architecture.md`: 현재 canonical LayerDocument architecture
