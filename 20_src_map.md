# Source Map

> 현재 기준: LayerDocument cutover 이후
>
> 아키텍처 설명은 `56_layer_document_architecture.md`를 함께 본다. 이 문서는 현재 존재하는 소스와 책임만 설명하며 삭제된 이전 구현은 나열하지 않는다.

## 1. 현재 실행 흐름

```text
main.tsx
  → App
  → EditorShell
  → useEditorCompositionRoot
  → useLayerDocumentEditorOwner
      → LayerDocument Project Owner
      → LayerDocument Consumer Assembly
      → Source Runtime Registry
      → Timeline / Properties / PSD Tree ports
  → useLayerDocumentCanvasComposition
  → EditorShellLayout
      → PSD Tree / Canvas / Properties / Timeline UI
```

`src/editor/useEditorCompositionRoot.ts`가 제품 Composition Root다. Shell/Canvas의 로컬 UI 상태를 조립하고, `useLayerDocumentEditorOwner.ts`가 제공하는 동일 Project owner와 command/read port를 모든 소비자에 연결한다.

## 2. 저장 데이터와 identity

### `src/models/layerDocumentModel.ts`

- `LayerDocumentProject`: metadata와 payload를 가진 유일한 Project 저장 루트
- `payload.layerDocumentsById`: 모든 편집 가능한 LayerDocument
- `payload.sourceRegistry.sourcesById`: 외부 원본 identity와 refresh/reconnect metadata
- `layerDocumentId`: 저장·선택·편집·History의 canonical identity
- `common.source`: Source Registry 참조
- `common.transform`, `placement`, `animation`, `effects`, `modifiers`: 모든 Type의 공통 편집 데이터
- `data`: PSD, Drawing, Text, Audio, Video, Shape, Group, Unknown별 discriminated data

`renderItemId`는 renderer 결과에서 쓰이는 derived compatibility 이름일 뿐 저장 authority가 아니다. Timeline row는 별도 저장 entity가 아니며 `LayerDocument.common.placement`의 projection이다.

### LayerDocument 모델 파일

- `layerDocumentNormalization.ts`: schema normalize와 기본값
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
- `useLayerDocumentEditorOwner.ts`: Project owner, runtime Source cache, Draft session, consumer assembly, panel engines 조립
- `useEditorCompositionRoot.ts`: Editor 전체 UI/Engine Composition Root
- `state/useEditorCanvasRuntimeState.ts`: drag, hover, pan 같은 Canvas 전용 세션 상태
- `state/useEditorShellLayoutState.ts`: panel size 같은 Shell 세션 상태
- `useEditorHistoryShortcuts.ts`: owner undo/redo에 keyboard intent 전달
- `EditorShell.tsx`, `EditorShellLayout.tsx`: UI 배치

Project 저장 데이터는 owner만 교체한다. 선택, active Group, playback range/current frame도 owner session에 있고 undo/redo snapshot과 함께 관리된다. PointerMove Transform은 `LayerDocumentTransformDraftSnapshot`만 바꾸며 PointerUp에서 transaction과 History 한 건으로 commit한다.

## 4. Project Core Engine

### `src/engines/project`

- `useLayerDocumentProjectOwner.ts`: React owner facade
- `actions/layerDocumentProjectOwnerReducer.ts`: owner action dispatch
- `actions/layerDocumentProjectOwnerLayerCommitReducer.ts`: Layer transaction commit
- `actions/layerDocumentProjectOwnerSourceCommitReducer.ts`: Source lifecycle commit
- `actions/layerDocumentProjectOwnerHistoryReducer.ts`: undo/redo
- `actions/layerDocumentProjectOwnerRuntimeSessionReducer.ts`: selection/playback session
- `actions/layerDocumentSourceImportTransaction.ts`: PSD import transaction
- `actions/layerDocumentPsdRefreshTransaction.ts`: stable Source identity 기반 refresh
- `actions/layerDocumentSourceDeleteTransaction.ts`: source/layer delete policy
- `actions/layerDocumentSourceLifecycleTransactions.ts`: source replace/reconnect/invalidate
- `adapters/layerDocumentPsdPreparedSessionController.ts`: prepare/confirm/cancel session
- `adapters/layerDocumentPsdTreeController.ts`: PSD Tree command/read port
- `import/*`: PSD parse, analysis, plan, LayerDocument/Source Registry build

Prepared PSD runtime은 confirm 전까지 Project 밖에 있고 cancel/failure에서 dispose된다. Confirm 성공 시 Plain Data transaction과 runtime registration이 일관되게 적용된다.

## 5. Active consumer assembly

### `src/cutover`

이 디렉터리는 이름과 달리 현재 실행 경로의 active wiring이다.

- `createLayerDocumentConsumerCutoverAssembly.ts`: Project/selection/scope/playback/runtime/source command 및 read port 조립
- `layerDocumentConsumerCutoverModel.ts`: 조립 port 계약
- `layerDocumentCanvasCommandPortAdapter.ts`: Canvas semantic command 연결
- `layerDocumentTimelineConsumerAdapter.ts`: Timeline projection
- `layerDocumentTimelineIntentCommitAdapter.ts`: Timeline intent commit
- `layerDocumentUiControllerPortAdapters.ts`: Properties/PSD Tree UI port
- `applyLayerDocumentRuntimeCacheEffect.ts`: owner effect에 따른 targeted runtime invalidation/GC

Engine은 이 디렉터리를 import하지 않는다. Editor owner가 assembly를 생성하고 필요한 port를 각 Engine에 주입한다.

## 6. Playback/Render Core Engine

### `src/engines/playback-render`

- `adapters/layerDocumentRuntimeInputAdapter.ts`: Project + Source + frame + Draft를 node-native runtime input으로 평가
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
- `adapters/layerDocumentTimelinePlaybackAdapter.ts`: playback session

Timeline은 Layer를 저장하지 않고 LayerDocument placement/animation을 표시한다.

### `src/engines/properties`

- `adapters/layerDocumentPropertiesController.ts`: 선택 LayerDocument read/command controller
- `adapters/useLayerDocumentPropertiesEngine.ts`: React facade
- `adapters/layerDocumentPanelPreparationAdapter.ts`: Type별 panel descriptor
- `adapters/layerDocumentPanelCommandAdapter.ts`: Transform/Animation/Effect/Modifier commit

Properties는 선택된 동일 `layerDocumentId`의 committed 값과 matching Draft를 읽는다.

### `src/engines/psd-tree`

- `useLayerDocumentPsdTreeEngine.ts`: PSD Tree UI Engine
- Project Engine의 controller/port를 받아 import/refresh/delete/reorder/select intent를 연결
- Source Registry와 Group LayerDocument graph를 Tree read model로 표시

## 9. Domain Engine

- `src/engines/drawing`: Drawing LayerDocument preparation/capability 경계
- `src/engines/text`: Text LayerDocument preparation/capability 경계
- `src/engines/audio`: Audio LayerDocument preparation/capability 경계
- `src/engines/animation`: 공통 animation/keyframe/modifier helper와 command 모델

Drawing/Text는 현재 placeholder render와 최소 데이터 준비까지만 제공한다. Audio의 편집/재생은 future work다. Video/Shape는 schema와 extension point만 있다.

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
- Canvas/Timeline/Properties/PSD Tree consumer cutover
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
