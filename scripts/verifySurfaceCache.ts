import assert from "node:assert/strict";
import { createCompositionPreviewCacheRuntime } from "@/engines/canvas/state/compositionPreviewCacheStore";
import { createPreviewSurfaceCacheRuntime } from "@/engines/canvas/state/previewSurfaceCacheStore";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
import { createRuntimeMetricRecordPort } from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import { applyPreviewNodeCacheFromScenes } from "@/engines/canvas/helpers/nodeCacheHelpers";
import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import {
  drawPreviewSceneToContext,
  type PreviewRenderSurface,
} from "@/engines/playback-render/adapters/canvas2dPreviewSceneAdapter";
import type { PreviewNode, PreviewScene } from "@/engines/playback-render";
import type { RenderDrawable, RenderItem } from "@/engines/project";

const transform = {
  position: { x: 0, y: 0 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

function createFakeContext(log: string[]): Canvas2DRenderContext {
  let alpha = 1;
  return {
    clearRect: (...values: number[]) => log.push(`clear:${values.join(",")}`),
    beginPath: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    save: () => log.push("save"),
    restore: () => log.push("restore"),
    translate: (x: number, y: number) => log.push(`translate:${x},${y}`),
    rotate: (value: number) => log.push(`rotate:${value}`),
    scale: (x: number, y: number) => log.push(`scale:${x},${y}`),
    setTransform: (...values: number[]) =>
      log.push(`setTransform:${values.join(",")}`),
    drawImage: () => log.push("drawImage"),
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(value: number) {
      alpha = value;
      log.push(`alpha:${value}`);
    },
  } as Canvas2DRenderContext;
}

function createSurfaceFactory(created: PreviewRenderSurface[]) {
  return (
    width: number,
    height: number,
    pixelScale: number
  ): PreviewRenderSurface => {
    const surface = {
      canvas: {
        width: Math.ceil(width * pixelScale),
        height: Math.ceil(height * pixelScale),
      } as HTMLCanvasElement,
      context: createFakeContext([]),
    };
    created.push(surface);
    return surface;
  };
}

function layer(id: string, overrides: Partial<PreviewNode> = {}): PreviewNode {
  return {
    id,
    kind: "layer",
    sourceId: `${id}:source`,
    renderItemId: "render-item",
    parentId: "composition-a",
    children: [],
    transform,
    opacity: 100,
    visible: true,
    order: 0,
    localFrame: 0,
    globalFrame: 0,
    logicalSize: { width: 100, height: 100 },
    drawableId: id,
    layerId: id,
    ...overrides,
  } as PreviewNode;
}

function composition(
  children: readonly PreviewNode[],
  overrides: Partial<PreviewNode> = {}
): PreviewNode {
  return {
    id: "composition-a",
    kind: "composition",
    sourceId: "composition-a:source",
    renderItemId: "render-item",
    parentId: null,
    children,
    transform,
    opacity: 100,
    visible: true,
    order: 0,
    localFrame: 0,
    globalFrame: 0,
    logicalSize: { width: 200, height: 120 },
    targetCompId: "composition-a",
    ...overrides,
  } as PreviewNode;
}

function scene(node: PreviewNode): PreviewScene {
  return {
    compositionId: "scene",
    globalFrame: 0,
    logicalSize: { width: 500, height: 500 },
    nodes: [node],
  };
}

const metrics = createRuntimeMetricsResource();
const directCreated: PreviewRenderSurface[] = [];
const directSurfaceCache = createPreviewSurfaceCacheRuntime({
  maxPoolSize: 2,
  metrics: createRuntimeMetricRecordPort(metrics),
});
const directFactory = createSurfaceFactory(directCreated);
const firstSurface = directSurfaceCache.acquireSurface({
  logicalWidth: 200,
  logicalHeight: 120,
  previewQuality: "high",
  previewScale: 0.75,
  createSurface: directFactory,
});
assert.ok(firstSurface);
assert.equal(directCreated.length, 1);
assert.equal(metrics.getGlobalSnapshot().surfaceCreate, 1);
assert.equal(directSurfaceCache.getSnapshot().activeCount, 1);
directSurfaceCache.releaseSurface(firstSurface);
assert.equal(directSurfaceCache.getSnapshot().activeCount, 0);
assert.equal(directSurfaceCache.getSnapshot().poolSize, 1);

const reusedSurface = directSurfaceCache.acquireSurface({
  logicalWidth: 200,
  logicalHeight: 120,
  previewQuality: "high",
  previewScale: 0.75,
  createSurface: directFactory,
});
assert.equal(reusedSurface, firstSurface);
assert.equal(directCreated.length, 1);
assert.equal(metrics.getGlobalSnapshot().surfaceReuse, 1);
directSurfaceCache.releaseSurface(reusedSurface);

const differentSizeSurface = directSurfaceCache.acquireSurface({
  logicalWidth: 220,
  logicalHeight: 120,
  previewQuality: "high",
  previewScale: 0.75,
  createSurface: directFactory,
});
assert.notEqual(differentSizeSurface, firstSurface);
assert.equal(directCreated.length, 2);
directSurfaceCache.releaseSurface(differentSizeSurface);

const differentQualitySurface = directSurfaceCache.acquireSurface({
  logicalWidth: 200,
  logicalHeight: 120,
  previewQuality: "medium",
  previewScale: 0.75,
  createSurface: directFactory,
});
assert.equal(directCreated.length, 3);
directSurfaceCache.releaseSurface(differentQualitySurface);

const differentScaleSurface = directSurfaceCache.acquireSurface({
  logicalWidth: 200,
  logicalHeight: 120,
  previewQuality: "high",
  previewScale: 0.5,
  createSurface: directFactory,
});
assert.equal(directCreated.length, 4);
directSurfaceCache.releaseSurface(differentScaleSurface);
assert.equal(directSurfaceCache.getSnapshot().poolSize, 2);
assert.equal(metrics.getGlobalSnapshot().surfaceDispose, 2);

const drawableCanvas = { width: 100, height: 100 } as HTMLCanvasElement;
const renderItem: RenderItem = {
  id: "render-item",
  compId: "composition-a",
  drawables: [
    {
      id: "child-a",
      canvas: drawableCanvas,
    } as RenderDrawable,
  ],
};

function drawWithRuntime({
  previewScene,
  compositionCache,
  surfaceCache,
  metrics: runtimeMetrics,
  created,
}: {
  previewScene: PreviewScene;
  compositionCache: ReturnType<typeof createCompositionPreviewCacheRuntime>;
  surfaceCache: ReturnType<typeof createPreviewSurfaceCacheRuntime>;
  metrics: ReturnType<typeof createRuntimeMetricsResource>;
  created: PreviewRenderSurface[];
}) {
  compositionCache.beginFrame();
  try {
    drawPreviewSceneToContext(
      createFakeContext([]),
      previewScene,
      [renderItem],
      undefined,
      createSurfaceFactory(created),
      0.75,
      createRuntimeMetricRecordPort(runtimeMetrics),
      compositionCache,
      "high",
      surfaceCache
    );
  } finally {
    compositionCache.endFrame();
  }
}

const runtimeMetrics = createRuntimeMetricsResource();
runtimeMetrics.saveTaskBaseline();
const runtimeSurfaceCache = createPreviewSurfaceCacheRuntime({
  metrics: createRuntimeMetricRecordPort(runtimeMetrics),
});
const runtimeCompositionCache = createCompositionPreviewCacheRuntime({
  releaseSurface: runtimeSurfaceCache.releaseSurface,
});
const runtimeCreated: PreviewRenderSurface[] = [];
const baseScene = scene(composition([layer("child-a")]));
drawWithRuntime({
  previewScene: baseScene,
  compositionCache: runtimeCompositionCache,
  surfaceCache: runtimeSurfaceCache,
  metrics: runtimeMetrics,
  created: runtimeCreated,
});
assert.equal(runtimeCreated.length, 1);
assert.equal(runtimeMetrics.getGlobalSnapshot().surfaceCreate, 1);

const cachedScene = applyPreviewNodeCacheFromScenes(
  baseScene,
  scene(composition([layer("child-a")]))
);
drawWithRuntime({
  previewScene: cachedScene.scene ?? baseScene,
  compositionCache: runtimeCompositionCache,
  surfaceCache: runtimeSurfaceCache,
  metrics: runtimeMetrics,
  created: runtimeCreated,
});
assert.equal(runtimeCreated.length, 1);
assert.equal(runtimeMetrics.getGlobalSnapshot().compositionCacheHit, 1);
assert.equal(runtimeMetrics.getGlobalSnapshot().surfaceReuse, 0);

const childDirtyScene = applyPreviewNodeCacheFromScenes(
  baseScene,
  scene(composition([layer("child-a", { opacity: 50 })]))
);
drawWithRuntime({
  previewScene: childDirtyScene.scene ?? baseScene,
  compositionCache: runtimeCompositionCache,
  surfaceCache: runtimeSurfaceCache,
  metrics: runtimeMetrics,
  created: runtimeCreated,
});
assert.equal(runtimeCreated.length, 1);
assert.equal(runtimeMetrics.getGlobalSnapshot().surfaceReuse, 1);
assert.equal(runtimeMetrics.getGlobalSnapshot().compositionCacheMiss, 2);
assert.equal(runtimeSurfaceCache.getSnapshot().activeCount, 1);

const baselineComparison = runtimeMetrics.compareTaskBaseline();
assert.equal(
  baselineComparison.differences.find(
    (difference) => difference.counter === "surfaceCreate"
  )?.difference,
  1
);
assert.equal(
  baselineComparison.differences.find(
    (difference) => difference.counter === "surfaceReuse"
  )?.difference,
  1
);

runtimeCompositionCache.dispose();
assert.equal(runtimeSurfaceCache.getSnapshot().poolSize, 1);
runtimeSurfaceCache.dispose();
assert.equal(runtimeSurfaceCache.getSnapshot().poolSize, 0);
assert.equal(runtimeSurfaceCache.getSnapshot().activeCount, 0);
assert.equal(runtimeSurfaceCache.getSnapshot().disposed, true);

console.log("Surface cache verification passed");
