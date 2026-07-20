export { usePlaybackEngine } from "@/engines/playback-render/usePlaybackEngine";
export { useRenderEngine } from "@/engines/playback-render/useRenderEngine";
export type {
  PlaybackCommands,
  PlaybackRange,
  PlaybackReadModel,
  PlaybackSeekOptions,
} from "@/engines/playback-render/models/playbackModel";
export type {
  EvaluatedScene,
  EvaluatedSceneCompositionNode,
  EvaluatedSceneDrawableNode,
  EvaluatedSceneNode,
  EvaluatedSceneSize,
  EvaluatedSceneTransform,
} from "@/engines/playback-render/models/evaluatedSceneModel";
export type {
  EvaluatedRenderTransform,
  RenderCommand,
  RenderCompositionCommand,
  RenderDrawableCommand,
  RenderFrame,
} from "@/engines/playback-render/models/renderFrameModel";
export type {
  BasePreviewNode,
  CompositionPreviewNode,
  LayerPreviewNode,
  PreviewNode,
  PreviewNodeKind,
  PreviewScene,
} from "@/engines/playback-render/models/previewSceneModel";
export type {
  RenderDrawableSource,
  RenderDrawableSourceRequest,
  RenderDrawableSourceResolver,
  RenderSize,
} from "@/engines/playback-render/models/renderSourceModel";
export type {
  AccurateRendererResult,
  FastPreviewRendererResult,
  RenderAccurateFrameOptions,
  RendererMode,
  RendererModeResult,
  RenderWithRendererModeOptions,
} from "@/engines/playback-render/models/rendererModeModel";
export type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";
export {
  buildEvaluatedScene,
  buildEvaluatedSceneFromItems,
} from "@/engines/playback-render/helpers/evaluatedSceneHelpers";
export type {
  PreviewSceneTransformPatch,
  PreviewSceneUpdateResult,
  PreviewSceneUpdateStats,
  PreviewSceneUpdateTarget,
} from "@/engines/playback-render/helpers/previewSceneUpdateHelpers";
export {
  updatePreviewSceneFromPlaybackFrame,
  updatePreviewSceneFromPlaybackFrameWithStats,
  updatePreviewSceneNodeTransform,
  updatePreviewSceneNodeTransformWithStats,
} from "@/engines/playback-render/helpers/previewSceneUpdateHelpers";
export {
  buildRenderFrame,
  buildRenderFrameFromEvaluatedScene,
  buildRenderFrameFromItems,
} from "@/engines/playback-render/controllers/buildRenderFrame";
export { renderAccurateFrame, renderAccurateRenderer } from "@/engines/playback-render/renderers/accurateRenderer";
export {
  buildPreviewSceneFromEvaluatedScene,
  renderFastPreviewRenderer,
} from "@/engines/playback-render/renderers/fastPreviewRenderer";
export { renderWithRendererMode } from "@/engines/playback-render/renderers/rendererMode";
export {
  flattenRenderItemsToDrawables,
  getActiveRenderItems,
  getActiveTimelineItems,
} from "@/engines/playback-render/helpers/activeTimelineItemHelpers";
export { resolveRenderItemsForComposition } from "@/engines/playback-render/helpers/renderSourceHelpers";
export {
  createReusableRenderSurfaceFactory,
  renderFrameToCanvas,
} from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
export type { ReusableRenderSurfaceFactory } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
export {
  drawPreviewSceneToContext,
  renderPreviewSceneToCanvas,
} from "@/engines/playback-render/adapters/canvas2dPreviewSceneAdapter";
export type {
  PreviewCompositionCacheKeyInput,
  PreviewCanvasDrawState,
  PreviewCompositionCachePort,
  PreviewRenderSurface,
  PreviewRenderSurfaceFactory,
  PreviewSurfaceCacheAcquireInput,
  PreviewSurfaceCachePort,
} from "@/engines/playback-render/adapters/canvas2dPreviewSceneAdapter";
export {
  advancePlaybackFrame,
  clampPlaybackFrame,
  getPlaybackResetFrame,
  stepPlaybackFrame,
} from "@/engines/playback-render/helpers/playbackFrameHelpers";
export {
  createDefaultPlaybackRange,
  isFrameInPlaybackRange,
  normalizePlaybackDuration,
  normalizePlaybackRange,
  resolvePlaybackRange,
} from "@/engines/playback-render/helpers/playbackRangeHelpers";

export {
  formatCompactTime,
  formatTimelineTime,
} from "@/engines/playback-render/timeFormatting";
