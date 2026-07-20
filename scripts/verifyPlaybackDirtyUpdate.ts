import assert from "node:assert/strict";
import { createRuntimeMetricRecordPort } from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import { createCompositionPreviewCacheRuntime } from "@/engines/canvas/state/compositionPreviewCacheStore";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
import { createPreviewSurfaceCacheRuntime } from "@/engines/canvas/state/previewSurfaceCacheStore";
import type { PreviewRenderSurface } from "@/engines/playback-render/adapters/canvas2dPreviewSceneAdapter";
import { drawPreviewSceneToContext } from "@/engines/playback-render/adapters/canvas2dPreviewSceneAdapter";
import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import type {
  EvaluatedScene,
  EvaluatedSceneNode,
  EvaluatedSceneTransform,
} from "@/engines/playback-render/models/evaluatedSceneModel";
import { renderFastPreviewRenderer } from "@/engines/playback-render/renderers/fastPreviewRenderer";
import type { RenderDrawable, RenderItem } from "@/engines/project";

const transform: EvaluatedSceneTransform = {
  position: { x: 0, y: 0 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

function drawableNode(
  id: string,
  overrides: Partial<Extract<EvaluatedSceneNode, { type: "drawable" }>> = {}
): Extract<EvaluatedSceneNode, { type: "drawable" }> {
  return {
    type: "drawable",
    renderItemId: "render-item",
    drawableId: id,
    sourceId: `${id}:source`,
    layerId: id,
    localFrame: 0,
    visible: true,
    order: 0,
    logicalSize: { width: 100, height: 100 },
    transform,
    opacity: 100,
    ...overrides,
  };
}

function compositionNode(
  children: readonly EvaluatedSceneNode[],
  overrides: Partial<Extract<EvaluatedSceneNode, { type: "composition" }>> = {}
): Extract<EvaluatedSceneNode, { type: "composition" }> {
  return {
    type: "composition",
    renderItemId: "composition-render-item",
    sourceId: "composition-a:source",
    targetCompId: "composition-a",
    localFrame: 0,
    visible: true,
    order: 0,
    size: { width: 200, height: 120 },
    transform,
    opacity: 100,
    children: [...children],
    ...overrides,
  };
}

function evaluatedScene(
  nodes: readonly EvaluatedSceneNode[],
  globalFrame = 0
): EvaluatedScene {
  return {
    compositionId: "scene",
    globalFrame,
    size: { width: 500, height: 500 },
    localFrameBySourceId: new Map(),
    nodes: [...nodes],
  };
}

function createFakeContext(): Canvas2DRenderContext {
  let alpha = 1;
  return {
    clearRect: () => undefined,
    beginPath: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    setTransform: () => undefined,
    drawImage: () => undefined,
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(value: number) {
      alpha = value;
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
      context: createFakeContext(),
    };
    created.push(surface);
    return surface;
  };
}

const drawableCanvas = { width: 100, height: 100 } as HTMLCanvasElement;
const renderItems: RenderItem[] = [
  {
    id: "render-item",
    compId: "scene",
    drawables: [
      {
        id: "layer-a",
        canvas: drawableCanvas,
      } as RenderDrawable,
    ],
  },
];

const metrics = createRuntimeMetricsResource();
const metricPort = createRuntimeMetricRecordPort(metrics);
const baseScene = evaluatedScene([
  compositionNode([drawableNode("layer-a")]),
  drawableNode("layer-b", { order: 1 }),
]);
const first = renderFastPreviewRenderer(baseScene, metricPort);
assert.equal(metrics.getGlobalSnapshot().previewSceneGeneration, 1);
assert.equal(metrics.getGlobalSnapshot().fastPreviewRenderer, 1);

metrics.saveTaskBaseline();
const sameVisualNextFrame = renderFastPreviewRenderer(
  evaluatedScene([compositionNode([drawableNode("layer-a")]), drawableNode("layer-b", { order: 1 })], 1),
  metricPort,
  first.previewScene
);
assert.notEqual(sameVisualNextFrame.previewScene, first.previewScene);
assert.equal(sameVisualNextFrame.previewScene.globalFrame, 1);
assert.equal(
  sameVisualNextFrame.previewScene.nodes[0],
  first.previewScene.nodes[0]
);
assert.equal(
  sameVisualNextFrame.previewScene.nodes[1],
  first.previewScene.nodes[1]
);
assert.equal(metrics.getGlobalSnapshot().playbackDirtyNode, 0);
assert.equal(metrics.getGlobalSnapshot().playbackCleanNode, 3);
assert.equal(metrics.getGlobalSnapshot().playbackNodeUpdated, 0);
assert.equal(metrics.getGlobalSnapshot().playbackNodeReused, 3);
assert.equal(metrics.getGlobalSnapshot().playbackCompositionReused, 1);
assert.equal(metrics.getGlobalSnapshot().previewSceneGeneration, 1);

const transformDirty = renderFastPreviewRenderer(
  evaluatedScene(
    [
      compositionNode([
        drawableNode("layer-a", {
          transform: { ...transform, position: { x: 10, y: 0 } },
        }),
      ]),
      drawableNode("layer-b", { order: 1 }),
    ],
    2
  ),
  metricPort,
  sameVisualNextFrame.previewScene
);
assert.notEqual(
  transformDirty.previewScene.nodes[0],
  sameVisualNextFrame.previewScene.nodes[0]
);
assert.notEqual(
  transformDirty.previewScene.nodes[0]?.children[0],
  sameVisualNextFrame.previewScene.nodes[0]?.children[0]
);
assert.equal(
  transformDirty.previewScene.nodes[1],
  sameVisualNextFrame.previewScene.nodes[1]
);
assert.equal(metrics.getGlobalSnapshot().playbackDirtyNode, 2);
assert.equal(metrics.getGlobalSnapshot().playbackCleanNode, 4);
assert.equal(metrics.getGlobalSnapshot().playbackNodeUpdated, 2);
assert.equal(metrics.getGlobalSnapshot().playbackNodeReused, 4);

const opacityDirty = renderFastPreviewRenderer(
  evaluatedScene(
    [
      compositionNode([
        drawableNode("layer-a", {
          transform: { ...transform, position: { x: 10, y: 0 } },
          opacity: 50,
        }),
      ]),
      drawableNode("layer-b", { order: 1 }),
    ],
    3
  ),
  metricPort,
  transformDirty.previewScene
);
assert.notEqual(
  opacityDirty.previewScene.nodes[0],
  transformDirty.previewScene.nodes[0]
);
assert.equal(opacityDirty.previewScene.nodes[1], transformDirty.previewScene.nodes[1]);

const comparison = metrics.compareTaskBaseline();
assert.equal(
  comparison.differences.find(
    (difference) => difference.counter === "playbackNodeReused"
  )?.difference,
  5
);
assert.ok(
  (comparison.differences.find(
    (difference) => difference.counter === "playbackFrameUpdateTime"
  )?.difference ?? 0) >= 3
);

const compositionCache = createCompositionPreviewCacheRuntime();
const surfaceMetrics = createRuntimeMetricsResource();
const surfaceMetricPort = createRuntimeMetricRecordPort(surfaceMetrics);
const surfaceCache = createPreviewSurfaceCacheRuntime({
  metrics: surfaceMetricPort,
});
const createdSurfaces: PreviewRenderSurface[] = [];

compositionCache.beginFrame();
drawPreviewSceneToContext(
  createFakeContext(),
  first.previewScene,
  renderItems,
  undefined,
  createSurfaceFactory(createdSurfaces),
  0.75,
  surfaceMetricPort,
  compositionCache,
  "high",
  surfaceCache
);
compositionCache.endFrame();
assert.equal(surfaceMetrics.getGlobalSnapshot().compositionCacheMiss, 1);
assert.equal(surfaceMetrics.getGlobalSnapshot().surfaceCreate, 1);

compositionCache.beginFrame();
drawPreviewSceneToContext(
  createFakeContext(),
  sameVisualNextFrame.previewScene,
  renderItems,
  undefined,
  createSurfaceFactory(createdSurfaces),
  0.75,
  surfaceMetricPort,
  compositionCache,
  "high",
  surfaceCache
);
compositionCache.endFrame();
assert.equal(surfaceMetrics.getGlobalSnapshot().compositionCacheHit, 1);
assert.equal(surfaceMetrics.getGlobalSnapshot().surfaceCreate, 1);

compositionCache.beginFrame();
drawPreviewSceneToContext(
  createFakeContext(),
  transformDirty.previewScene,
  renderItems,
  undefined,
  createSurfaceFactory(createdSurfaces),
  0.75,
  surfaceMetricPort,
  compositionCache,
  "high",
  surfaceCache
);
compositionCache.endFrame();
assert.equal(surfaceMetrics.getGlobalSnapshot().compositionCacheMiss, 2);
assert.equal(surfaceMetrics.getGlobalSnapshot().surfaceCreate, 2);
assert.equal(surfaceMetrics.getGlobalSnapshot().surfaceReuse, 0);

console.log("Playback dirty update verification passed");
