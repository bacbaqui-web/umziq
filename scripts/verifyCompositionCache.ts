import assert from "node:assert/strict";
import {
  createCompositionPreviewCacheRuntime,
} from "@/engines/canvas/state/compositionPreviewCacheStore";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
import { createRuntimeMetricRecordPort } from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import {
  applyPreviewNodeCacheFromScenes,
} from "@/engines/canvas/helpers/nodeCacheHelpers";
import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import {
  drawPreviewSceneToContext,
  renderPreviewSceneToCanvas,
  type PreviewCanvasDrawState,
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

function createSurfaceFactory(logs: string[][]) {
  return (width: number, height: number): PreviewRenderSurface => {
    const log: string[] = [`surface:${width},${height}`];
    logs.push(log);
    return {
      canvas: { width, height } as HTMLCanvasElement,
      context: createFakeContext(log),
    };
  };
}

function createFakeCanvas(log: string[]): HTMLCanvasElement {
  let width = 0;
  let height = 0;
  const context = createFakeContext(log);
  return {
    get width() {
      return width;
    },
    set width(value: number) {
      width = value;
    },
    get height() {
      return height;
    },
    set height(value: number) {
      height = value;
    },
    getContext: (kind: string) => (kind === "2d" ? context : null),
  } as HTMLCanvasElement;
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

function drawWithCache({
  previewScene,
  quality = "high",
  scale = 0.75,
  cache = createCompositionPreviewCacheRuntime(),
  metrics = createRuntimeMetricsResource(),
}: {
  previewScene: PreviewScene;
  quality?: string;
  scale?: number;
  cache?: ReturnType<typeof createCompositionPreviewCacheRuntime>;
  metrics?: ReturnType<typeof createRuntimeMetricsResource>;
}) {
  const rootLog: string[] = [];
  const surfaceLogs: string[][] = [];
  cache.beginFrame();
  try {
    drawPreviewSceneToContext(
      createFakeContext(rootLog),
      previewScene,
      [renderItem],
      undefined,
      createSurfaceFactory(surfaceLogs),
      scale,
      createRuntimeMetricRecordPort(metrics),
      cache,
      quality
    );
  } finally {
    cache.endFrame();
  }

  return {
    cache,
    metrics,
    rootLog,
    surfaceLogs,
  };
}

function renderCanvasWithCache({
  previewScene,
  cache,
  drawState,
  metrics = createRuntimeMetricsResource(),
}: {
  previewScene: PreviewScene;
  cache: ReturnType<typeof createCompositionPreviewCacheRuntime>;
  drawState: PreviewCanvasDrawState;
  metrics?: ReturnType<typeof createRuntimeMetricsResource>;
}) {
  const canvasLog: string[] = [];
  const surfaceLogs: string[][] = [];
  cache.beginFrame();
  try {
    renderPreviewSceneToCanvas({
      canvas: createFakeCanvas(canvasLog),
      previewScene,
      renderItems: [renderItem],
      createSurface: createSurfaceFactory(surfaceLogs),
      pixelScale: 0.75,
      runtimeMetrics: createRuntimeMetricRecordPort(metrics),
      compositionCache: cache,
      previewQuality: "high",
      drawState,
    });
  } finally {
    cache.endFrame();
  }

  return {
    metrics,
    canvasLog,
    surfaceLogs,
  };
}

const child = layer("child-a");
const baseComposition = composition([child]);
const baseScene = scene(baseComposition);
const first = drawWithCache({ previewScene: baseScene });
assert.equal(first.metrics.getGlobalSnapshot().compositionCacheMiss, 1);
assert.equal(first.metrics.getGlobalSnapshot().compositionCacheCreate, 1);
assert.equal(first.metrics.getGlobalSnapshot().compositionCacheHit, 0);
assert.equal(first.metrics.getGlobalSnapshot().compositionRender, 1);
assert.equal(first.surfaceLogs.length, 1);
assert.equal(first.cache.getSnapshot().size, 1);

const sameValueScene = scene(composition([layer("child-a")]));
const cachedScene = applyPreviewNodeCacheFromScenes(baseScene, sameValueScene);
assert.equal(cachedScene.scene, baseScene);
const second = drawWithCache({
  previewScene: cachedScene.scene ?? sameValueScene,
  cache: first.cache,
  metrics: first.metrics,
});
assert.equal(second.metrics.getGlobalSnapshot().compositionCacheHit, 1);
assert.equal(second.metrics.getGlobalSnapshot().compositionCacheReused, 1);
assert.equal(second.metrics.getGlobalSnapshot().compositionRender, 1);
assert.equal(second.surfaceLogs.length, 0);
assert.deepEqual(second.rootLog.filter((entry) => entry === "drawImage"), [
  "drawImage",
]);

const childDirtyScene = scene(
  composition([
    layer("child-a", {
      opacity: 50,
    }),
  ])
);
const childDirtyCachedScene = applyPreviewNodeCacheFromScenes(
  baseScene,
  childDirtyScene
);
assert.notEqual(childDirtyCachedScene.scene?.nodes[0], baseComposition);
const childDirty = drawWithCache({
  previewScene: childDirtyCachedScene.scene ?? childDirtyScene,
  cache: first.cache,
  metrics: first.metrics,
});
assert.equal(childDirty.metrics.getGlobalSnapshot().compositionCacheMiss, 2);
assert.equal(childDirty.metrics.getGlobalSnapshot().compositionCacheCreate, 2);
assert.equal(childDirty.surfaceLogs.length, 1);

const qualityMiss = drawWithCache({
  previewScene: cachedScene.scene ?? baseScene,
  quality: "medium",
  cache: first.cache,
});
assert.equal(qualityMiss.metrics.getGlobalSnapshot().compositionCacheMiss, 1);
assert.equal(qualityMiss.metrics.getGlobalSnapshot().compositionCacheHit, 0);

const scaleMiss = drawWithCache({
  previewScene: cachedScene.scene ?? baseScene,
  scale: 0.5,
  cache: first.cache,
});
assert.equal(scaleMiss.metrics.getGlobalSnapshot().compositionCacheMiss, 1);
assert.equal(scaleMiss.metrics.getGlobalSnapshot().compositionCacheHit, 0);

const logicalSizeScene = scene(
  composition([child], {
    logicalSize: { width: 240, height: 120 },
  })
);
const logicalSizeMiss = drawWithCache({
  previewScene: logicalSizeScene,
  cache: first.cache,
});
assert.equal(logicalSizeMiss.metrics.getGlobalSnapshot().compositionCacheMiss, 1);
assert.equal(logicalSizeMiss.metrics.getGlobalSnapshot().compositionCacheHit, 0);

const transformCache = createCompositionPreviewCacheRuntime();
const transformDrawState: PreviewCanvasDrawState = {
  previousScene: null,
  previousNodeBoundsById: new Map(),
  previousPixelScale: null,
};
const transformFirst = renderCanvasWithCache({
  previewScene: baseScene,
  cache: transformCache,
  drawState: transformDrawState,
});
assert.ok(transformFirst.canvasLog.includes("clear:0,0,375,375"));
assert.equal(
  transformFirst.metrics.getGlobalSnapshot().compositionCacheMiss,
  1
);

const movedCompositionScene = scene(
  composition([child], {
    transform: {
      ...transform,
      position: { x: 80, y: 40 },
    },
  })
);
const movedCompositionCachedScene = applyPreviewNodeCacheFromScenes(
  baseScene,
  movedCompositionScene
);
const transformSecond = renderCanvasWithCache({
  previewScene: movedCompositionCachedScene.scene ?? movedCompositionScene,
  cache: transformCache,
  drawState: transformDrawState,
  metrics: transformFirst.metrics,
});
assert.ok(transformSecond.canvasLog.includes("clear:0,0,375,375"));
assert.equal(
  transformSecond.metrics.getGlobalSnapshot().compositionCacheMiss,
  2
);
assert.equal(
  transformSecond.metrics.getGlobalSnapshot().compositionCacheHit,
  0
);

const baselineMetrics = createRuntimeMetricsResource();
baselineMetrics.saveTaskBaseline();
const baselineCache = createCompositionPreviewCacheRuntime();
drawWithCache({
  previewScene: baseScene,
  cache: baselineCache,
  metrics: baselineMetrics,
});
drawWithCache({
  previewScene: baseScene,
  cache: baselineCache,
  metrics: baselineMetrics,
});
const baselineComparison = baselineMetrics.compareTaskBaseline();
assert.equal(
  baselineComparison.differences.find(
    (difference) => difference.counter === "compositionCacheHit"
  )?.difference,
  1
);
assert.equal(
  baselineComparison.differences.find(
    (difference) => difference.counter === "compositionCacheMiss"
  )?.difference,
  1
);

baselineCache.dispose();
assert.equal(baselineCache.getSnapshot().disposed, true);
assert.equal(baselineCache.getSnapshot().size, 0);

console.log("Composition cache verification passed");
