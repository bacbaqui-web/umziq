import assert from "node:assert/strict";
import type { Composition, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import {
  buildEvaluatedScene,
  buildRenderFrame,
  buildRenderFrameFromEvaluatedScene,
  getActiveRenderItems,
  getActiveTimelineItems,
  renderAccurateRenderer,
  renderFastPreviewRenderer,
  renderWithRendererMode,
  updatePreviewSceneFromPlaybackFrame,
  updatePreviewSceneNodeTransform,
  type RenderCommand,
} from "@/engines/playback-render";
import {
  createReusableRenderSurfaceFactory,
  drawRenderCommandsToContext,
  renderFrameToCanvas,
  type Canvas2DRenderContext,
} from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import {
  drawPreviewSceneToContext,
  renderPreviewSceneToCanvas,
} from "@/engines/playback-render/adapters/canvas2dPreviewSceneAdapter";
import { createDefaultModifier, evaluateLayerPosition } from "@/engines/animation";

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
    modifiers: [],
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
    modifiers: [],
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
const layerScene = buildEvaluatedScene({
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
assert.equal(layerScene.nodes.length, 2);
assert.equal(layerScene.nodes[1]?.type, "drawable");
if (layerScene.nodes[1]?.type !== "drawable") {
  throw new Error("evaluated drawable expected");
}
assert.deepEqual(layerScene.nodes[1].transform.position, { x: 30, y: 40 });
assert.equal("source" in layerScene.nodes[1], false);
assert.equal("image" in layerScene.nodes[1], false);
assert.equal("canvas" in layerScene.nodes[1], false);
assert.equal(JSON.stringify(layerScene).includes("HTMLCanvasElement"), false);
const frameFromScene = buildRenderFrameFromEvaluatedScene({
  evaluatedScene: layerScene,
  renderItems,
});
const accurateRendererResult = renderAccurateRenderer({
  evaluatedScene: layerScene,
  renderItems,
});
const accurateModeResult = renderWithRendererMode({
  mode: "full-render",
  evaluatedScene: layerScene,
  renderItems,
});
const fastPreviewModeResult = renderWithRendererMode({
  mode: "fast-render",
  evaluatedScene: layerScene,
  renderItems,
});
const fastPreviewRendererResult = renderFastPreviewRenderer(layerScene);
assert.equal(accurateRendererResult.mode, "full-render");
assert.equal(accurateModeResult.mode, "full-render");
assert.equal(fastPreviewModeResult.mode, "fast-render");
assert.equal(fastPreviewRendererResult.mode, "fast-render");
assert.deepEqual(
  frameFromScene.commands.map((command) => command.sourceId),
  layerFrame.commands.map((command) => command.sourceId)
);
assert.deepEqual(accurateRendererResult.frame, frameFromScene);
assert.deepEqual(accurateModeResult.frame, frameFromScene);
assert.deepEqual(
  fastPreviewModeResult.previewScene,
  fastPreviewRendererResult.previewScene
);
assert.equal(fastPreviewRendererResult.previewScene.compositionId, "root");
assert.equal(fastPreviewRendererResult.previewScene.globalFrame, 4);
assert.deepEqual(fastPreviewRendererResult.previewScene.logicalSize, {
  width: 200,
  height: 100,
});
assert.deepEqual(
  fastPreviewRendererResult.previewScene.nodes.map((node) => node.kind),
  ["layer", "layer"]
);
assert.deepEqual(
  fastPreviewRendererResult.previewScene.nodes.map((node) => node.parentId),
  [null, null]
);
const previewLayerNode = fastPreviewRendererResult.previewScene.nodes[1];
assert.equal(previewLayerNode?.kind, "layer");
if (previewLayerNode?.kind !== "layer") {
  throw new Error("layer preview node expected");
}
assert.equal(previewLayerNode.id, "layer:render-a:drawable-a");
assert.equal(previewLayerNode.drawableId, "drawable-a");
assert.equal(previewLayerNode.layerId, "layer-a");
assert.deepEqual(previewLayerNode.children, []);
assert.deepEqual(previewLayerNode.transform.position, { x: 30, y: 40 });
assert.deepEqual(previewLayerNode.logicalSize, { width: 20, height: 40 });
assert.equal(previewLayerNode.opacity, 75);
const forbiddenPreviewKeys = new Set([
  "canvas",
  "image",
  "source",
  "originalSource",
  "resolveDrawableSource",
  "command",
  "commands",
  "frame",
]);
function assertPreviewSceneHasNoCanvasBoundary(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertPreviewSceneHasNoCanvasBoundary);
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, child]) => {
    assert.equal(
      forbiddenPreviewKeys.has(key),
      false,
      `Preview Scene must not include ${key}`
    );
    assertPreviewSceneHasNoCanvasBoundary(child);
  });
}
assertPreviewSceneHasNoCanvasBoundary(fastPreviewRendererResult.previewScene);
const sceneDrivenCommand = buildRenderFrameFromEvaluatedScene({
  evaluatedScene: {
    ...layerScene,
    nodes: layerScene.nodes.map((node) =>
      node.type === "drawable" && node.sourceId === "layer-a"
        ? {
            ...node,
            transform: {
              ...node.transform,
              position: { x: 999, y: 888 },
            },
          }
        : node
    ),
  },
  renderItems,
}).commands.find((command) => command.sourceId === "layer-a");
assert.equal(sceneDrivenCommand?.type, "drawable");
if (sceneDrivenCommand?.type !== "drawable") {
  throw new Error("scene-driven drawable expected");
}
assert.deepEqual(sceneDrivenCommand.transform.position, { x: 999, y: 888 });

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
assert.deepEqual(animatedLayerCommand.logicalSize, { width: 20, height: 40 });
assert.equal(animatedLayerCommand.source.kind, "original");
assert.equal(animatedLayerCommand.source.image, canvasA);
assert.deepEqual(animatedLayerCommand.source.pixelSize, { width: 20, height: 40 });
assert.equal(JSON.stringify({ layerA, layerB, timelineItems, renderItems }), sourceSnapshot);

const isolatedLayerPreviewScene = {
  ...fastPreviewRendererResult.previewScene,
  nodes: [previewLayerNode],
};
const layerPreviewLog: string[] = [];
drawPreviewSceneToContext(
  createFakeContext(layerPreviewLog),
  isolatedLayerPreviewScene,
  renderItems
);
assert.deepEqual(layerPreviewLog, [
  "save",
  "alpha:0.75",
  "translate:25,17",
  "translate:10,20",
  `rotate:${Math.PI / 6}`,
  "scale:1.2,0.8",
  "translate:-10,-20",
  "drawImage",
  "restore",
]);

const layerPreviewCanvasLog: string[] = [];
const layerPreviewOutputCanvas = {
  width: 0,
  height: 0,
  getContext: () => createFakeContext(layerPreviewCanvasLog),
} as unknown as HTMLCanvasElement;
renderPreviewSceneToCanvas({
  canvas: layerPreviewOutputCanvas,
  previewScene: isolatedLayerPreviewScene,
  renderItems,
  pixelScale: 0.5,
});
assert.equal(layerPreviewOutputCanvas.width, 100);
assert.equal(layerPreviewOutputCanvas.height, 50);
assert.deepEqual(layerPreviewCanvasLog.slice(0, 3), [
  "setTransform:1,0,0,1,0,0",
  "clear:0,0,100,50",
  "setTransform:0.5,0,0,0.5,0,0",
]);

const movedPreviewScene = updatePreviewSceneNodeTransform(
  fastPreviewRendererResult.previewScene,
  { kind: "layer", id: "layer-a" },
  {
    position: { x: 123, y: 234 },
    scale: { x: 130, y: 140 },
    rotation: 45,
    opacity: 65,
  }
);
assert.notEqual(movedPreviewScene, fastPreviewRendererResult.previewScene);
assert.equal(
  movedPreviewScene.nodes[0],
  fastPreviewRendererResult.previewScene.nodes[0]
);
const movedPreviewLayerNode = movedPreviewScene.nodes[1];
assert.equal(movedPreviewLayerNode?.kind, "layer");
if (movedPreviewLayerNode?.kind !== "layer") {
  throw new Error("moved preview layer node expected");
}
assert.deepEqual(movedPreviewLayerNode.transform.position, { x: 123, y: 234 });
assert.deepEqual(movedPreviewLayerNode.transform.scale, { x: 130, y: 140 });
assert.equal(movedPreviewLayerNode.transform.rotation, 45);
assert.equal(movedPreviewLayerNode.opacity, 65);
assert.deepEqual(previewLayerNode.transform.position, { x: 30, y: 40 });
assert.equal(
  updatePreviewSceneNodeTransform(
    fastPreviewRendererResult.previewScene,
    { kind: "layer", id: "missing" },
    { position: { x: 1, y: 2 } }
  ),
  fastPreviewRendererResult.previewScene
);
const playbackPreviewScene = updatePreviewSceneFromPlaybackFrame(
  fastPreviewRendererResult.previewScene,
  {
    ...fastPreviewRendererResult.previewScene,
    globalFrame: 5,
    nodes: fastPreviewRendererResult.previewScene.nodes.map((node) =>
      node.kind === "layer" && node.layerId === "layer-a"
        ? {
            ...node,
            globalFrame: 5,
            localFrame: 3,
            transform: {
              ...node.transform,
              position: { x: 44, y: 55 },
            },
          }
        : node
    ),
  }
);
assert.notEqual(playbackPreviewScene, fastPreviewRendererResult.previewScene);
assert.equal(playbackPreviewScene?.globalFrame, 5);
assert.equal(
  playbackPreviewScene?.nodes[0],
  fastPreviewRendererResult.previewScene.nodes[0]
);
const playbackMovedPreviewNode = playbackPreviewScene?.nodes[1];
assert.equal(playbackMovedPreviewNode?.kind, "layer");
if (playbackMovedPreviewNode?.kind !== "layer") {
  throw new Error("playback moved preview node expected");
}
assert.equal(playbackMovedPreviewNode.localFrame, 3);
assert.deepEqual(playbackMovedPreviewNode.transform.position, { x: 44, y: 55 });
assert.equal(
  updatePreviewSceneFromPlaybackFrame(
    fastPreviewRendererResult.previewScene,
    fastPreviewRendererResult.previewScene
  ),
  fastPreviewRendererResult.previewScene
);

const previewImage = { width: 5, height: 10 } as HTMLCanvasElement;
const resolverRequests: string[] = [];
const previewFrame = buildRenderFrame({
  compositionId: "root",
  width: 200,
  height: 100,
  renderItems,
  timelineItems,
  layerMap,
  compositionMap: new Map(),
  metaByCompId: {},
  globalFrame: 4,
  resolveDrawableSource: (request) => {
    resolverRequests.push(request.sourceId);
    if (request.sourceId !== "layer-a") return null;
    assert.equal(request.originalSource.image, canvasA);
    assert.deepEqual(request.logicalSize, { width: 20, height: 40 });
    return {
      kind: "preview",
      image: previewImage,
      pixelSize: { width: 5, height: 10 },
    };
  },
});
const previewLayerCommand = previewFrame.commands.find(
  (command) => command.sourceId === "layer-a"
);
assert.equal(previewLayerCommand?.type, "drawable");
if (previewLayerCommand?.type !== "drawable") throw new Error("preview drawable expected");
assert.deepEqual(resolverRequests, ["layer-b", "layer-a"]);
assert.equal(previewLayerCommand.source.kind, "preview");
assert.equal(previewLayerCommand.source.image, previewImage);
assert.deepEqual(previewLayerCommand.source.pixelSize, { width: 5, height: 10 });
assert.deepEqual(previewLayerCommand.logicalSize, { width: 20, height: 40 });
assert.deepEqual(previewLayerCommand.transform, animatedLayerCommand.transform);
assert.equal(JSON.stringify({ layerA, layerB, timelineItems, renderItems }), sourceSnapshot);

const previewDrawCalls: unknown[][] = [];
const previewContext = {
  ...createFakeContext([]),
  drawImage: (...values: unknown[]) => previewDrawCalls.push(values),
} as Canvas2DRenderContext;
drawRenderCommandsToContext(previewContext, [previewLayerCommand], () => null);
assert.deepEqual(previewDrawCalls, [[previewImage, 0, 0, 20, 40]]);

const wiggleLayer = {
  ...layerA,
  modifiers: [{ ...createDefaultModifier("wiggle", layerA.id), frequency: 3, amount: 12 }],
};
const wiggleFrame = buildRenderFrame({
  compositionId: "root",
  width: 200,
  height: 100,
  renderItems,
  timelineItems,
  layerMap: new Map([[wiggleLayer.id, wiggleLayer], [layerB.id, layerB]]),
  compositionMap: new Map(),
  metaByCompId: {},
  globalFrame: 4,
  frameRate: 30,
});
const wiggleCommand = wiggleFrame.commands.find(
  (command) => command.sourceId === wiggleLayer.id
);
assert.equal(wiggleCommand?.type, "drawable");
if (wiggleCommand?.type !== "drawable") throw new Error("wiggle drawable expected");
assert.deepEqual(
  wiggleCommand.transform.position,
  evaluateLayerPosition(wiggleLayer, wiggleCommand.localFrame, 30)
);
assert.notDeepEqual(wiggleCommand.transform.position, { x: 30, y: 40 });

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
const nestedScene = buildEvaluatedScene({
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
const nestedPreview = renderFastPreviewRenderer(nestedScene).previewScene;
assert.equal(nestedPreview.nodes.length, 1);
const compositionPreviewNode = nestedPreview.nodes[0];
assert.equal(compositionPreviewNode?.kind, "composition");
if (compositionPreviewNode?.kind !== "composition") {
  throw new Error("composition preview node expected");
}
assert.equal(compositionPreviewNode.id, "composition:render-nested:nested");
assert.equal(compositionPreviewNode.parentId, null);
assert.equal(compositionPreviewNode.targetCompId, "nested");
assert.equal(compositionPreviewNode.localFrame, 3);
assert.equal(compositionPreviewNode.globalFrame, 8);
assert.deepEqual(compositionPreviewNode.logicalSize, { width: 160, height: 120 });
assert.deepEqual(compositionPreviewNode.transform.position, { x: 110, y: 90 });
assert.equal(compositionPreviewNode.opacity, 50);
assert.deepEqual(
  compositionPreviewNode.children.map((child) => child.parentId),
  ["composition:render-nested:nested", "composition:render-nested:nested"]
);
assert.deepEqual(
  compositionPreviewNode.children.map((child) => child.kind),
  ["layer", "layer"]
);
assertPreviewSceneHasNoCanvasBoundary(nestedPreview);
const compositionPreviewLog: string[] = [];
const compositionPreviewSurfaceLogs: string[][] = [];
drawPreviewSceneToContext(
  createFakeContext(compositionPreviewLog),
  nestedPreview,
  [nestedItem],
  undefined,
  (width, height) => {
    const log: string[] = [`preview-surface:${width},${height}`];
    compositionPreviewSurfaceLogs.push(log);
    return {
      canvas: { width, height } as HTMLCanvasElement,
      context: createFakeContext(log),
    };
  }
);
assert.deepEqual(compositionPreviewLog.slice(0, 8), [
  "save",
  "alpha:0.5",
  "translate:32,34",
  "translate:40,30",
  `rotate:${Math.PI / 12}`,
  "scale:0.9,1.1",
  "translate:-40,-30",
  "drawImage",
]);
assert.equal(compositionPreviewLog.at(-1), "restore");
assert.equal(compositionPreviewSurfaceLogs[0]?.[0], "preview-surface:160,120");
assert.equal(compositionPreviewSurfaceLogs[0]?.includes("alpha:0.75"), true);
assert.equal(compositionPreviewSurfaceLogs[0]?.includes("drawImage"), true);
const movedCompositionPreview = updatePreviewSceneNodeTransform(
  nestedPreview,
  { kind: "composition", id: "nested" },
  {
    position: { x: 140, y: 150 },
    opacity: 25,
  }
);
const movedCompositionPreviewNode = movedCompositionPreview.nodes[0];
assert.equal(movedCompositionPreviewNode?.kind, "composition");
if (movedCompositionPreviewNode?.kind !== "composition") {
  throw new Error("moved composition preview node expected");
}
assert.deepEqual(movedCompositionPreviewNode.transform.position, {
  x: 140,
  y: 150,
});
assert.equal(movedCompositionPreviewNode.opacity, 25);
assert.equal(
  movedCompositionPreviewNode.children[0],
  compositionPreviewNode.children[0]
);
const movedNestedLayerPreview = updatePreviewSceneNodeTransform(
  nestedPreview,
  { kind: "layer", id: "layer-a" },
  { position: { x: 77, y: 88 } }
);
const movedNestedComposition = movedNestedLayerPreview.nodes[0];
assert.equal(movedNestedComposition?.kind, "composition");
if (movedNestedComposition?.kind !== "composition") {
  throw new Error("moved nested composition expected");
}
assert.notEqual(movedNestedComposition, compositionPreviewNode);
assert.equal(
  movedNestedComposition.children[0],
  compositionPreviewNode.children[0]
);
assert.notEqual(
  movedNestedComposition.children[1],
  compositionPreviewNode.children[1]
);
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
assert.deepEqual(canvasLog.slice(0, 3), [
  "setTransform:1,0,0,1,0,0",
  "clear:0,0,200,100",
  "setTransform:1,0,0,1,0,0",
]);

let createdSurfaceCount = 0;
const reusableSurfaceFactory = createReusableRenderSurfaceFactory(() => {
  createdSurfaceCount += 1;
  return {
    width: 0,
    height: 0,
    getContext: () => createFakeContext([]),
  } as unknown as HTMLCanvasElement;
});
const scaledOutputCanvas = {
  width: 0,
  height: 0,
  getContext: () => createFakeContext([]),
} as unknown as HTMLCanvasElement;
for (let frameIndex = 0; frameIndex < 2; frameIndex += 1) {
  reusableSurfaceFactory.beginFrame();
  renderFrameToCanvas(
    scaledOutputCanvas,
    nestedFrame,
    reusableSurfaceFactory.createSurface,
    0.25
  );
  reusableSurfaceFactory.endFrame();
}
assert.equal(scaledOutputCanvas.width, 75);
assert.equal(scaledOutputCanvas.height, 50);
assert.equal(createdSurfaceCount, 1);
reusableSurfaceFactory.dispose();

console.log("Render helper verification passed");
