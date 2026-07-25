export {
  useLayerDocumentCanvasComposition,
  type LayerDocumentCanvasReadPort,
} from "@/engines/canvas/useLayerDocumentCanvasComposition";
export type { RendererMode } from "@/engines/playback-render";
export { useCanvasPreviewRuntime } from "@/engines/canvas/useCanvasPreviewRuntime";
export {
  PREVIEW_DEVICE_MEMORY_TIER_POLICIES,
  PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES,
} from "@/engines/canvas/constants/previewAutomaticQualityConstants";
export type {
  PreviewBuildReadModel,
} from "@/engines/canvas/models/previewBuildModel";
export type {
  PreviewDeviceMemoryTier,
  PreviewDeviceMemoryTierPolicy,
} from "@/engines/canvas/constants/previewAutomaticQualityConstants";
export {
  PREVIEW_QUALITY_SCALE,
  RESOLVED_PREVIEW_QUALITIES,
} from "@/engines/canvas/constants/previewQualityConstants";
export type {
  PreviewAutomaticQualityInput,
  PreviewAutomaticQualityReason,
  PreviewAutomaticQualityResult,
  PreviewMemoryBudgetReason,
  PreviewMemoryBudgetResult,
} from "@/engines/canvas/models/previewAutomaticQualityModel";
export type {
  PreviewQualityPreference,
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";
export type {
  PreviewMemoryEstimate,
  PreviewMemoryEstimatesByQuality,
  PreviewMemorySource,
  PreviewMemorySourceEstimate,
} from "@/engines/canvas/models/previewMemoryModel";
export type {
  PreviewQualityControlCommands,
  PreviewQualityControlViewModel,
  PreviewQualityOptionViewModel,
} from "@/engines/canvas/models/previewQualityControlModel";
export {
  buildPreviewQualityControlViewModel,
  PREVIEW_QUALITY_LABELS,
} from "@/engines/canvas/helpers/previewQualityControlHelpers";
export {
  estimatePreviewMemory,
  estimatePreviewMemoryByQuality,
  estimatePreviewSourceMemory,
  formatPreviewMemory,
  getPreviewMemorySourceKey,
  scalePreviewPixelSize,
} from "@/engines/canvas/helpers/previewMemoryHelpers";
export { collectRenderFrameSourceIds } from "@/engines/canvas/helpers/previewRenderFrameHelpers";
export {
  resolveAutomaticPreviewQuality,
  resolvePreviewMemoryBudget,
} from "@/engines/canvas/helpers/previewAutomaticQualityHelpers";
export { createDirtyState } from "@/engines/canvas/state/dirtyStateStore";
export { createCompositionPreviewCacheRuntime } from "@/engines/canvas/state/compositionPreviewCacheStore";
export { createPreviewSurfaceCacheRuntime } from "@/engines/canvas/state/previewSurfaceCacheStore";
export { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
export {
  resolvePreviewCompositionCacheForRender,
} from "@/engines/canvas/controllers/useCanvasRenderController";
export {
  buildDirtySummary,
  createCleanDirtyStateSnapshot,
  createDirtySceneSnapshotFromPreviewScene,
  updateDirtyStateSnapshot,
} from "@/engines/canvas/helpers/dirtyStateHelpers";
export {
  applyPreviewNodeCache,
  applyPreviewNodeCacheFromScenes,
} from "@/engines/canvas/helpers/nodeCacheHelpers";
export { buildCompositionPreviewCacheKey } from "@/engines/canvas/helpers/compositionCacheKeyHelpers";
export { buildPreviewSurfaceCacheKey } from "@/engines/canvas/helpers/surfaceCacheKeyHelpers";
export {
  DIRTY_KINDS,
  type DirtyKind,
  type DirtyNodeRecord,
  type DirtyNodeSnapshot,
  type DirtySceneSnapshot,
  type DirtyStateResource,
  type DirtyStateSnapshot,
  type DirtySummary,
  type DirtyTargetKind,
  type PreviewSceneDirtySnapshotInput,
  type PreviewSceneDirtySnapshotOptions,
} from "@/engines/canvas/models/dirtyStateModel";
export type {
  PreviewNodeCacheResult,
  PreviewNodeCacheStats,
} from "@/engines/canvas/models/nodeCacheModel";
export type {
  CompositionPreviewCacheEntry,
  CompositionPreviewCacheKeyInput,
  CompositionPreviewCacheRuntimeOptions,
  CompositionPreviewCacheRuntime,
  CompositionPreviewCacheSnapshot,
} from "@/engines/canvas/models/compositionCacheModel";
export type {
  PreviewSurfaceCacheAcquireInput,
  PreviewSurfaceCacheKeyInput,
  PreviewSurfaceCacheRuntime,
  PreviewSurfaceCacheSnapshot,
} from "@/engines/canvas/models/surfaceCacheModel";
export {
  compareRuntimeMetricBaseline,
  compareRuntimeMetrics,
  createEmptyRuntimeMetricCounters,
} from "@/engines/canvas/helpers/runtimeMetricsHelpers";
export {
  RUNTIME_METRIC_COUNTER_NAMES,
  type ExpectedRuntimeMetrics,
  type RuntimeMetricDifference,
  type RuntimeMetricComparisonResult,
  type RuntimeMetricCounterName,
  type RuntimeMetricCounters,
  type RuntimeMetricExpectation,
  type RuntimeMetricsBaselineComparison,
  type RuntimeMetricsBaselineKind,
  type RuntimeMetricsComparison,
  type RuntimeMetricsResource,
  type RuntimeMetricsSnapshot,
} from "@/engines/canvas/models/runtimeMetricsModel";
export {
  PREVIEW_MIN_WORKSPACE_HEIGHT,
  PREVIEW_MIN_WORKSPACE_WIDTH,
  GIZMO_HANDLE_SIZE,
  SHORTFORM_FRAME_HEIGHT,
  SHORTFORM_FRAME_WIDTH,
} from "@/engines/canvas/constants/canvasConstants";
export type {
  PreviewMotionPathPoint,
  PreviewOverlay,
  PreviewOverlayCorners,
  ScaleHandleDirection,
} from "@/engines/canvas/models/canvasViewModel";
export type { CanvasSelectionGlowViewModel } from "@/engines/canvas/models/canvasSelectionGlowModel";
export type { CanvasDirectSelectionHoverViewModel } from "@/engines/canvas/models/canvasDirectSelectionModel";
export { resolveCanvasPreviewCursor } from "@/engines/canvas/helpers/canvasDirectSelectionCursorHelpers";
export {
  buildLayerDocumentCanvasModeReadModel,
} from "@/engines/canvas/adapters/layerDocumentCanvasModeAdapter";
export {
  useLayerDocumentCanvasOverlayAdapter,
} from "@/engines/canvas/adapters/useLayerDocumentCanvasOverlayAdapter";
export {
  useLayerDocumentCanvasInteractionAdapter,
} from "@/engines/canvas/adapters/useLayerDocumentCanvasInteractionAdapter";
export {
  useLayerDocumentCanvasPreviewBridge,
} from "@/engines/canvas/adapters/useLayerDocumentCanvasPreviewBridge";
export {
  useLayerDocumentCanvasDirectSelectionController,
} from "@/engines/canvas/controllers/useLayerDocumentCanvasDirectSelectionController";
export {
  createLayerDocumentCanvasCommands,
} from "@/engines/canvas/adapters/layerDocumentCanvasCommandAdapter";
export {
  createLayerDocumentCanvasNodeVisualResolver,
  createLayerDocumentCanvasRenderAssetPort,
} from "@/engines/canvas/adapters/layerDocumentCanvasRenderAssetAdapter";
export type {
  LayerDocumentCanvasRuntimeResourceAdapter,
} from "@/engines/canvas/adapters/layerDocumentCanvasRenderAssetAdapter";
export {
  buildLayerDocumentCanvasRenderFrame,
  buildLayerDocumentCanvasRendererReadModel,
} from "@/engines/canvas/helpers/layerDocumentCanvasRendererHelpers";
export {
  buildLayerDocumentCanvasDirectSelectionCandidates,
  buildLayerDocumentCanvasMotionPath,
  buildLayerDocumentCanvasSelectionReadModel,
  resolveLayerDocumentCanvasGlowCandidate,
} from "@/engines/canvas/helpers/layerDocumentCanvasSelectionHelpers";
export {
  buildLayerDocumentCanvasGlowSelectionKey,
  drawLayerDocumentCanvasGlow,
  hitLayerDocumentCanvasDirectSelection,
  resolveLayerDocumentCanvasDirectSelectionIntent,
  resolveLayerDocumentCanvasGlowSource,
} from "@/engines/canvas/helpers/layerDocumentCanvasDirectSelectionHelpers";
export type {
  LayerDocumentCanvasCommandPort,
  LayerDocumentCanvasCommands,
  LayerDocumentCanvasDirectSelectionCandidate,
  LayerDocumentCanvasDirectSelectionHit,
  LayerDocumentCanvasDirectSelectionIntent,
  LayerDocumentCanvasHandleDraft,
  LayerDocumentCanvasKeyframeSelectionCommand,
  LayerDocumentCanvasModeInput,
  LayerDocumentCanvasModeReadModel,
  LayerDocumentCanvasModeReadResult,
  LayerDocumentCanvasMotionPathDraftPreparation,
  LayerDocumentCanvasRenderAsset,
  LayerDocumentCanvasRenderAssetPort,
  LayerDocumentCanvasRenderAssetRequest,
  LayerDocumentCanvasRendererReadModel,
  LayerDocumentCanvasSceneDescriptor,
  LayerDocumentCanvasSemanticKeyframeCommand,
  LayerDocumentCanvasTransformHandle,
  LayerDocumentCanvasViewportInput,
} from "@/engines/canvas/models/layerDocumentCanvasModeModel";
export {
  CANVAS_SELECTION_GLOW_POINTER_EVENTS,
  CANVAS_SELECTION_OVERLAY_LAYER_ORDER,
} from "@/engines/canvas/constants/canvasSelectionGlowConstants";
export type {
  CanvasGuideCommands,
  CanvasGuideViewModel,
  CanvasSelectionReadModel,
  CanvasSize,
  CanvasViewportCommands,
  CanvasViewportReadModel,
  CanvasViewportProjectReadPort,
} from "@/engines/canvas/models/canvasEngineModel";
export type {
  CanvasDirectInputState,
  CanvasGizmoViewModel,
  CanvasHoveredHandle,
  CanvasInteractionCommands,
  CanvasMotionPathPointViewModel,
  CanvasPendingHandleInteraction,
  CanvasPendingMotionPathInteraction,
  PreviewOverlayViewModel,
} from "@/engines/canvas/models/canvasInteractionModel";
export {
  clampCanvasZoom,
  getCanvasViewportValues,
  getCanvasZoomPan,
  getCenteredCanvasPan,
  worldPointToCanvasPoint,
  canvasPointToWorldPoint,
  resolveCanvasPointerToComposition,
} from "@/engines/canvas/helpers/canvasViewportHelpers";
export {
  degreesToRadians,
  getCompensatedTransformOffset,
  getTargetAnchorWorld,
  getTransformGeometry,
  normalizeDegrees,
  projectOntoAxis,
  resolveAnchorFromWorldPoint,
} from "@/engines/canvas/helpers/canvasCoordinateHelpers";
export {
  buildCanvasGuideViewModel,
  buildPreviewGuideGeometry,
} from "@/engines/canvas/helpers/canvasGuideHelpers";
export type {
  PreviewGuideGeometry,
  PreviewGuideLine,
} from "@/engines/canvas/helpers/canvasGuideHelpers";
export {
  calculateOpacityDragUpdate,
  calculatePreviewPositionDragUpdate,
  calculateRotationDragUpdate,
  calculateScaleDragUpdate,
  formatPositionDeltaReadout,
  formatRotationHandleValue,
  formatScaleHandleReadout,
  isCanvasTransformDragActive,
  shouldRunCanvasDirectSelectionHover,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
export {
  buildCanvasMotionPathPointViewModels,
  buildPreviewOverlayViewModel,
} from "@/engines/canvas/helpers/canvasGizmoHelpers";
