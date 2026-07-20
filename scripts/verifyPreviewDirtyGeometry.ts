import assert from "node:assert/strict";
import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import { renderPreviewSceneToCanvas } from "@/engines/playback-render/adapters/canvas2dPreviewSceneAdapter";
import { getRenderTransformBounds } from "@/engines/playback-render/helpers/renderTransformHelpers";
import type {
  PreviewCanvasDrawState,
  PreviewNode,
  PreviewScene,
} from "@/engines/playback-render";
import type { RenderItem } from "@/engines/project";

function closeTo(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `expected ${actual} to be close to ${expected}`
  );
}

const geometryTransform = {
  position: { x: 240.5, y: 130.25 },
  transformOffset: { x: 13, y: -7 },
  anchor: { x: 17, y: 61 },
  scale: { x: 150, y: 65 },
  rotation: 33,
};
const geometryWidth = 120;
const geometryHeight = 80;
const geometryOrigin = {
  x:
    geometryTransform.position.x +
    geometryTransform.transformOffset.x -
    geometryWidth / 2,
  y:
    geometryTransform.position.y +
    geometryTransform.transformOffset.y -
    geometryHeight / 2,
};
const radians = (geometryTransform.rotation * Math.PI) / 180;
const cos = Math.cos(radians);
const sin = Math.sin(radians);
const expectedPoints = [
  { x: 0, y: 0 },
  { x: geometryWidth, y: 0 },
  { x: geometryWidth, y: geometryHeight },
  { x: 0, y: geometryHeight },
].map((point) => {
  const x =
    (point.x - geometryTransform.anchor.x) *
    (geometryTransform.scale.x / 100);
  const y =
    (point.y - geometryTransform.anchor.y) *
    (geometryTransform.scale.y / 100);
  return {
    x:
      geometryOrigin.x +
      geometryTransform.anchor.x +
      x * cos -
      y * sin,
    y:
      geometryOrigin.y +
      geometryTransform.anchor.y +
      x * sin +
      y * cos,
  };
});
const expectedBounds = {
  left: Math.min(...expectedPoints.map((point) => point.x)),
  top: Math.min(...expectedPoints.map((point) => point.y)),
  right: Math.max(...expectedPoints.map((point) => point.x)),
  bottom: Math.max(...expectedPoints.map((point) => point.y)),
};
const actualBounds = getRenderTransformBounds(
  geometryWidth,
  geometryHeight,
  geometryTransform
);
closeTo(actualBounds.left, expectedBounds.left);
closeTo(actualBounds.top, expectedBounds.top);
closeTo(actualBounds.right, expectedBounds.right);
closeTo(actualBounds.bottom, expectedBounds.bottom);

function createContext(log: string[]): Canvas2DRenderContext {
  let alpha = 1;
  return {
    clearRect: (...values: number[]) => log.push(`clear:${values.join(",")}`),
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

function node(position: { x: number; y: number }): PreviewNode {
  return {
    id: "fractional-layer",
    kind: "layer",
    sourceId: "fractional-layer",
    renderItemId: "fractional-render-item",
    parentId: null,
    children: [],
    transform: {
      position,
      transformOffset: { x: 0.35, y: -0.2 },
      anchor: { x: 4, y: 18 },
      scale: { x: 100, y: 100 },
      rotation: 0,
    },
    opacity: 100,
    visible: true,
    order: 0,
    localFrame: 0,
    globalFrame: 0,
    logicalSize: { width: 37, height: 23 },
    drawableId: "fractional-layer",
    layerId: "fractional-layer",
  };
}

function scene(layer: PreviewNode, globalFrame: number): PreviewScene {
  return {
    compositionId: "fractional-scene",
    globalFrame,
    logicalSize: { width: 400, height: 200 },
    nodes: [layer],
  };
}

const renderItem: RenderItem = {
  id: "fractional-render-item",
  name: "fractional",
  kind: "layer",
  visible: true,
  sourceId: "fractional-layer",
  drawables: [
    {
      id: "fractional-layer",
      left: 0,
      top: 0,
      visible: true,
      canvas: { width: 37, height: 23 } as HTMLCanvasElement,
    },
  ],
};
const previousNode = node({ x: 70.3, y: 60.7 });
const nextNode = node({ x: 73.1, y: 62.4 });
const previousBounds = getRenderTransformBounds(
  previousNode.logicalSize.width,
  previousNode.logicalSize.height,
  previousNode.transform
);
const nextBounds = getRenderTransformBounds(
  nextNode.logicalSize.width,
  nextNode.logicalSize.height,
  nextNode.transform
);
const dirtyBounds = {
  left: Math.min(previousBounds.left, nextBounds.left) - 2,
  top: Math.min(previousBounds.top, nextBounds.top) - 2,
  right: Math.max(previousBounds.right, nextBounds.right) + 2,
  bottom: Math.max(previousBounds.bottom, nextBounds.bottom) + 2,
};

for (const pixelScale of [0.25, 0.5, 0.75]) {
  const log: string[] = [];
  const context = createContext(log);
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  const drawState: PreviewCanvasDrawState = {
    previousScene: null,
    previousNodeBoundsById: new Map(),
    previousPixelScale: null,
  };

  renderPreviewSceneToCanvas({
    canvas,
    previewScene: scene(previousNode, 0),
    renderItems: [renderItem],
    pixelScale,
    drawState,
  });
  renderPreviewSceneToCanvas({
    canvas,
    previewScene: scene(nextNode, 1),
    renderItems: [renderItem],
    pixelScale,
    drawState,
  });

  const left = Math.floor(dirtyBounds.left * pixelScale);
  const top = Math.floor(dirtyBounds.top * pixelScale);
  const right = Math.ceil(dirtyBounds.right * pixelScale);
  const bottom = Math.ceil(dirtyBounds.bottom * pixelScale);
  assert.equal(
    log.filter((entry) => entry.startsWith("clear:")).at(-1),
    `clear:${left},${top},${right - left},${bottom - top}`
  );
}

console.log("preview dirty geometry verification passed");
