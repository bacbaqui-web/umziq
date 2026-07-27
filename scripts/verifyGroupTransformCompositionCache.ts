import assert from "node:assert/strict";
import {
  createCompositionPreviewCacheRuntime,
  createRuntimeMetricsResource,
} from "@/engines/canvas/testing";
import {
  createRuntimeMetricRecordPort,
} from "@/engines/canvas/testing";
import {
  renderPreviewSceneToCanvas,
  type PreviewCanvasDrawState,
  type PreviewRenderSurface,
  type PreviewScene,
} from "@/render";

const transform = {
  position: { x: 50, y: 50 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 50, y: 50 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

const child = {
  id: "layer:child",
  kind: "layer" as const,
  layerDocumentId: "layer:child",
  sourceId: "source:child",
  sourceResourceCacheKey: "source:child:v1",
  layerResultCacheKey: "result:child:v1",
  sourceType: "psd" as const,
  renderItemId: "render:child",
  parentId: "group:one",
  children: [] as [],
  transform,
  opacity: 100,
  visible: true,
  order: 0,
  localFrame: 0,
  globalFrame: 0,
  logicalSize: { width: 50, height: 50 },
  drawableId: "drawable:child",
};

const group = {
  id: "group:one",
  kind: "composition" as const,
  layerDocumentId: "group:one",
  sourceId: null,
  sourceResourceCacheKey: null,
  layerResultCacheKey: "result:group:committed",
  sourceType: "group" as const,
  renderItemId: "render:group",
  parentId: null,
  children: [child],
  transform,
  opacity: 100,
  visible: true,
  order: 0,
  localFrame: 0,
  globalFrame: 0,
  logicalSize: { width: 100, height: 100 },
  targetCompId: "group:one",
};

function scene(node: typeof group): PreviewScene {
  return {
    compositionId: "group:root",
    globalFrame: 0,
    logicalSize: { width: 300, height: 300 },
    nodes: [node],
  };
}

let childDrawCount = 0;
function context() {
  return {
    globalAlpha: 1,
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
    drawImage: (image: CanvasImageSource) => {
      const identity = (
        image as CanvasImageSource & { identity?: string }
      ).identity;
      if (identity === "child") childDrawCount += 1;
    },
  } as unknown as CanvasRenderingContext2D;
}

const createSurface = (
  width: number,
  height: number,
  pixelScale: number
): PreviewRenderSurface => ({
  canvas: {
    width: Math.ceil(width * pixelScale),
    height: Math.ceil(height * pixelScale),
  } as HTMLCanvasElement,
  context: context(),
});

const canvas = {
  width: 0,
  height: 0,
  getContext: () => context(),
} as unknown as HTMLCanvasElement;
const metrics = createRuntimeMetricsResource();
const metricPort = createRuntimeMetricRecordPort(metrics);
const compositionCache = createCompositionPreviewCacheRuntime();
const drawState: PreviewCanvasDrawState = {
  previousScene: null,
  previousNodeBoundsById: new Map(),
  previousPixelScale: null,
};
const render = (previewScene: PreviewScene) => {
  compositionCache.beginFrame();
  renderPreviewSceneToCanvas({
    canvas,
    previewScene,
    pixelScale: 1,
    previewQuality: "original",
    createSurface,
    runtimeMetrics: metricPort,
    compositionCache,
    drawState,
    resolveNodeVisual: () => ({
      kind: "original",
      image: { identity: "child" } as unknown as CanvasImageSource,
      pixelSize: { width: 50, height: 50 },
    }),
  });
  compositionCache.endFrame();
};

const committedScene = scene(group);
render(committedScene);
assert.equal(childDrawCount, 1);
assert.equal(metrics.getFrameSnapshot().dirtyFull, 1);
assert.equal(metrics.getFrameSnapshot().compositionCacheMiss, 1);

const movedGroup = {
  ...group,
  layerResultCacheKey: "result:group:draft-position",
  transform: {
    ...group.transform,
    position: { x: 90, y: 70 },
  },
};
render(scene(movedGroup));
assert.equal(childDrawCount, 1);
assert.equal(metrics.getFrameSnapshot().dirtyFull, 0);
assert.equal(metrics.getFrameSnapshot().dirtyPartial, 1);
assert.ok(metrics.getFrameSnapshot().compositionCacheHit >= 1);

const changedChild = {
  ...child,
  layerResultCacheKey: "result:child:v2",
  opacity: 50,
};
render(scene({
  ...movedGroup,
  layerResultCacheKey: "result:group:child-changed",
  children: [changedChild],
}));
assert.equal(childDrawCount, 2);
assert.equal(metrics.getFrameSnapshot().dirtyFull, 0);
assert.equal(metrics.getFrameSnapshot().dirtyPartial, 1);
assert.equal(metrics.getFrameSnapshot().compositionCacheMiss, 1);

console.log("Group Transform composition cache verification passed");
