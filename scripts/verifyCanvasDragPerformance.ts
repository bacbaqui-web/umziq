import assert from "node:assert/strict";
import type { Composition, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import { applyPositionToCompositions } from "@/engines/animation/actions/animationProjectMutations";
import {
  buildEvaluatedScene,
  buildRenderFrame,
  buildPreviewSceneFromEvaluatedScene,
  createReusableRenderSurfaceFactory,
  renderFrameToCanvas,
  renderPreviewSceneToCanvas,
  updatePreviewSceneNodeTransform,
  type Canvas2DRenderContext,
} from "@/engines/playback-render";
import { buildPreviewCacheGeneration } from "@/engines/canvas/controllers/buildPreviewCacheGeneration";
import { createCanvasPointerFrameScheduler } from "@/engines/canvas/helpers/canvasPointerFrameHelpers";
import {
  collectProjectPreviewBuildSources,
  getPreviewBuildSourceSetKey,
} from "@/engines/canvas/helpers/previewBuildSourceHelpers";
import { createPreviewDrawableSourceResolver } from "@/engines/canvas/helpers/previewResolverHelpers";
import { applyPreviewNodeCacheFromScenes } from "@/engines/canvas/helpers/nodeCacheHelpers";
import { PREVIEW_QUALITY_SCALE } from "@/engines/canvas/constants/previewQualityConstants";
import type { PreviewBitmapFactoryPort } from "@/engines/canvas/models/previewBuildModel";
import { createPreviewCacheRuntime } from "@/engines/canvas/state/previewCacheRuntimeStore";
import { createPreviewDraftBaseSceneResolver } from "@/engines/canvas/helpers/previewDraftBaseSceneHelpers";
import {
  resolvePreviewCompositionCacheForRender,
} from "@/engines/canvas/controllers/useCanvasRenderController";
import type {
  CompositionPreviewCacheRuntime,
} from "@/engines/canvas/models/compositionCacheModel";

const disabledProperties = {
  position: false,
  scale: false,
  rotation: false,
  opacity: false,
};

function makeLayer(id: string, width: number, height: number): Layer {
  return {
    id,
    name: id,
    visible: true,
    sourceIdentity: {
      sourceFileName: "drag-performance.psd",
      sourceKey: `layer-id:${id}`,
    },
    sourceFingerprint: `fingerprint:${id}`,
    position: { x: width / 2, y: height / 2 },
    transformOffset: { x: 0, y: 0 },
    anchor: { x: width / 2, y: height / 2 },
    positionKeyframes: [],
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: false,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
    modifiers: [],
  };
}

function makeComposition(layers: Layer[]): Composition {
  return {
    id: "root",
    name: "Root",
    type: "master",
    layers,
    children: [],
    position: { x: 200, y: 150 },
    positionKeyframes: [],
    transformOffset: { x: 0, y: 0 },
    anchor: { x: 200, y: 150 },
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: false,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
    modifiers: [],
  };
}

function makeTimelineItem(layer: Layer): TimelineItem {
  return {
    id: `timeline:${layer.id}`,
    name: layer.name,
    kind: "layer",
    visible: true,
    compId: "root",
    sourceId: layer.id,
    startFrame: 0,
    durationFrames: 300,
  };
}

const sourceCanvases = new Map<string, HTMLCanvasElement>();
const movingLayer = makeLayer("moving", 320, 240);
const stationaryLayer = makeLayer("stationary", 640, 480);
const composition = makeComposition([movingLayer, stationaryLayer]);
const renderItems: RenderItem[] = [movingLayer, stationaryLayer].map((layer) => {
  const canvas = {
    width: layer.anchor.x * 2,
    height: layer.anchor.y * 2,
  } as HTMLCanvasElement;
  sourceCanvases.set(layer.id, canvas);
  return {
    id: `render:${layer.id}`,
    name: layer.name,
    kind: "layer",
    visible: true,
    sourceId: layer.id,
    drawables: [
      {
        id: `drawable:${layer.id}`,
        left: 0,
        top: 0,
        visible: true,
        sourceLayerId: layer.id,
        canvas,
      },
    ],
  };
});
const renderItemsByCompId = { root: renderItems };
const timelineItems = [movingLayer, stationaryLayer].map(makeTimelineItem);
const sourcesBefore = collectProjectPreviewBuildSources(
  renderItemsByCompId,
  [composition]
);
const sourceSetKeyBefore = getPreviewBuildSourceSetKey(sourcesBefore);
const movedCompositions = applyPositionToCompositions(
  [composition],
  { kind: "layer", id: movingLayer.id },
  { x: 180, y: 140 },
  0,
  false
);
const sourcesAfter = collectProjectPreviewBuildSources(
  renderItemsByCompId,
  movedCompositions
);
assert.equal(getPreviewBuildSourceSetKey(sourcesAfter), sourceSetKeyBefore);

let factoryCalls = 0;
let disposeCalls = 0;
const quality = "low" as const;
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
          disposeCalls += 1;
        },
      },
    },
  };
};
const cache = createPreviewCacheRuntime(Number.POSITIVE_INFINITY);
const build = await buildPreviewCacheGeneration({
  sources: sourcesBefore,
  quality,
  cache,
  factory,
});
assert.equal(build.status, "completed");
assert.equal(factoryCalls, 2);
const generationBeforeDrag = cache.getGeneration();
const cacheBeforeDrag = cache.getSnapshot();
const resolver = createPreviewDrawableSourceResolver(
  cache,
  build.resourceKeyBySourceId
);

function makeFrame(compositions: Composition[], withResolver = true) {
  const root = compositions[0]!;
  return buildRenderFrame({
    compositionId: "root",
    width: 1920,
    height: 1080,
    renderItems,
    timelineItems,
    layerMap: new Map(root.layers.map((layer) => [layer.id, layer])),
    compositionMap: new Map(),
    metaByCompId: {},
    globalFrame: 0,
    resolveDrawableSource: withResolver ? resolver : undefined,
  });
}

const frameBefore = makeFrame([composition]);
const frameAfter = makeFrame(movedCompositions);
assert.equal(frameBefore.commands.length, 2);
assert.equal(frameAfter.commands.length, 2);
assert.deepEqual(
  frameAfter.commands.map((command) => command.sourceId).sort(),
  [movingLayer.id, stationaryLayer.id].sort()
);
frameAfter.commands.forEach((command) => {
  assert.equal(command.type, "drawable");
  if (command.type !== "drawable") return;
  assert.equal(command.source.kind, "preview");
  assert.deepEqual(command.source.pixelSize, {
    width: Math.ceil(command.logicalSize.width * PREVIEW_QUALITY_SCALE.low),
    height: Math.ceil(command.logicalSize.height * PREVIEW_QUALITY_SCALE.low),
  });
});
assert.equal(cache.getGeneration(), generationBeforeDrag);
assert.equal(factoryCalls, 2);
assert.equal(disposeCalls, 0);
assert.equal(cache.getSnapshot().trackedBytes, cacheBeforeDrag.trackedBytes);
assert.equal(cache.getSnapshot().size, cacheBeforeDrag.size);

const evaluatedSceneBeforeDrag = buildEvaluatedScene({
  compositionId: "root",
  width: 1920,
  height: 1080,
  renderItems,
  timelineItems,
  layerMap: new Map(composition.layers.map((layer) => [layer.id, layer])),
  compositionMap: new Map(),
  metaByCompId: {},
  globalFrame: 0,
});
const accurateModePreviewScene = null;
let dragSeedBuilds = 0;
const draftBaseResolver = createPreviewDraftBaseSceneResolver(
  evaluatedSceneBeforeDrag,
  (scene) => {
    dragSeedBuilds += 1;
    return buildPreviewSceneFromEvaluatedScene(scene);
  }
);
assert.equal(accurateModePreviewScene, null);
assert.equal(dragSeedBuilds, 0);
let dragPreviewScene = accurateModePreviewScene;
for (let index = 0; index < 100; index += 1) {
  const resolvedDraftBase = draftBaseResolver.resolve();
  dragPreviewScene ??= resolvedDraftBase;
  assert.ok(dragPreviewScene);
  dragPreviewScene = updatePreviewSceneNodeTransform(
    dragPreviewScene,
    { kind: "layer", id: movingLayer.id },
    { position: { x: 100 + index, y: 200 + index } }
  );
}
assert.equal(dragSeedBuilds, 1);
const movedPreviewNode = dragPreviewScene.nodes.find(
  (node) => node.kind === "layer" && node.layerId === movingLayer.id
);
assert.deepEqual(movedPreviewNode?.transform.position, { x: 199, y: 299 });
const strictModeBaseScene = draftBaseResolver.resolve();
assert.ok(strictModeBaseScene);
const calculateStrictModeDraft = () => {
  const nextScene = updatePreviewSceneNodeTransform(
    strictModeBaseScene,
    { kind: "layer", id: movingLayer.id },
    { position: { x: 333, y: 444 } }
  );
  return applyPreviewNodeCacheFromScenes(strictModeBaseScene, nextScene).scene;
};
const strictModeDraftFirst = calculateStrictModeDraft();
const strictModeDraftSecond = calculateStrictModeDraft();
assert.deepEqual(
  strictModeDraftFirst?.nodes.find(
    (node) => node.kind === "layer" && node.layerId === movingLayer.id
  )?.transform.position,
  { x: 333, y: 444 }
);
assert.deepEqual(
  strictModeDraftSecond?.nodes.find(
    (node) => node.kind === "layer" && node.layerId === movingLayer.id
  )?.transform.position,
  { x: 333, y: 444 }
);
assert.deepEqual(
  frameBefore.commands.find((command) => command.sourceId === movingLayer.id)
    ?.transform.position,
  movingLayer.position
);
const evaluatedSceneAfterCommit = buildEvaluatedScene({
  compositionId: "root",
  width: 1920,
  height: 1080,
  renderItems,
  timelineItems,
  layerMap: new Map(
    movedCompositions[0]!.layers.map((layer) => [layer.id, layer])
  ),
  compositionMap: new Map(),
  metaByCompId: {},
  globalFrame: 0,
});
let nextDragSeedBuilds = 0;
const nextDragBaseResolver = createPreviewDraftBaseSceneResolver(
  evaluatedSceneAfterCommit,
  (scene) => {
    nextDragSeedBuilds += 1;
    return buildPreviewSceneFromEvaluatedScene(scene);
  }
);
assert.equal(nextDragSeedBuilds, 0);
const nextDragBaseScene = nextDragBaseResolver.resolve();
assert.equal(nextDragSeedBuilds, 1);
assert.deepEqual(
  nextDragBaseScene?.nodes.find(
    (node) => node.kind === "layer" && node.layerId === movingLayer.id
  )?.transform.position,
  { x: 180, y: 140 }
);

const actualMissFrame = buildRenderFrame({
  compositionId: "root",
  width: 1920,
  height: 1080,
  renderItems,
  timelineItems,
  layerMap: new Map(composition.layers.map((layer) => [layer.id, layer])),
  compositionMap: new Map(),
  metaByCompId: {},
  globalFrame: 0,
  resolveDrawableSource: createPreviewDrawableSourceResolver(cache, new Map()),
});
assert.equal(
  actualMissFrame.commands.every(
    (command) => command.type === "drawable" && command.source.kind === "original"
  ),
  true
);
assert.equal(
  makeFrame([composition], false).commands.every(
    (command) => command.type === "drawable" && command.source.kind === "original"
  ),
  true
);

const scheduledFrames = new Map<number, () => void>();
let nextFrameId = 0;
let previewUpdates = 0;
let projectUpdates = 0;
let historyDirty = 0;
let historyBegin = 0;
let historyCommit = 0;
let latestPosition = -1;
let pendingPosition: number | null = null;
const scheduler = createCanvasPointerFrameScheduler({
  requestFrame: (callback) => {
    nextFrameId += 1;
    scheduledFrames.set(nextFrameId, callback);
    return nextFrameId;
  },
  cancelFrame: (frameId) => {
    scheduledFrames.delete(frameId);
  },
});
historyBegin += 1;
scheduler.start({
  onMove: (sample) => {
    previewUpdates += 1;
    pendingPosition = sample.clientX;
  },
  onCommit: () => {
    if (pendingPosition !== null) {
      projectUpdates += 1;
      historyDirty += 1;
      latestPosition = pendingPosition;
      pendingPosition = null;
    }
    historyCommit += 1;
  },
  onCancel: () => {
    pendingPosition = null;
  },
});
for (let index = 0; index < 100; index += 1) {
  scheduler.push({ clientX: index, clientY: index, shiftKey: false });
}
assert.equal(scheduledFrames.size, 1);
const firstScheduled = scheduledFrames.values().next().value;
assert.ok(firstScheduled);
scheduledFrames.clear();
firstScheduled();
assert.equal(previewUpdates, 1);
assert.equal(projectUpdates, 0);
assert.equal(latestPosition, -1);
assert.equal(pendingPosition, 99);
scheduler.push({ clientX: 100, clientY: 100, shiftKey: false });
scheduler.push({ clientX: 101, clientY: 101, shiftKey: false });
scheduler.finish("commit");
assert.equal(previewUpdates, 2);
assert.equal(projectUpdates, 1);
assert.equal(historyDirty, 1);
assert.equal(latestPosition, 101);
assert.equal(pendingPosition, null);
assert.equal(historyBegin, 1);
assert.equal(historyCommit, 1);

function makeContext(drawCounter: { value: number }): Canvas2DRenderContext {
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
    drawImage: () => {
      drawCounter.value += 1;
    },
    globalAlpha: 1,
  } as Canvas2DRenderContext;
}
const drawCounter = { value: 0 };
let outputWidth = 0;
let outputHeight = 0;
let outputResizeCount = 0;
const outputCanvas = {
  get width() {
    return outputWidth;
  },
  set width(value: number) {
    outputWidth = value;
    outputResizeCount += 1;
  },
  get height() {
    return outputHeight;
  },
  set height(value: number) {
    outputHeight = value;
    outputResizeCount += 1;
  },
  getContext: () => makeContext(drawCounter),
} as unknown as HTMLCanvasElement;
function createVerificationCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => makeContext(drawCounter),
  } as unknown as HTMLCanvasElement;
}
let compositionCacheLookups = 0;
let compositionCacheStores = 0;
const trackingCompositionCache: CompositionPreviewCacheRuntime = {
  beginFrame: () => undefined,
  endFrame: () => undefined,
  dispose: () => undefined,
  getSnapshot: () => ({ size: 0, disposed: false, keys: [] }),
  getSurface: () => {
    compositionCacheLookups += 1;
    return null;
  },
  storeSurface: () => {
    compositionCacheStores += 1;
  },
};
const compositionWrappedDragPreviewScene = {
  ...dragPreviewScene,
  nodes: [
    {
      id: "composition:drag-preview-root",
      kind: "composition" as const,
      sourceId: "root",
      renderItemId: "render:root",
      parentId: null,
      children: dragPreviewScene.nodes,
      transform: {
        position: { x: 960, y: 540 },
        transformOffset: { x: 0, y: 0 },
        anchor: { x: 960, y: 540 },
        scale: { x: 100, y: 100 },
        rotation: 0,
      },
      opacity: 100,
      visible: true,
      order: 0,
      localFrame: 0,
      globalFrame: 0,
      logicalSize: { width: 1920, height: 1080 },
      targetCompId: "root",
    },
  ],
};
const previewSurfaceFactory = createReusableRenderSurfaceFactory(
  createVerificationCanvas
);
previewSurfaceFactory.beginFrame();
renderPreviewSceneToCanvas({
  canvas: outputCanvas,
  previewScene: compositionWrappedDragPreviewScene,
  renderItems,
  resolveDrawableSource: resolver,
  pixelScale: PREVIEW_QUALITY_SCALE.low,
  createSurface: previewSurfaceFactory.createSurface,
  compositionCache: resolvePreviewCompositionCacheForRender({
    compositionCache: trackingCompositionCache,
    isPreviewDraftActive: true,
  }),
});
previewSurfaceFactory.endFrame();
assert.equal(compositionCacheLookups, 0);
assert.equal(compositionCacheStores, 0);
previewSurfaceFactory.beginFrame();
renderPreviewSceneToCanvas({
  canvas: outputCanvas,
  previewScene: compositionWrappedDragPreviewScene,
  renderItems,
  resolveDrawableSource: resolver,
  pixelScale: PREVIEW_QUALITY_SCALE.low,
  createSurface: previewSurfaceFactory.createSurface,
  compositionCache: resolvePreviewCompositionCacheForRender({
    compositionCache: trackingCompositionCache,
    isPreviewDraftActive: false,
  }),
});
previewSurfaceFactory.endFrame();
assert.ok(compositionCacheLookups > 0);
assert.ok(compositionCacheStores > 0);
previewSurfaceFactory.dispose();
drawCounter.value = 0;
const surfaceFactory = createReusableRenderSurfaceFactory(createVerificationCanvas);
for (let index = 0; index < 2; index += 1) {
  surfaceFactory.beginFrame();
  renderFrameToCanvas(
    outputCanvas,
    frameAfter,
    surfaceFactory.createSurface,
    PREVIEW_QUALITY_SCALE.low
  );
  surfaceFactory.endFrame();
}
assert.deepEqual({ width: outputWidth, height: outputHeight }, { width: 480, height: 270 });
assert.equal(outputResizeCount, 2);
assert.equal(drawCounter.value, frameAfter.commands.length * 2);
surfaceFactory.dispose();

console.log(
  "Canvas drag performance verification passed",
  JSON.stringify({
    pointerMoves: 102,
    previewUpdates,
    projectUpdates,
    renderDraws: 2,
    previewBuilds: 1,
    factoryCalls,
    originalFallbacksOnHit: 0,
    disposeCalls,
  })
);
