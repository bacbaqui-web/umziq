import type { RenderDrawable, RenderItem } from "@/engines/project";
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
  RenderDrawableSourceResolver,
} from "@/engines/playback-render/models/renderSourceModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";

type PreviewDrawableLookup = ReadonlyMap<string, RenderDrawable>;

type PreviewNodeRenderOptions = {
  context: Canvas2DRenderContext;
  renderItems: readonly RenderItem[];
  resolveDrawableSource?: RenderDrawableSourceResolver;
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

function buildDrawableLookup(
  renderItems: readonly RenderItem[]
): PreviewDrawableLookup {
  const lookup = new Map<string, RenderDrawable>();
  renderItems.forEach((renderItem) => {
    renderItem.drawables.forEach((drawable) => {
      lookup.set(`${renderItem.id}:${drawable.id}`, drawable);
    });
  });
  return lookup;
}

function findPreviewDrawable(
  lookup: PreviewDrawableLookup,
  node: LayerPreviewNode
) {
  return lookup.get(`${node.renderItemId}:${node.drawableId}`) ?? null;
}

function resolveLayerPreviewSource({
  node,
  drawable,
  resolveDrawableSource,
}: {
  node: LayerPreviewNode;
  drawable: RenderDrawable;
  resolveDrawableSource?: RenderDrawableSourceResolver;
}): RenderDrawableSource | null {
  const canvas = drawable.canvas;
  if (!canvas) return null;

  const originalSource: RenderDrawableSource & { kind: "original" } = {
    kind: "original",
    image: canvas,
    pixelSize: { ...node.logicalSize },
  };

  return (
    resolveDrawableSource?.({
      renderItemId: node.renderItemId,
      drawableId: node.drawableId,
      sourceId: node.sourceId,
      logicalSize: node.logicalSize,
      originalSource,
    }) ?? originalSource
  );
}

function drawLayerPreviewNodeToContext({
  context,
  node,
  drawableLookup,
  resolveDrawableSource,
  runtimeMetrics,
}: {
  context: Canvas2DRenderContext;
  node: LayerPreviewNode;
  drawableLookup: PreviewDrawableLookup;
  resolveDrawableSource?: RenderDrawableSourceResolver;
  runtimeMetrics?: RuntimeMetricRecordPort;
}) {
  if (!node.visible) return;

  const drawable = findPreviewDrawable(drawableLookup, node);
  if (!drawable) return;

  const source = resolveLayerPreviewSource({
    node,
    drawable,
    resolveDrawableSource,
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
  drawableLookup,
  resolveDrawableSource,
  createSurface,
  pixelScale,
  runtimeMetrics,
  compositionCache,
  previewQuality,
  surfaceCache,
}: {
  context: Canvas2DRenderContext;
  node: CompositionPreviewNode;
  drawableLookup: PreviewDrawableLookup;
  resolveDrawableSource?: RenderDrawableSourceResolver;
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
      drawableLookup,
      resolveDrawableSource,
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
  drawableLookup,
  resolveDrawableSource,
  createSurface,
  pixelScale,
  runtimeMetrics,
  compositionCache,
  previewQuality,
  surfaceCache,
}: {
  context: Canvas2DRenderContext;
  node: PreviewNode;
  drawableLookup: PreviewDrawableLookup;
  resolveDrawableSource?: RenderDrawableSourceResolver;
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
      drawableLookup,
      resolveDrawableSource,
      runtimeMetrics,
    });
    return;
  }

  drawCompositionPreviewNodeToContext({
    context,
    node,
    drawableLookup,
    resolveDrawableSource,
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
  const drawableLookup = buildDrawableLookup(options.renderItems);
  let skippedCount = 0;
  nodes.forEach((node) => {
    if (!shouldDrawNode || shouldDrawNode(node)) {
      drawPreviewNodeToContext({
        ...options,
        node,
        drawableLookup,
      });
      return;
    }
    skippedCount += countPreviewNodes(node);
  });
  return skippedCount;
}
