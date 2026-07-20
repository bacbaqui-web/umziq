import assert from "node:assert/strict";
import { createRuntimeMetricRecordPort } from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import { createCompositionPreviewCacheRuntime } from "@/engines/canvas/state/compositionPreviewCacheStore";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
import { createPreviewSurfaceCacheRuntime } from "@/engines/canvas/state/previewSurfaceCacheStore";
import type {
  EvaluatedScene,
  EvaluatedSceneNode,
  EvaluatedSceneTransform,
  PreviewCanvasDrawState,
  PreviewRenderSurface,
} from "@/engines/playback-render";
import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import {
  renderFastPreviewRenderer,
  renderPreviewSceneToCanvas,
} from "@/engines/playback-render";
import type { RenderDrawable, RenderItem } from "@/engines/project";

const frameCount = 400;
const previewNodeCount = 5;

const transform: EvaluatedSceneTransform = {
  position: { x: 0, y: 0 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

function makeTransform(x: number, y: number): EvaluatedSceneTransform {
  return {
    ...transform,
    position: { x, y },
  };
}

function drawableNode({
  id,
  x,
  y,
  renderItemId = "render-item",
  order = 0,
}: {
  id: string;
  x: number;
  y: number;
  renderItemId?: string;
  order?: number;
}): Extract<EvaluatedSceneNode, { type: "drawable" }> {
  return {
    type: "drawable",
    renderItemId,
    drawableId: id,
    sourceId: `${id}:source`,
    layerId: id,
    localFrame: 0,
    visible: true,
    order,
    logicalSize: { width: 20, height: 20 },
    transform: makeTransform(x, y),
    opacity: 100,
  };
}

function compositionNode(children: readonly EvaluatedSceneNode[]) {
  return {
    type: "composition",
    renderItemId: "render:composition-a",
    sourceId: "composition-a:source",
    targetCompId: "composition-a",
    localFrame: 0,
    visible: true,
    order: 0,
    size: { width: 120, height: 80 },
    transform: makeTransform(300, 240),
    opacity: 100,
    children: [...children],
  } satisfies Extract<EvaluatedSceneNode, { type: "composition" }>;
}

function makeScene(frame: number): EvaluatedScene {
  const childX = frame % 50 === 0 ? 55 + (frame % 100) / 10 : 55;
  const uiX = frame % 40 === 0 ? 290 + (frame % 120) / 10 : 290;
  return {
    compositionId: "performance-scene",
    globalFrame: frame,
    size: { width: 1920, height: 1080 },
    localFrameBySourceId: new Map(),
    nodes: [
      compositionNode([
        drawableNode({ id: "head", x: 40, y: 20 }),
        drawableNode({ id: "body", x: childX, y: 40, order: 1 }),
        drawableNode({ id: "arm", x: 90, y: 60, order: 2 }),
      ]),
      drawableNode({ id: "ui", x: uiX, y: 240, order: 1 }),
    ],
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

function createFakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => createFakeContext(),
  } as unknown as HTMLCanvasElement;
}

function createSurfaceFactory() {
  return (
    width: number,
    height: number,
    pixelScale: number
  ): PreviewRenderSurface => ({
    canvas: {
      width: Math.ceil(width * pixelScale),
      height: Math.ceil(height * pixelScale),
    } as HTMLCanvasElement,
    context: createFakeContext(),
  });
}

function createDrawState(): PreviewCanvasDrawState {
  return {
    previousScene: null,
    previousNodeBoundsById: new Map(),
    previousPixelScale: null,
  };
}

function renderItemsForNodes(nodes: readonly EvaluatedSceneNode[]): RenderItem[] {
  const drawablesByRenderItem = new Map<string, RenderDrawable[]>();
  function visit(node: EvaluatedSceneNode): void {
    if (node.type === "drawable") {
      const drawables = drawablesByRenderItem.get(node.renderItemId) ?? [];
      drawables.push({
        id: node.drawableId,
        canvas: {
          width: node.logicalSize.width,
          height: node.logicalSize.height,
        } as HTMLCanvasElement,
      } as RenderDrawable);
      drawablesByRenderItem.set(node.renderItemId, drawables);
      return;
    }
    node.children.forEach(visit);
  }
  nodes.forEach(visit);
  return [...drawablesByRenderItem.entries()].map(([id, drawables]) => ({
    id,
    compId: "performance-scene",
    drawables,
  }));
}

const metrics = createRuntimeMetricsResource();
const naiveDrawImagePerFrame = previewNodeCount;

metrics.increment("animationEvaluation", frameCount);
metrics.increment("fastPreviewRenderer", frameCount);
metrics.increment("previewSceneGeneration", frameCount);
metrics.increment("previewNodeUpdated", frameCount * previewNodeCount);
metrics.increment("compositionCacheMiss", frameCount);
metrics.increment("surfaceCreate", frameCount);
metrics.increment("drawImage", frameCount * naiveDrawImagePerFrame);
metrics.increment("canvasDrawTime", frameCount);
metrics.saveSprintBaseline();
metrics.resetGlobal();

const metricPort = createRuntimeMetricRecordPort(metrics);
const compositionCache = createCompositionPreviewCacheRuntime();
const surfaceCache = createPreviewSurfaceCacheRuntime({
  maxPoolSize: 4,
  metrics: metricPort,
});
const drawState = createDrawState();
const canvas = createFakeCanvas();
const renderItems = renderItemsForNodes(makeScene(0).nodes);
let previousPreviewScene = null;

for (let frame = 0; frame < frameCount; frame += 1) {
  metrics.increment("animationEvaluation");
  compositionCache.beginFrame();
  try {
    const previewScene = renderFastPreviewRenderer(
      makeScene(frame),
      metricPort,
      previousPreviewScene
    ).previewScene;
    previousPreviewScene = previewScene;
    renderPreviewSceneToCanvas({
      canvas,
      previewScene,
      renderItems,
      runtimeMetrics: metricPort,
      compositionCache,
      surfaceCache,
      drawState,
      createSurface: createSurfaceFactory(),
      previewQuality: "medium",
      pixelScale: 0.5,
    });
  } finally {
    compositionCache.endFrame();
  }
}

const comparison = metrics.compareSprintBaseline();
const differenceByCounter = new Map(
  comparison.differences.map((difference) => [difference.counter, difference])
);
const current = metrics.getGlobalSnapshot();

assert.equal(current.animationEvaluation, frameCount);
assert.equal(current.fastPreviewRenderer, frameCount);
assert.equal(current.previewSceneGeneration, 1);
assert.ok(current.playbackNodeReused > current.playbackNodeUpdated);
assert.ok(current.playbackCleanNode > current.playbackDirtyNode);
assert.ok(current.compositionCacheHit > 0);
assert.ok(current.drawImageSkipped > current.drawImage);
assert.ok(current.drawImage < frameCount * naiveDrawImagePerFrame);
assert.equal(surfaceCache.getSnapshot().poolSize <= 4, true);

compositionCache.dispose();
surfaceCache.dispose();
assert.equal(compositionCache.getSnapshot().size, 0);
assert.equal(surfaceCache.getSnapshot().activeCount, 0);
assert.equal(surfaceCache.getSnapshot().poolSize, 0);

const requiredImprovedCounters = [
  "previewSceneGeneration",
  "compositionCacheMiss",
  "surfaceCreate",
  "drawImage",
] as const;
requiredImprovedCounters.forEach((counter) => {
  const difference = differenceByCounter.get(counter);
  assert.ok(difference);
  assert.ok(difference.difference < 0);
});

const report = [
  "previewSceneGeneration",
  "playbackDirtyNode",
  "playbackCleanNode",
  "playbackNodeUpdated",
  "playbackNodeReused",
  "compositionCacheHit",
  "compositionCacheMiss",
  "surfaceCreate",
  "surfaceReuse",
  "surfaceDispose",
  "drawImage",
  "drawImageSkipped",
  "canvasDrawTime",
] as const;

console.log(
  "Preview performance QA verification passed",
  JSON.stringify(
    report.map((counter) => {
      const difference = differenceByCounter.get(counter);
      return {
        counter,
        baseline: difference?.baseline ?? 0,
        current: difference?.current ?? 0,
        difference: difference?.difference ?? 0,
      };
    })
  )
);
