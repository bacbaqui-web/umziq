import type { Canvas2DRenderContext } from "@/render/adapters/canvas2dRenderAdapter";
import { drawPreviewNodesToContext } from "@/render/adapters/canvas2dPreviewNodeRenderer";
import {
  createBrowserPreviewSurface,
  getCanvasPixelSize,
} from "@/render/adapters/canvas2dPreviewSurfaceAdapter";
import {
  buildPreviewSceneDrawPlan,
  shouldDrawNodeForDirtyBounds,
} from "@/render/helpers/previewSceneDirtyRegionHelpers";
import type {
  PreviewCanvasDrawState,
  PreviewCompositionCachePort,
  PreviewNodeBounds,
  PreviewRenderSurfaceFactory,
  PreviewSurfaceCachePort,
} from "@/render/models/previewCanvasRenderModel";
import type {
  PreviewNode,
  PreviewScene,
} from "@/render/models/previewSceneModel";
import type {
  RenderNodeVisualResolver,
} from "@/render/models/renderSourceModel";
import type { RuntimeMetricRecordPort } from "@/render/models/runtimeMetricPortModel";

export type {
  PreviewCanvasDrawState,
  PreviewCompositionCacheKeyInput,
  PreviewCompositionCachePort,
  PreviewNodeBounds,
  PreviewRenderSurface,
  PreviewRenderSurfaceFactory,
  PreviewSurfaceCacheAcquireInput,
  PreviewSurfaceCachePort,
} from "@/render/models/previewCanvasRenderModel";

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

function retainSkippedCompositionSurfaces(
  nodes: readonly PreviewNode[],
  compositionCache: PreviewCompositionCachePort | undefined,
  previewQuality: string,
  previewScale: number
): void {
  if (!compositionCache) return;
  nodes.forEach((node) => {
    if (node.kind !== "composition") return;
    compositionCache.getSurface({
      node,
      previewQuality,
      previewScale,
    });
    retainSkippedCompositionSurfaces(
      node.children,
      compositionCache,
      previewQuality,
      previewScale
    );
  });
}

export function drawPreviewSceneToContext(
  context: Canvas2DRenderContext,
  previewScene: PreviewScene,
  createSurface: PreviewRenderSurfaceFactory = createBrowserPreviewSurface,
  pixelScale = 1,
  runtimeMetrics?: RuntimeMetricRecordPort,
  compositionCache?: PreviewCompositionCachePort,
  previewQuality = "original",
  surfaceCache?: PreviewSurfaceCachePort,
  resolveNodeVisual?: RenderNodeVisualResolver
) {
  drawPreviewNodesToContext({
    context,
    nodes: previewScene.nodes,
    resolveNodeVisual,
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
  resolveNodeVisual,
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
  resolveNodeVisual?: RenderNodeVisualResolver;
  pixelScale?: number;
  createSurface?: PreviewRenderSurfaceFactory;
  runtimeMetrics?: RuntimeMetricRecordPort;
  compositionCache?: PreviewCompositionCachePort;
  surfaceCache?: PreviewSurfaceCachePort;
  previewQuality?: string;
  drawState?: PreviewCanvasDrawState;
}) {
  const startTime = performance.now();
  runtimeMetrics?.resetFrame?.();
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
    runtimeMetrics?.increment("dirtySkip");
    runtimeMetrics?.increment("drawImageSkipped", drawPlan.skippedNodeCount);
    retainSkippedCompositionSurfaces(
      previewScene.nodes,
      compositionCache,
      previewQuality,
      pixelSize.scale
    );
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
    runtimeMetrics?.increment("dirtyPartial");
    retainSkippedCompositionSurfaces(
      previewScene.nodes,
      compositionCache,
      previewQuality,
      pixelSize.scale
    );
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
      resolveNodeVisual,
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
  runtimeMetrics?.increment("dirtyFull");
  context.clearRect(0, 0, pixelSize.width, pixelSize.height);
  context.setTransform(pixelSize.scale, 0, 0, pixelSize.scale, 0, 0);
  drawPreviewSceneToContext(
    context,
    previewScene,
    createSurface,
    pixelSize.scale,
    runtimeMetrics,
    compositionCache,
    previewQuality,
    surfaceCache,
    resolveNodeVisual
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
