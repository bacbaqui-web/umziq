import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import { countPreviewNodes } from "@/engines/playback-render/helpers/previewSceneDirtyRegionHelpers";
import { buildRenderTransform } from "@/engines/playback-render/helpers/renderTransformHelpers";
import type {
  PreviewCompositionCacheKeyInput,
  PreviewCompositionCachePort,
  PreviewRenderSurfaceFactory,
  PreviewSurfaceCachePort,
} from "@/engines/playback-render/models/previewCanvasRenderModel";
import type {
  BasePreviewNode,
  CompositionPreviewNode,
  LayerPreviewNode,
  PreviewNode,
} from "@/engines/playback-render/models/previewSceneModel";
import type {
  RenderDrawableSource,
  RenderNodeVisualResolver,
} from "@/engines/playback-render/models/renderSourceModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";
import { drawEditorPlaceholderToContext } from "@/engines/playback-render/adapters/editorPlaceholderCanvas2dAdapter";

type PreviewNodeRenderOptions = {
  context: Canvas2DRenderContext;
  resolveNodeVisual?: RenderNodeVisualResolver;
  createSurface: PreviewRenderSurfaceFactory;
  pixelScale: number;
  runtimeMetrics?: RuntimeMetricRecordPort;
  compositionCache?: PreviewCompositionCachePort;
  previewQuality: string;
  surfaceCache?: PreviewSurfaceCachePort;
};

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function applyPreviewNodeTransform(
  context: Canvas2DRenderContext,
  node: BasePreviewNode
) {
  const transform = buildRenderTransform(
    node.logicalSize.width,
    node.logicalSize.height,
    node.transform
  );
  context.translate(transform.origin.x, transform.origin.y);
  context.translate(transform.anchor.x, transform.anchor.y);
  context.rotate(degreesToRadians(transform.rotation));
  context.scale(transform.scale.x / 100, transform.scale.y / 100);
  context.translate(-transform.anchor.x, -transform.anchor.y);
}

function resolveLayerPreviewSource({
  node,
  resolveNodeVisual,
}: {
  node: LayerPreviewNode;
  resolveNodeVisual?: RenderNodeVisualResolver;
}): RenderDrawableSource | null {
  if (
    node.layerDocumentId &&
    node.sourceId &&
    node.sourceResourceCacheKey &&
    node.layerResultCacheKey
  ) {
    const source = resolveNodeVisual?.({
      layerDocumentId: node.layerDocumentId,
      sourceId: node.sourceId,
      sourceResourceCacheKey:
        node.sourceResourceCacheKey,
      layerResultCacheKey: node.layerResultCacheKey,
      renderItemId: node.renderItemId,
      drawableId: node.drawableId,
      logicalSize: node.logicalSize,
    });
    if (source) return source;
  }
  return null;
}

function drawLayerPreviewNodeToContext({
  context,
  node,
  resolveNodeVisual,
  runtimeMetrics,
}: {
  context: Canvas2DRenderContext;
  node: LayerPreviewNode;
  resolveNodeVisual?: RenderNodeVisualResolver;
  runtimeMetrics?: RuntimeMetricRecordPort;
}) {
  if (!node.visible) return;

  const source = resolveLayerPreviewSource({
    node,
    resolveNodeVisual,
  });
  if (!source) return;

  context.save();
  context.globalAlpha = node.opacity / 100;
  applyPreviewNodeTransform(context, node);
  context.drawImage(
    source.image,
    0,
    0,
    node.logicalSize.width,
    node.logicalSize.height
  );
  runtimeMetrics?.increment("drawImage");
  runtimeMetrics?.increment("layerDraw");
  context.restore();
}

function drawCompositionPreviewNodeToContext({
  context,
  node,
  resolveNodeVisual,
  createSurface,
  pixelScale,
  runtimeMetrics,
  compositionCache,
  previewQuality,
  surfaceCache,
}: {
  context: Canvas2DRenderContext;
  node: CompositionPreviewNode;
  resolveNodeVisual?: RenderNodeVisualResolver;
  createSurface: PreviewRenderSurfaceFactory;
  pixelScale: number;
  runtimeMetrics?: RuntimeMetricRecordPort;
  compositionCache?: PreviewCompositionCachePort;
  previewQuality: string;
  surfaceCache?: PreviewSurfaceCachePort;
}) {
  if (!node.visible) return;

  const cacheInput: PreviewCompositionCacheKeyInput = {
    node,
    previewQuality,
    previewScale: pixelScale,
    rendererMode: "fast-render",
  };
  const cachedSurface = compositionCache?.getSurface(cacheInput) ?? null;
  if (cachedSurface) {
    runtimeMetrics?.increment("compositionCacheHit");
    runtimeMetrics?.increment("compositionCacheReused");
    context.save();
    context.globalAlpha = node.opacity / 100;
    applyPreviewNodeTransform(context, node);
    context.drawImage(
      cachedSurface.canvas,
      0,
      0,
      node.logicalSize.width,
      node.logicalSize.height
    );
    runtimeMetrics?.increment("drawImage");
    runtimeMetrics?.increment("compositionDraw");
    context.restore();
    return;
  }

  if (compositionCache) runtimeMetrics?.increment("compositionCacheMiss");
  runtimeMetrics?.increment("compositionRender");
  const surface =
    surfaceCache?.acquireSurface({
      logicalWidth: node.logicalSize.width,
      logicalHeight: node.logicalSize.height,
      previewQuality,
      previewScale: pixelScale,
      createSurface,
    }) ??
    createSurface(node.logicalSize.width, node.logicalSize.height, pixelScale);

  if (!surface) return;

  node.children.forEach((child) =>
    drawPreviewNodeToContext({
      context: surface.context,
      node: child,
      resolveNodeVisual,
      createSurface,
      pixelScale,
      runtimeMetrics,
      compositionCache,
      previewQuality,
      surfaceCache,
    })
  );
  compositionCache?.storeSurface(cacheInput, surface);
  if (compositionCache) runtimeMetrics?.increment("compositionCacheCreate");

  context.save();
  context.globalAlpha = node.opacity / 100;
  applyPreviewNodeTransform(context, node);
  context.drawImage(
    surface.canvas,
    0,
    0,
    node.logicalSize.width,
    node.logicalSize.height
  );
  runtimeMetrics?.increment("drawImage");
  runtimeMetrics?.increment("compositionDraw");
  context.restore();

  if (!compositionCache) {
    surfaceCache?.releaseSurface(surface);
  }
}

function drawPreviewNodeToContext({
  context,
  node,
  resolveNodeVisual,
  createSurface,
  pixelScale,
  runtimeMetrics,
  compositionCache,
  previewQuality,
  surfaceCache,
}: {
  context: Canvas2DRenderContext;
  node: PreviewNode;
  resolveNodeVisual?: RenderNodeVisualResolver;
  createSurface: PreviewRenderSurfaceFactory;
  pixelScale: number;
  runtimeMetrics?: RuntimeMetricRecordPort;
  compositionCache?: PreviewCompositionCachePort;
  previewQuality: string;
  surfaceCache?: PreviewSurfaceCachePort;
}) {
  if (node.kind === "layer") {
    drawLayerPreviewNodeToContext({
      context,
      node,
      resolveNodeVisual,
      runtimeMetrics,
    });
    return;
  }

  if (node.kind === "placeholder") {
    if (!node.visible) return;
    context.save();
    context.globalAlpha = node.opacity / 100;
    applyPreviewNodeTransform(context, node);
    drawEditorPlaceholderToContext(context, node.placeholder);
    context.restore();
    return;
  }

  drawCompositionPreviewNodeToContext({
    context,
    node,
    resolveNodeVisual,
    createSurface,
    pixelScale,
    runtimeMetrics,
    compositionCache,
    previewQuality,
    surfaceCache,
  });
}

export function drawPreviewNodesToContext({
  nodes,
  shouldDrawNode,
  ...options
}: PreviewNodeRenderOptions & {
  nodes: readonly PreviewNode[];
  shouldDrawNode?: (node: PreviewNode) => boolean;
}): number {
  let skippedCount = 0;
  nodes.forEach((node) => {
    if (!shouldDrawNode || shouldDrawNode(node)) {
      drawPreviewNodeToContext({
        ...options,
        node,
      });
      return;
    }
    skippedCount += countPreviewNodes(node);
  });
  return skippedCount;
}
