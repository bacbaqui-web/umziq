import type { RenderItem } from "@/engines/project";
import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import { drawPreviewNodesToContext } from "@/engines/playback-render/adapters/canvas2dPreviewNodeRenderer";
import {
  createBrowserPreviewSurface,
  getCanvasPixelSize,
} from "@/engines/playback-render/adapters/canvas2dPreviewSurfaceAdapter";
import {
  buildPreviewSceneDrawPlan,
  shouldDrawNodeForDirtyBounds,
} from "@/engines/playback-render/helpers/previewSceneDirtyRegionHelpers";
import type {
  PreviewCanvasDrawState,
  PreviewCompositionCachePort,
  PreviewNodeBounds,
  PreviewRenderSurfaceFactory,
  PreviewSurfaceCachePort,
} from "@/engines/playback-render/models/previewCanvasRenderModel";
import type { PreviewScene } from "@/engines/playback-render/models/previewSceneModel";
import type { RenderDrawableSourceResolver } from "@/engines/playback-render/models/renderSourceModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";

export type {
  PreviewCanvasDrawState,
  PreviewCompositionCacheKeyInput,
  PreviewCompositionCachePort,
  PreviewNodeBounds,
  PreviewRenderSurface,
  PreviewRenderSurfaceFactory,
  PreviewSurfaceCacheAcquireInput,
  PreviewSurfaceCachePort,
} from "@/engines/playback-render/models/previewCanvasRenderModel";

function clearDirtyBounds(
  context: Canvas2DRenderContext,
  bounds: PreviewNodeBounds,
  pixelScale: number
) {
  const left = Math.floor(bounds.left * pixelScale);
  const top = Math.floor(bounds.top * pixelScale);
  const right = Math.ceil(bounds.right * pixelScale);
  const bottom = Math.ceil(bounds.bottom * pixelScale);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(left, top, right - left, bottom - top);
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
}

export function drawPreviewSceneToContext(
  context: Canvas2DRenderContext,
  previewScene: PreviewScene,
  renderItems: readonly RenderItem[],
  resolveDrawableSource?: RenderDrawableSourceResolver,
  createSurface: PreviewRenderSurfaceFactory = createBrowserPreviewSurface,
  pixelScale = 1,
  runtimeMetrics?: RuntimeMetricRecordPort,
  compositionCache?: PreviewCompositionCachePort,
  previewQuality = "original",
  surfaceCache?: PreviewSurfaceCachePort
) {
  drawPreviewNodesToContext({
    context,
    nodes: previewScene.nodes,
    renderItems,
    resolveDrawableSource,
    createSurface,
    pixelScale,
    runtimeMetrics,
    compositionCache,
    previewQuality,
    surfaceCache,
  });
}

export function renderPreviewSceneToCanvas({
  canvas,
  previewScene,
  renderItems,
  resolveDrawableSource,
  pixelScale = 1,
  createSurface = createBrowserPreviewSurface,
  runtimeMetrics,
  compositionCache,
  surfaceCache,
  previewQuality = "original",
  drawState,
}: {
  canvas: HTMLCanvasElement;
  previewScene: PreviewScene;
  renderItems: readonly RenderItem[];
  resolveDrawableSource?: RenderDrawableSourceResolver;
  pixelScale?: number;
  createSurface?: PreviewRenderSurfaceFactory;
  runtimeMetrics?: RuntimeMetricRecordPort;
  compositionCache?: PreviewCompositionCachePort;
  surfaceCache?: PreviewSurfaceCachePort;
  previewQuality?: string;
  drawState?: PreviewCanvasDrawState;
}) {
  const startTime = performance.now();
  const pixelSize = getCanvasPixelSize(previewScene.logicalSize, pixelScale);
  if (canvas.width !== pixelSize.width) canvas.width = pixelSize.width;
  if (canvas.height !== pixelSize.height) canvas.height = pixelSize.height;

  const context = canvas.getContext("2d");
  if (!context) return;
  const drawPlan = buildPreviewSceneDrawPlan({
    previewScene,
    pixelScale: pixelSize.scale,
    drawState,
  });

  if (drawPlan.mode === "skip") {
    runtimeMetrics?.increment("drawImageSkipped", drawPlan.skippedNodeCount);
    runtimeMetrics?.increment(
      "canvasDrawTime",
      Math.max(1, Math.ceil(performance.now() - startTime))
    );
    drawState!.previousScene = previewScene;
    drawState!.previousNodeBoundsById = drawPlan.nextNodeBoundsById;
    drawState!.previousPixelScale = pixelSize.scale;
    return;
  }

  if (drawPlan.mode === "dirty") {
    clearDirtyBounds(context, drawPlan.dirtyBounds, pixelSize.scale);
    context.save();
    context.beginPath();
    context.rect(
      drawPlan.dirtyBounds.left,
      drawPlan.dirtyBounds.top,
      drawPlan.dirtyBounds.right - drawPlan.dirtyBounds.left,
      drawPlan.dirtyBounds.bottom - drawPlan.dirtyBounds.top
    );
    context.clip();
    const skippedCount = drawPreviewNodesToContext({
      context,
      nodes: previewScene.nodes,
      renderItems,
      resolveDrawableSource,
      createSurface,
      pixelScale: pixelSize.scale,
      runtimeMetrics,
      compositionCache,
      previewQuality,
      surfaceCache,
      shouldDrawNode: (node) =>
        shouldDrawNodeForDirtyBounds({
          node,
          dirtyBounds: drawPlan.dirtyBounds,
          previousNodeBoundsById: drawPlan.previousNodeBoundsById,
          nextNodeBoundsById: drawPlan.nextNodeBoundsById,
        }),
    });
    context.restore();
    runtimeMetrics?.increment("drawImageSkipped", skippedCount);
    runtimeMetrics?.increment(
      "canvasDrawTime",
      Math.max(1, Math.ceil(performance.now() - startTime))
    );
    drawState!.previousScene = previewScene;
    drawState!.previousNodeBoundsById = drawPlan.nextNodeBoundsById;
    drawState!.previousPixelScale = pixelSize.scale;
    return;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelSize.width, pixelSize.height);
  context.setTransform(pixelSize.scale, 0, 0, pixelSize.scale, 0, 0);
  drawPreviewSceneToContext(
    context,
    previewScene,
    renderItems,
    resolveDrawableSource,
    createSurface,
    pixelSize.scale,
    runtimeMetrics,
    compositionCache,
    previewQuality,
    surfaceCache
  );
  runtimeMetrics?.increment(
    "canvasDrawTime",
    Math.max(1, Math.ceil(performance.now() - startTime))
  );
  if (drawState) {
    drawState.previousScene = previewScene;
    drawState.previousNodeBoundsById = drawPlan.nextNodeBoundsById;
    drawState.previousPixelScale = pixelSize.scale;
  }
}
