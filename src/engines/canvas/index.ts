export { default as PreviewWorkspacePane } from "@/features/preview/components/PreviewWorkspacePane";
export { useCanvasComposition } from "@/engines/canvas/useCanvasComposition";
export type { UseCanvasCompositionOptions } from "@/engines/canvas/useCanvasComposition";
export type { RendererMode } from "@/engines/playback-render";
export { useCanvasEngine } from "@/engines/canvas/useCanvasEngine";
export type { UseCanvasEngineOptions } from "@/engines/canvas/useCanvasEngine";
export { useCanvasPreviewRuntime } from "@/engines/canvas/useCanvasPreviewRuntime";
export {
  PREVIEW_DEVICE_MEMORY_TIER_POLICIES,
  PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES,
} from "@/engines/canvas/constants/previewAutomaticQualityConstants";
export type {
  PreviewBitmapFactoryPort,
  PreviewBuildReadModel,
  PreviewBuildSource,
  PreviewCacheBuildError,
  PreviewCacheBuildOptions,
  PreviewCacheBuildProgress,
  PreviewCacheBuildResult,
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
  PreviewCacheCommitResult,
  PreviewCacheCommitStatus,
  PreviewCacheKeyInput,
  PreviewCacheRuntime,
  PreviewCacheSnapshot,
} from "@/engines/canvas/models/previewCacheModel";
export type {
  PreviewQualityPreference,
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";
export type {
  PreviewBitmapImage,
  PreviewBitmapRuntime,
  PreviewGeneration,
  PreviewRuntimeResource,
} from "@/engines/canvas/models/previewRuntimeModel";
export type {
  PreviewBitmapCreationAdapter,
  PreviewBitmapFactoryError,
  PreviewBitmapFactoryErrorCode,
  PreviewBitmapFactoryInput,
  PreviewBitmapFactoryResult,
} from "@/engines/canvas/models/previewBitmapFactoryModel";
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
export { buildPreviewCacheKey } from "@/engines/canvas/helpers/previewCacheKeyHelpers";
export {
  collectPreviewBuildSources,
  collectProjectPreviewBuildSources,
  getPreviewBuildSourceSetKey,
  getPreviewLifecycleRetainedCacheKeys,
  toPreviewMemorySources,
} from "@/engines/canvas/helpers/previewBuildSourceHelpers";
export { collectRenderFrameSourceIds } from "@/engines/canvas/helpers/previewRenderFrameHelpers";
export { createPreviewDrawableSourceResolver } from "@/engines/canvas/helpers/previewResolverHelpers";
export {
  resolveAutomaticPreviewQuality,
  resolvePreviewMemoryBudget,
} from "@/engines/canvas/helpers/previewAutomaticQualityHelpers";
export { createPreviewBitmapResource } from "@/engines/canvas/factories/previewBitmapFactory";
export { createPreviewCacheRuntime } from "@/engines/canvas/state/previewCacheRuntimeStore";
export { createDirtyState } from "@/engines/canvas/state/dirtyStateStore";
export { createCompositionPreviewCacheRuntime } from "@/engines/canvas/state/compositionPreviewCacheStore";
export { createPreviewSurfaceCacheRuntime } from "@/engines/canvas/state/previewSurfaceCacheStore";
export { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
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
  buildPreviewCacheGeneration,
  getPreviewBuildCacheKeys,
} from "@/engines/canvas/controllers/buildPreviewCacheGeneration";
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
export { resolveCanvasPreviewCursor } from "@/engines/canvas/helpers/canvasDirectSelectionHitHelpers";
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
  buildCompositionSelectionOverlay,
  buildCanvasSelectionReadModel,
  buildLayerSelectionOverlay,
} from "@/engines/canvas/helpers/canvasSelectionHelpers";
export {
  isDraftTransformSnapshotForTargetAtFrame,
  resolveDraftAnchorTransformCommand,
  resolveDraftAnchorTransformCommandFromLocalAnchor,
  resolveDraftOverlayRuntimeValuesForTargetAtFrame,
  resolveDraftTransformSnapshot,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
export type {
  DraftTransformPatch,
  DraftTransformSnapshot,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
export type {
  CanvasTransformDraftCommands,
} from "@/engines/canvas/models/canvasTransformControllerModel";
export {
  calculateOpacityDragUpdate,
  calculatePreviewPositionDragUpdate,
  calculateRotationDragUpdate,
  calculateScaleDragUpdate,
  formatPositionDeltaReadout,
  formatRotationHandleValue,
  formatScaleHandleReadout,
  getCanvasTransformEditModes,
  isCanvasTransformDragActive,
  shouldRunCanvasDirectSelectionHover,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
export {
  buildCanvasMotionPathPointViewModels,
  buildPreviewOverlayViewModel,
} from "@/engines/canvas/helpers/canvasGizmoHelpers";
