import assert from "node:assert/strict";
import { createRuntimeMetricRecordPort } from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import { createCompositionPreviewCacheRuntime } from "@/engines/canvas/state/compositionPreviewCacheStore";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
import { createPreviewSurfaceCacheRuntime } from "@/engines/canvas/state/previewSurfaceCacheStore";
import type {
  PreviewCanvasDrawState,
  PreviewNode,
  PreviewRenderSurface,
  PreviewScene,
} from "@/engines/playback-render";
import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import { renderPreviewSceneToCanvas } from "@/engines/playback-render";
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
    beginPath: () => log.push("beginPath"),
    rect: (...values: number[]) => log.push(`rect:${values.join(",")}`),
    clip: () => log.push("clip"),
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

type PaintBounds = { left: number; top: number; right: number; bottom: number };

function intersectPaintBounds(
  left: PaintBounds,
  right: PaintBounds
): PaintBounds {
  return {
    left: Math.max(left.left, right.left),
    top: Math.max(left.top, right.top),
    right: Math.min(left.right, right.right),
    bottom: Math.min(left.bottom, right.bottom),
  };
}

function createRasterContext(width: number, height: number) {
  const pixels = Array.from({ length: width * height }, () => "transparent");
  let transformState = { scaleX: 1, scaleY: 1, x: 0, y: 0 };
  let clipBounds: PaintBounds = { left: 0, top: 0, right: width, bottom: height };
  let pathBounds: PaintBounds | null = null;
  let alpha = 1;
  const stack: Array<{
    transform: typeof transformState;
    clip: PaintBounds;
    alpha: number;
  }> = [];

  const paint = (bounds: PaintBounds, color: string) => {
    const clipped = intersectPaintBounds(bounds, clipBounds);
    for (let y = Math.max(0, Math.floor(clipped.top)); y < Math.min(height, Math.ceil(clipped.bottom)); y += 1) {
      for (let x = Math.max(0, Math.floor(clipped.left)); x < Math.min(width, Math.ceil(clipped.right)); x += 1) {
        pixels[y * width + x] = color;
      }
    }
  };

  const toBounds = (x: number, y: number, targetWidth: number, targetHeight: number) => ({
    left: transformState.x + x * transformState.scaleX,
    top: transformState.y + y * transformState.scaleY,
    right: transformState.x + (x + targetWidth) * transformState.scaleX,
    bottom: transformState.y + (y + targetHeight) * transformState.scaleY,
  });

  const context = {
    clearRect: (x: number, y: number, targetWidth: number, targetHeight: number) =>
      paint(toBounds(x, y, targetWidth, targetHeight), "transparent"),
    beginPath: () => {
      pathBounds = null;
    },
    rect: (x: number, y: number, targetWidth: number, targetHeight: number) => {
      pathBounds = toBounds(x, y, targetWidth, targetHeight);
    },
    clip: () => {
      if (pathBounds) clipBounds = intersectPaintBounds(clipBounds, pathBounds);
    },
    save: () => {
      stack.push({
        transform: { ...transformState },
        clip: { ...clipBounds },
        alpha,
      });
    },
    restore: () => {
      const previous = stack.pop();
      if (!previous) return;
      transformState = previous.transform;
      clipBounds = previous.clip;
      alpha = previous.alpha;
    },
    translate: (x: number, y: number) => {
      transformState.x += x * transformState.scaleX;
      transformState.y += y * transformState.scaleY;
    },
    rotate: () => {},
    scale: (x: number, y: number) => {
      transformState.scaleX *= x;
      transformState.scaleY *= y;
    },
    setTransform: (scaleX: number, _skewY: number, _skewX: number, scaleY: number, x: number, y: number) => {
      transformState = { scaleX, scaleY, x, y };
    },
    drawImage: (image: HTMLCanvasElement, _x: number, _y: number, targetWidth: number, targetHeight: number) => {
      const color = (image as HTMLCanvasElement & { paintColor?: string }).paintColor ?? "unknown";
      paint(toBounds(0, 0, targetWidth, targetHeight), color);
    },
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(value: number) {
      alpha = value;
    },
  } as Canvas2DRenderContext;

  return {
    context,
    readPixel: (x: number, y: number) => pixels[y * width + x],
  };
}

function createFakeCanvas(log: string[]) {
  return {
    width: 0,
    height: 0,
    getContext: () => createFakeContext(log),
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
      context: createFakeContext([]),
    };
    created.push(surface);
    return surface;
  };
}

function layer(
  id: string,
  x: number,
  overrides: Partial<PreviewNode> = {}
): PreviewNode {
  return {
    id,
    kind: "layer",
    sourceId: `${id}:source`,
    renderItemId: "render-item",
    parentId: null,
    children: [],
    transform: {
      ...transform,
      position: { x, y: 50 },
    },
    opacity: 100,
    visible: true,
    order: 0,
    localFrame: 0,
    globalFrame: 0,
    logicalSize: { width: 40, height: 40 },
    drawableId: id,
    layerId: id,
    ...overrides,
  } as PreviewNode;
}

function composition(
  id: string,
  children: readonly PreviewNode[],
  x: number,
  overrides: Partial<PreviewNode> = {}
): PreviewNode {
  return {
    id,
    kind: "composition",
    sourceId: `${id}:source`,
    renderItemId: "render-item",
    parentId: null,
    children,
    transform: {
      ...transform,
      position: { x, y: 50 },
    },
    opacity: 100,
    visible: true,
    order: 0,
    localFrame: 0,
    globalFrame: 0,
    logicalSize: { width: 80, height: 80 },
    targetCompId: id,
    ...overrides,
  } as PreviewNode;
}

function scene(nodes: readonly PreviewNode[], globalFrame = 0): PreviewScene {
  return {
    compositionId: "scene",
    globalFrame,
    logicalSize: { width: 400, height: 200 },
    nodes,
  };
}

const renderItem: RenderItem = {
  id: "render-item",
  compId: "scene",
  drawables: [
    { id: "layer-a", canvas: { width: 40, height: 40 } as HTMLCanvasElement },
    { id: "layer-b", canvas: { width: 40, height: 40 } as HTMLCanvasElement },
    { id: "child-a", canvas: { width: 40, height: 40 } as HTMLCanvasElement },
  ] as RenderDrawable[],
};

function createDrawState(): PreviewCanvasDrawState {
  return {
    previousScene: null,
    previousNodeBoundsById: new Map(),
    previousPixelScale: null,
  };
}

const metrics = createRuntimeMetricsResource();
const metricPort = createRuntimeMetricRecordPort(metrics);
const drawState = createDrawState();
const log: string[] = [];
const canvas = createFakeCanvas(log);
const layerA = layer("layer-a", 50);
const layerB = layer("layer-b", 220, { order: 1 });
const firstScene = scene([layerA, layerB]);

renderPreviewSceneToCanvas({
  canvas,
  previewScene: firstScene,
  renderItems: [renderItem],
  runtimeMetrics: metricPort,
  drawState,
});
assert.equal(metrics.getGlobalSnapshot().drawImage, 2);
assert.equal(metrics.getGlobalSnapshot().layerDraw, 2);
assert.equal(metrics.getGlobalSnapshot().drawImageSkipped, 0);

metrics.saveTaskBaseline();
const sameScene = scene([layerA, layerB], 1);
renderPreviewSceneToCanvas({
  canvas,
  previewScene: sameScene,
  renderItems: [renderItem],
  runtimeMetrics: metricPort,
  drawState,
});
assert.equal(metrics.getGlobalSnapshot().drawImage, 2);
assert.equal(metrics.getGlobalSnapshot().drawImageSkipped, 2);

const dirtyLayerB = layer("layer-b", 250, { order: 1 });
renderPreviewSceneToCanvas({
  canvas,
  previewScene: scene([layerA, dirtyLayerB], 2),
  renderItems: [renderItem],
  runtimeMetrics: metricPort,
  drawState,
});
assert.equal(metrics.getGlobalSnapshot().drawImage, 3);
assert.equal(metrics.getGlobalSnapshot().layerDraw, 3);
assert.equal(metrics.getGlobalSnapshot().drawImageSkipped, 3);

const comparison = metrics.compareTaskBaseline();
assert.equal(
  comparison.differences.find(
    (difference) => difference.counter === "drawImage"
  )?.difference,
  1
);
assert.equal(
  comparison.differences.find(
    (difference) => difference.counter === "drawImageSkipped"
  )?.difference,
  3
);

const compositionMetrics = createRuntimeMetricsResource();
const compositionPort = createRuntimeMetricRecordPort(compositionMetrics);
const compositionCache = createCompositionPreviewCacheRuntime();
const surfaceCache = createPreviewSurfaceCacheRuntime({
  metrics: compositionPort,
});
const compositionDrawState = createDrawState();
const compositionCanvas = createFakeCanvas([]);
const createdSurfaces: PreviewRenderSurface[] = [];
const child = layer("child-a", 40, { parentId: "composition-a" });
const cleanComposition = composition("composition-a", [child], 80);
const overlappingLayer = layer("layer-b", 110, { order: 1 });

compositionCache.beginFrame();
renderPreviewSceneToCanvas({
  canvas: compositionCanvas,
  previewScene: scene([cleanComposition, overlappingLayer]),
  renderItems: [renderItem],
  createSurface: createSurfaceFactory(createdSurfaces),
  runtimeMetrics: compositionPort,
  compositionCache,
  surfaceCache,
  drawState: compositionDrawState,
  previewQuality: "high",
  pixelScale: 0.75,
});
compositionCache.endFrame();
assert.equal(compositionMetrics.getGlobalSnapshot().compositionCacheMiss, 1);
assert.equal(compositionMetrics.getGlobalSnapshot().compositionDraw, 1);
assert.equal(compositionMetrics.getGlobalSnapshot().layerDraw, 2);

compositionCache.beginFrame();
renderPreviewSceneToCanvas({
  canvas: compositionCanvas,
  previewScene: scene([
    cleanComposition,
    layer("layer-b", 112, { order: 1 }),
  ]),
  renderItems: [renderItem],
  createSurface: createSurfaceFactory(createdSurfaces),
  runtimeMetrics: compositionPort,
  compositionCache,
  surfaceCache,
  drawState: compositionDrawState,
  previewQuality: "high",
  pixelScale: 0.75,
});
compositionCache.endFrame();
assert.equal(compositionMetrics.getGlobalSnapshot().compositionCacheHit, 1);
assert.equal(compositionMetrics.getGlobalSnapshot().compositionDraw, 2);
assert.equal(compositionMetrics.getGlobalSnapshot().layerDraw, 3);
assert.equal(compositionMetrics.getGlobalSnapshot().surfaceCreate, 1);
assert.equal(compositionMetrics.getGlobalSnapshot().surfaceReuse, 0);

function centeredLayer(
  id: string,
  position: { x: number; y: number },
  logicalSize: { width: number; height: number },
  order: number,
  anchor = {
    x: logicalSize.width / 2,
    y: logicalSize.height / 2,
  }
): PreviewNode {
  return layer(id, position.x, {
    order,
    renderItemId: "retained-render-item",
    logicalSize,
    transform: {
      ...transform,
      position,
      anchor,
    },
  });
}

function paintCanvas(
  width: number,
  height: number,
  paintColor: string
): HTMLCanvasElement {
  return { width, height, paintColor } as unknown as HTMLCanvasElement;
}

const retainedRaster = createRasterContext(400, 200);
const retainedCanvas = {
  width: 0,
  height: 0,
  getContext: () => retainedRaster.context,
} as unknown as HTMLCanvasElement;
const retainedDrawState = createDrawState();
const retainedRenderItem: RenderItem = {
  id: "retained-render-item",
  compId: "scene",
  drawables: [
    { id: "background", canvas: paintCanvas(400, 200, "background") },
    { id: "foreground", canvas: paintCanvas(40, 40, "foreground") },
    { id: "mover", canvas: paintCanvas(40, 40, "mover") },
  ] as RenderDrawable[],
};
const background = centeredLayer(
  "background",
  { x: 200, y: 100 },
  { width: 400, height: 200 },
  0
);
const foreground = centeredLayer(
  "foreground",
  { x: 300, y: 100 },
  { width: 40, height: 40 },
  1
);
const overlappingMover = centeredLayer(
  "mover",
  { x: 270, y: 100 },
  { width: 40, height: 40 },
  2,
  { x: 5, y: 20 }
);

renderPreviewSceneToCanvas({
  canvas: retainedCanvas,
  previewScene: scene([background, foreground, overlappingMover]),
  renderItems: [retainedRenderItem],
  drawState: retainedDrawState,
});
assert.equal(retainedRaster.readPixel(300, 100), "foreground");

const separatedMover = centeredLayer(
  "mover",
  { x: 80, y: 100 },
  { width: 40, height: 40 },
  2,
  { x: 5, y: 20 }
);
renderPreviewSceneToCanvas({
  canvas: retainedCanvas,
  previewScene: scene([background, foreground, separatedMover], 1),
  renderItems: [retainedRenderItem],
  drawState: retainedDrawState,
});
assert.equal(retainedRaster.readPixel(300, 100), "foreground");

const stillSeparatedMover = centeredLayer(
  "mover",
  { x: 100, y: 100 },
  { width: 40, height: 40 },
  2,
  { x: 5, y: 20 }
);
renderPreviewSceneToCanvas({
  canvas: retainedCanvas,
  previewScene: scene([background, foreground, stillSeparatedMover], 2),
  renderItems: [retainedRenderItem],
  drawState: retainedDrawState,
});
assert.equal(
  retainedRaster.readPixel(300, 100),
  "foreground",
  "dirty redraw must not let a large background overwrite retained foreground pixels outside the dirty bounds"
);
assert.equal(retainedRaster.readPixel(115, 100), "mover");

const returnedMover = centeredLayer(
  "mover",
  { x: 80, y: 100 },
  { width: 40, height: 40 },
  2,
  { x: 5, y: 20 }
);
renderPreviewSceneToCanvas({
  canvas: retainedCanvas,
  previewScene: scene([background, foreground, returnedMover], 3),
  renderItems: [retainedRenderItem],
  drawState: retainedDrawState,
});
assert.equal(
  retainedRaster.readPixel(115, 100),
  "background",
  "non-centered anchor position drafts must clear pixels from the previous transformed bounds"
);

const compositionFullLog: string[] = [];
const compositionFullCanvas = createFakeCanvas(compositionFullLog);
const compositionFullState = createDrawState();
const compositionNode = composition("composition-a", [child], 80);
renderPreviewSceneToCanvas({
  canvas: compositionFullCanvas,
  previewScene: scene([compositionNode]),
  renderItems: [renderItem],
  createSurface: createSurfaceFactory([]),
  drawState: compositionFullState,
});
const firstCompositionRenderLogLength = compositionFullLog.length;
renderPreviewSceneToCanvas({
  canvas: compositionFullCanvas,
  previewScene: scene([composition("composition-a", [child], 100)], 1),
  renderItems: [renderItem],
  createSurface: createSurfaceFactory([]),
  drawState: compositionFullState,
});
const movedCompositionLog = compositionFullLog.slice(firstCompositionRenderLogLength);
assert.ok(movedCompositionLog.includes("clear:0,0,400,200"));
assert.ok(!movedCompositionLog.includes("clip"));

console.log("drawImage optimization verification passed");
