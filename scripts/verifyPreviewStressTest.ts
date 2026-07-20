import assert from "node:assert/strict";
import {
  buildPreviewCacheGeneration,
  getPreviewBuildCacheKeys,
} from "@/engines/canvas/controllers/buildPreviewCacheGeneration";
import { createRuntimeMetricRecordPort } from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import type {
  PreviewBitmapFactoryPort,
  PreviewBuildSource,
} from "@/engines/canvas/models/previewBuildModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import { PREVIEW_QUALITY_SCALE } from "@/engines/canvas/constants/previewQualityConstants";
import { createCompositionPreviewCacheRuntime } from "@/engines/canvas/state/compositionPreviewCacheStore";
import { createPreviewCacheRuntime } from "@/engines/canvas/state/previewCacheRuntimeStore";
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

const baseTransform: EvaluatedSceneTransform = {
  position: { x: 0, y: 0 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

function makeTransform(x: number, y: number): EvaluatedSceneTransform {
  return {
    ...baseTransform,
    position: { x, y },
  };
}

function drawableNode({
  id,
  x,
  y,
  renderItemId = "render-item",
  order = 0,
  opacity = 100,
}: {
  id: string;
  x: number;
  y: number;
  renderItemId?: string;
  order?: number;
  opacity?: number;
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
    opacity,
  };
}

function compositionNode({
  id,
  x,
  y,
  children,
  order = 0,
}: {
  id: string;
  x: number;
  y: number;
  children: readonly EvaluatedSceneNode[];
  order?: number;
}): Extract<EvaluatedSceneNode, { type: "composition" }> {
  return {
    type: "composition",
    renderItemId: `render:${id}`,
    sourceId: `${id}:source`,
    targetCompId: id,
    localFrame: 0,
    visible: true,
    order,
    size: { width: 120, height: 80 },
    transform: makeTransform(x, y),
    opacity: 100,
    children: [...children],
  };
}

function evaluatedScene(
  nodes: readonly EvaluatedSceneNode[],
  globalFrame: number
): EvaluatedScene {
  return {
    compositionId: "stress-scene",
    globalFrame,
    size: { width: 1920, height: 1080 },
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

function createFakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => createFakeContext(),
  } as unknown as HTMLCanvasElement;
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
    compId: "stress-scene",
    drawables,
  }));
}

function makePlaybackNodes(frame: number): EvaluatedSceneNode[] {
  const movingX = frame % 250 === 0 ? 200 + (frame % 1_000) / 10 : 200;
  const overlayX = frame % 40 === 0 ? 290 + (frame % 120) / 10 : 290;
  return [
    compositionNode({
      id: "character",
      x: 300,
      y: 240,
      children: [
        drawableNode({ id: "head", x: 40, y: 20 }),
        drawableNode({ id: "body", x: movingX, y: 40, order: 1 }),
        drawableNode({ id: "arm", x: 90, y: 60, order: 2 }),
      ],
    }),
    drawableNode({ id: "ui", x: overlayX, y: 240, order: 1 }),
  ];
}

const runtimeMetrics = createRuntimeMetricsResource();
const metricPort = createRuntimeMetricRecordPort(runtimeMetrics);
let previousPreviewScene = renderFastPreviewRenderer(
  evaluatedScene(makePlaybackNodes(0), 0),
  metricPort
).previewScene;

for (let frame = 1; frame <= 10_000; frame += 1) {
  previousPreviewScene = renderFastPreviewRenderer(
    evaluatedScene(makePlaybackNodes(frame), frame),
    metricPort,
    previousPreviewScene
  ).previewScene;
}
const playbackMetrics = runtimeMetrics.getGlobalSnapshot();
assert.equal(playbackMetrics.previewSceneGeneration, 1);
assert.ok(playbackMetrics.playbackNodeReused > playbackMetrics.playbackNodeUpdated);
assert.ok(playbackMetrics.playbackCleanNode > playbackMetrics.playbackDirtyNode);
assert.ok(playbackMetrics.fastPreviewRenderer, 10_001);

const renderItems = renderItemsForNodes(makePlaybackNodes(0));
const compositionCache = createCompositionPreviewCacheRuntime();
const surfaceMetrics = createRuntimeMetricsResource();
const surfacePort = createRuntimeMetricRecordPort(surfaceMetrics);
const surfaceCache = createPreviewSurfaceCacheRuntime({
  maxPoolSize: 4,
  metrics: surfacePort,
});
const drawState = createDrawState();
const canvas = createFakeCanvas();
const createdSurfaces: PreviewRenderSurface[] = [];
for (let frame = 0; frame < 400; frame += 1) {
  compositionCache.beginFrame();
  try {
    const previewScene = renderFastPreviewRenderer(
      evaluatedScene(makePlaybackNodes(frame), frame),
      surfacePort,
      drawState.previousScene
    ).previewScene;
    renderPreviewSceneToCanvas({
      canvas,
      previewScene,
      renderItems,
      runtimeMetrics: surfacePort,
      compositionCache,
      surfaceCache,
      drawState,
      createSurface: createSurfaceFactory(createdSurfaces),
      previewQuality: "medium",
      pixelScale: 0.5,
    });
  } finally {
    compositionCache.endFrame();
  }
}
const drawMetrics = surfaceMetrics.getGlobalSnapshot();
assert.ok(drawMetrics.drawImageSkipped > drawMetrics.drawImage);
assert.ok(drawMetrics.compositionCacheHit > 0);
assert.ok(drawMetrics.surfaceCreate <= createdSurfaces.length);
assert.ok(surfaceCache.getSnapshot().activeCount > 0);
const surfacePoolBeforeDispose = surfaceCache.getSnapshot().poolSize;
assert.ok(surfacePoolBeforeDispose <= 4);
compositionCache.dispose();
surfaceCache.dispose();
assert.equal(compositionCache.getSnapshot().size, 0);
assert.equal(surfaceCache.getSnapshot().activeCount, 0);
assert.equal(surfaceCache.getSnapshot().poolSize, 0);

function makeLargeSceneNodes(): EvaluatedSceneNode[] {
  return Array.from({ length: 300 }, (_, compositionIndex) => {
    const childCount = compositionIndex < 100 ? 4 : 3;
    return compositionNode({
      id: `comp-${compositionIndex}`,
      x: (compositionIndex % 30) * 60,
      y: Math.floor(compositionIndex / 30) * 60,
      order: compositionIndex,
      children: Array.from({ length: childCount }, (_, childIndex) =>
        drawableNode({
          id: `layer-${compositionIndex}-${childIndex}`,
          renderItemId: `render:comp-${compositionIndex}`,
          x: childIndex * 22,
          y: childIndex * 11,
          order: childIndex,
        })
      ),
    });
  });
}

const largeNodes = makeLargeSceneNodes();
const largeRenderItems = renderItemsForNodes(largeNodes);
assert.equal(largeNodes.length, 300);
assert.equal(
  largeRenderItems.reduce((sum, item) => sum + item.drawables.length, 0),
  1_000
);
const largeMetrics = createRuntimeMetricsResource();
const largePort = createRuntimeMetricRecordPort(largeMetrics);
const largeCompositionCache = createCompositionPreviewCacheRuntime();
const largeSurfaceCache = createPreviewSurfaceCacheRuntime({
  maxPoolSize: 16,
  metrics: largePort,
});
const largeDrawState = createDrawState();
const largeCanvas = createFakeCanvas();
largeCompositionCache.beginFrame();
renderPreviewSceneToCanvas({
  canvas: largeCanvas,
  previewScene: renderFastPreviewRenderer(
    evaluatedScene(largeNodes, 0),
    largePort
  ).previewScene,
  renderItems: largeRenderItems,
  runtimeMetrics: largePort,
  compositionCache: largeCompositionCache,
  surfaceCache: largeSurfaceCache,
  drawState: largeDrawState,
  createSurface: createSurfaceFactory([]),
  previewQuality: "low",
  pixelScale: 0.25,
});
largeCompositionCache.endFrame();
assert.equal(largeMetrics.getGlobalSnapshot().compositionRender, 300);
assert.equal(largeMetrics.getGlobalSnapshot().layerDraw, 1_000);
assert.equal(largeSurfaceCache.getSnapshot().activeCount, 300);
largeCompositionCache.dispose();
largeSurfaceCache.dispose();
assert.equal(largeCompositionCache.getSnapshot().size, 0);
assert.equal(largeSurfaceCache.getSnapshot().activeCount, 0);
assert.equal(largeSurfaceCache.getSnapshot().poolSize, 0);

function makeSource(
  index: number,
  fingerprint = `fingerprint-${index}`,
  size = 256
): PreviewBuildSource {
  const sourceId = `source-${index}`;
  return {
    sourceId,
    sourceIds: [sourceId],
    sourceIdentity: {
      sourceFileName: "stress.psd",
      sourceKey: `layer-id:${index}`,
    },
    sourceFingerprint: fingerprint,
    sourceCanvas: { width: size, height: size } as HTMLCanvasElement,
    logicalSize: { width: size, height: size },
  };
}

let factoryCalls = 0;
let bitmapDisposeCalls = 0;
const factory: PreviewBitmapFactoryPort = async (input) => {
  factoryCalls += 1;
  const scale = PREVIEW_QUALITY_SCALE[input.quality];
  const width = Math.ceil(input.sourceCanvas.width * scale);
  const height = Math.ceil(input.sourceCanvas.height * scale);
  return {
    ok: true,
    resource: {
      key: input.key,
      generation: input.generation,
      sourceId: input.sourceId,
      sourceFingerprint: input.sourceFingerprint,
      quality: input.quality,
      estimatedBytes: width * height * 4,
      allocatedBytes: width * height * 4,
      bitmap: {
        image: { width, height } as ImageBitmap,
        pixelSize: { width, height },
        logicalSize: { ...input.logicalSize },
        dispose: () => {
          bitmapDisposeCalls += 1;
        },
      },
    },
  };
};

const previewCache = createPreviewCacheRuntime(Number.POSITIVE_INFINITY);
let sources = Array.from({ length: 24 }, (_, index) => makeSource(index));
let activeKeys: ReadonlyMap<string, string> = new Map();
async function buildSources(quality: ResolvedPreviewQuality) {
  previewCache.setActiveKeys([
    ...new Set([
      ...activeKeys.values(),
      ...getPreviewBuildCacheKeys(sources, quality),
    ]),
  ]);
  const result = await buildPreviewCacheGeneration({
    sources,
    quality,
    cache: previewCache,
    factory,
    concurrency: 6,
  });
  assert.equal(result.status, "completed");
  activeKeys = result.resourceKeyBySourceId;
  previewCache.setActiveKeys([...new Set(activeKeys.values())]);
}

for (const quality of ["original", "high", "medium", "low"] as const) {
  await buildSources(quality);
}
const stableBytes = previewCache.getSnapshot().trackedBytes;
for (let cycle = 0; cycle < 10; cycle += 1) {
  await buildSources((["auto", "original", "high", "medium", "low"] as const)[
    cycle % 5
  ] === "auto"
    ? "low"
    : (["original", "high", "medium", "low"] as const)[cycle % 4]);
}
assert.equal(previewCache.getSnapshot().trackedBytes, stableBytes);

for (let cycle = 0; cycle < 20; cycle += 1) {
  sources = [
    ...sources.slice(0, cycle % sources.length),
    makeSource(cycle % sources.length, `refresh-${cycle}`),
    ...sources.slice((cycle % sources.length) + 1),
  ];
  await buildSources("low");
  sources = [...sources, makeSource(10_000 + cycle, `import-${cycle}`, 128)];
  await buildSources("low");
  sources = sources.slice(0, -1);
  await buildSources("low");
}
assert.ok(previewCache.getSnapshot().size <= sources.length * 6);
assert.ok(factoryCalls > sources.length);
const bytesBeforeDispose = previewCache.getSnapshot().trackedBytes;
assert.ok(bytesBeforeDispose > 0);
assert.ok(bytesBeforeDispose <= stableBytes * 2);
previewCache.dispose();
assert.equal(previewCache.getSnapshot().trackedBytes, 0);
assert.equal(previewCache.getSnapshot().size, 0);
assert.ok(bitmapDisposeCalls > 0);

const memoryReport = {
  peakTrackedBytes: Math.max(
    stableBytes,
    bytesBeforeDispose,
    largeMetrics.getGlobalSnapshot().surfaceCreate
  ),
  averagePlaybackDirtyNode:
    playbackMetrics.playbackDirtyNode / Math.max(1, playbackMetrics.fastPreviewRenderer),
  finalPreviewCacheBytes: previewCache.getSnapshot().trackedBytes,
};
assert.equal(memoryReport.finalPreviewCacheBytes, 0);
assert.ok(memoryReport.peakTrackedBytes > 0);

console.log(
  "Preview runtime stress verification passed",
  JSON.stringify(memoryReport)
);
