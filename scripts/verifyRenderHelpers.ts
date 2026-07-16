import assert from "node:assert/strict";
import type { Composition, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import {
  buildRenderFrame,
  getActiveRenderItems,
  getActiveTimelineItems,
  type RenderCommand,
} from "@/engines/playback-render";
import {
  drawRenderCommandsToContext,
  renderFrameToCanvas,
  type Canvas2DRenderContext,
} from "@/engines/playback-render/adapters/canvas2dRenderAdapter";

const disabledProperties = {
  position: false,
  scale: false,
  rotation: false,
  opacity: false,
};

function createLayer(id: string): Layer {
  return {
    id,
    name: id,
    visible: true,
    position: { x: 50, y: 40 },
    transformOffset: { x: 5, y: -3 },
    anchor: { x: 10, y: 20 },
    positionKeyframes: [],
    scale: { x: 120, y: 80 },
    scaleKeyframes: [],
    scaleLinked: false,
    rotation: 30,
    rotationKeyframes: [],
    opacity: 75,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
  };
}

function createComposition(id: string): Composition {
  return {
    id,
    name: id,
    type: "sub",
    layers: [],
    children: [],
    position: { x: 100, y: 80 },
    positionKeyframes: [],
    transformOffset: { x: 2, y: 4 },
    anchor: { x: 40, y: 30 },
    scale: { x: 90, y: 110 },
    scaleKeyframes: [],
    scaleLinked: false,
    rotation: 15,
    rotationKeyframes: [],
    opacity: 50,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
  };
}

function createTimelineItem(
  id: string,
  sourceId: string,
  kind: "layer" | "subComp",
  startFrame: number,
  durationFrames: number
): TimelineItem {
  return {
    id,
    name: id,
    kind,
    visible: true,
    compId: "root",
    sourceId,
    targetCompId: kind === "subComp" ? sourceId : undefined,
    startFrame,
    durationFrames,
  };
}

const canvasA = { width: 20, height: 40 } as HTMLCanvasElement;
const canvasB = { width: 10, height: 10 } as HTMLCanvasElement;
const renderItems: RenderItem[] = [
  {
    id: "render-a",
    name: "A",
    kind: "layer",
    visible: true,
    sourceId: "layer-a",
    drawables: [
      {
        id: "drawable-a",
        left: 4,
        top: 6,
        visible: true,
        sourceLayerId: "layer-a",
        canvas: canvasA,
      },
    ],
  },
  {
    id: "render-b",
    name: "B",
    kind: "layer",
    visible: true,
    sourceId: "layer-b",
    drawables: [
      {
        id: "drawable-b",
        left: 0,
        top: 0,
        visible: true,
        sourceLayerId: "layer-b",
        canvas: canvasB,
      },
    ],
  },
];
const timelineItems = [
  createTimelineItem("timeline-a", "layer-a", "layer", 2, 3),
  createTimelineItem("timeline-b", "layer-b", "layer", 0, 10),
];

assert.deepEqual(getActiveTimelineItems(timelineItems, 1).map((item) => item.id), [
  "timeline-b",
]);
assert.deepEqual(getActiveTimelineItems(timelineItems, 2).map((item) => item.id), [
  "timeline-a",
  "timeline-b",
]);
assert.deepEqual(getActiveTimelineItems(timelineItems, 4).map((item) => item.id), [
  "timeline-a",
  "timeline-b",
]);
assert.deepEqual(getActiveTimelineItems(timelineItems, 5).map((item) => item.id), [
  "timeline-b",
]);
assert.deepEqual(getActiveRenderItems(renderItems, timelineItems, 2).map((item) => item.id), [
  "render-a",
  "render-b",
]);

const layerA = createLayer("layer-a");
layerA.enabledProperties.position = true;
layerA.positionKeyframes = [
  { frame: 0, value: { x: 10, y: 20 } },
  { frame: 2, value: { x: 30, y: 40 } },
];
const layerB = createLayer("layer-b");
const layerMap = new Map([
  [layerA.id, layerA],
  [layerB.id, layerB],
]);
const sourceSnapshot = JSON.stringify({ layerA, layerB, timelineItems, renderItems });
const layerFrame = buildRenderFrame({
  compositionId: "root",
  width: 200,
  height: 100,
  renderItems,
  timelineItems,
  layerMap,
  compositionMap: new Map(),
  metaByCompId: {},
  globalFrame: 4,
});

assert.deepEqual(layerFrame.commands.map((command) => command.sourceId), [
  "layer-b",
  "layer-a",
]);
const animatedLayerCommand = layerFrame.commands[1];
assert.equal(animatedLayerCommand?.type, "drawable");
if (animatedLayerCommand?.type !== "drawable") throw new Error("drawable expected");
assert.equal(animatedLayerCommand.localFrame, 2);
assert.deepEqual(animatedLayerCommand.transform.position, { x: 30, y: 40 });
assert.deepEqual(animatedLayerCommand.transform.origin, { x: 25, y: 17 });
assert.deepEqual(animatedLayerCommand.transform.anchor, { x: 10, y: 20 });
assert.deepEqual(animatedLayerCommand.transform.scale, { x: 120, y: 80 });
assert.equal(animatedLayerCommand.transform.rotation, 30);
assert.equal(animatedLayerCommand.opacity, 75);
assert.equal(animatedLayerCommand.canvas, canvasA);
assert.equal(JSON.stringify({ layerA, layerB, timelineItems, renderItems }), sourceSnapshot);

const nestedComposition = createComposition("nested");
nestedComposition.enabledProperties.position = true;
nestedComposition.enabledProperties.opacity = true;
nestedComposition.positionKeyframes = [
  { frame: 0, value: { x: 80, y: 60 } },
  { frame: 3, value: { x: 110, y: 90 } },
];
nestedComposition.opacityKeyframes = [
  { frame: 0, value: 20 },
  { frame: 3, value: 50 },
];
const nestedItem: RenderItem = {
  id: "render-nested",
  name: "Nested",
  kind: "subComp",
  visible: true,
  sourceId: "nested",
  targetCompId: "nested",
  drawables: renderItems.flatMap((item) => item.drawables),
};
const nestedTimeline = [
  createTimelineItem("timeline-nested", "nested", "subComp", 5, 5),
];
const nestedFrame = buildRenderFrame({
  compositionId: "root",
  width: 300,
  height: 200,
  renderItems: [nestedItem],
  timelineItems: nestedTimeline,
  layerMap,
  compositionMap: new Map([[nestedComposition.id, nestedComposition]]),
  metaByCompId: {
    nested: {
      width: 160,
      height: 120,
      layerCount: 2,
      sourceFileName: "nested.psd",
      frameRate: 30,
      durationFrames: 10,
    },
  },
  globalFrame: 8,
});
assert.equal(nestedFrame.commands.length, 1);
const compositionCommand = nestedFrame.commands[0];
assert.equal(compositionCommand?.type, "composition");
if (compositionCommand?.type !== "composition") {
  throw new Error("composition expected");
}
assert.equal(compositionCommand.localFrame, 3);
assert.deepEqual(compositionCommand.transform.position, { x: 110, y: 90 });
assert.equal(compositionCommand.opacity, 50);
assert.deepEqual(compositionCommand.children.map((child) => child.sourceId), [
  "layer-b",
  "layer-a",
]);
assert.equal(
  buildRenderFrame({
    compositionId: "root",
    width: 300,
    height: 200,
    renderItems: [nestedItem],
    timelineItems: nestedTimeline,
    layerMap,
    compositionMap: new Map([[nestedComposition.id, nestedComposition]]),
    metaByCompId: {},
    globalFrame: 10,
  }).commands.length,
  0
);

function createFakeContext(log: string[]): Canvas2DRenderContext {
  let alpha = 1;
  return {
    clearRect: (...values: number[]) => log.push(`clear:${values.join(",")}`),
    save: () => log.push("save"),
    restore: () => log.push("restore"),
    translate: (x: number, y: number) => log.push(`translate:${x},${y}`),
    rotate: (value: number) => log.push(`rotate:${value}`),
    scale: (x: number, y: number) => log.push(`scale:${x},${y}`),
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

const rootLog: string[] = [];
const surfaceLogs: string[][] = [];
const rootContext = createFakeContext(rootLog);
drawRenderCommandsToContext(rootContext, nestedFrame.commands, (width, height) => {
  const log: string[] = [`surface:${width},${height}`];
  surfaceLogs.push(log);
  return {
    canvas: { width, height } as HTMLCanvasElement,
    context: createFakeContext(log),
  };
});
assert.deepEqual(rootLog.slice(0, 8), [
  "save",
  "alpha:0.5",
  "translate:32,34",
  "translate:40,30",
  `rotate:${Math.PI / 12}`,
  "scale:0.9,1.1",
  "translate:-40,-30",
  "drawImage",
]);
assert.equal(rootLog.at(-1), "restore");
assert.equal(surfaceLogs[0]?.[0], "surface:160,120");
assert.equal(surfaceLogs[0]?.includes("alpha:0.75"), true);

const twoLevelCommand: RenderCommand = {
  ...compositionCommand,
  children: [{ ...compositionCommand, renderItemId: "nested-level-2" }],
};
const twoLevelSurfaces: string[] = [];
drawRenderCommandsToContext(createFakeContext([]), [twoLevelCommand], (width, height) => {
  twoLevelSurfaces.push(`${width}x${height}`);
  return {
    canvas: { width, height } as HTMLCanvasElement,
    context: createFakeContext([]),
  };
});
assert.deepEqual(twoLevelSurfaces, ["160x120", "160x120"]);

const canvasLog: string[] = [];
const outputCanvas = {
  width: 0,
  height: 0,
  getContext: () => createFakeContext(canvasLog),
} as unknown as HTMLCanvasElement;
renderFrameToCanvas(outputCanvas, layerFrame, () => null);
assert.equal(outputCanvas.width, 200);
assert.equal(outputCanvas.height, 100);
assert.equal(canvasLog[0], "clear:0,0,200,100");

console.log("Render helper verification passed");
