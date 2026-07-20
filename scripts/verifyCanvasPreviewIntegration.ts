import assert from "node:assert/strict";
import type { Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import {
  buildRenderFrame,
} from "@/engines/playback-render";
import {
  drawRenderCommandsToContext,
  type Canvas2DRenderContext,
} from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import {
  buildPreviewCacheGeneration,
  getPreviewBuildCacheKeys,
} from "@/engines/canvas/controllers/buildPreviewCacheGeneration";
import {
  collectPreviewBuildSources,
  getPreviewBuildSourceSetKey,
} from "@/engines/canvas/helpers/previewBuildSourceHelpers";
import { buildLayerMotionPath } from "@/engines/canvas/helpers/canvasMotionPathHelpers";
import { buildLayerSelectionOverlay } from "@/engines/canvas/helpers/canvasSelectionHelpers";
import { resolveDraftTransformSnapshot } from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import { collectRenderFrameSourceIds } from "@/engines/canvas/helpers/previewRenderFrameHelpers";
import { createPreviewDrawableSourceResolver } from "@/engines/canvas/helpers/previewResolverHelpers";
import type {
  PreviewBitmapFactoryPort,
  PreviewBuildSource,
} from "@/engines/canvas/models/previewBuildModel";
import { PREVIEW_QUALITY_SCALE } from "@/engines/canvas/constants/previewQualityConstants";
import { createPreviewCacheRuntime } from "@/engines/canvas/state/previewCacheRuntimeStore";

const disabledProperties = {
  position: false,
  scale: false,
  rotation: false,
  opacity: false,
};

function makeLayer(id: string, sourceKey = `layer-id:${id}`): Layer {
  return {
    id,
    name: id,
    visible: true,
    sourceIdentity: { sourceFileName: "character.psd", sourceKey },
    sourceFingerprint: `fingerprint-${sourceKey}`,
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

function makeBuildSource(
  sourceId: string,
  width = 20,
  height = 40
): PreviewBuildSource {
  return {
    sourceId,
    sourceIds: [sourceId],
    sourceIdentity: {
      sourceFileName: "character.psd",
      sourceKey: `layer-id:${sourceId}`,
    },
    sourceFingerprint: `fingerprint-${sourceId}`,
    sourceCanvas: { width, height } as HTMLCanvasElement,
    logicalSize: { width, height },
  };
}

const disposedKeys: string[] = [];
let factoryCallCount = 0;
const factory: PreviewBitmapFactoryPort = async (input) => {
  factoryCallCount += 1;
  const scale = PREVIEW_QUALITY_SCALE[input.quality];
  const width = Math.ceil(input.sourceCanvas.width * scale);
  const height = Math.ceil(input.sourceCanvas.height * scale);
  const image = { width, height, key: input.key } as unknown as ImageBitmap;
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
        image,
        pixelSize: { width, height },
        logicalSize: { ...input.logicalSize },
        dispose: () => disposedKeys.push(input.key),
      },
    },
  };
};

const sourceA = makeBuildSource("layer-a");
assert.equal(
  getPreviewBuildSourceSetKey([sourceA]),
  getPreviewBuildSourceSetKey([{ ...sourceA, sourceIds: [...sourceA.sourceIds] }])
);
assert.notEqual(
  getPreviewBuildSourceSetKey([sourceA]),
  getPreviewBuildSourceSetKey([
    { ...sourceA, sourceFingerprint: "fingerprint-changed" },
  ])
);
const cache = createPreviewCacheRuntime(Number.POSITIVE_INFINITY);
cache.setActiveKeys(getPreviewBuildCacheKeys([sourceA], "medium"));
const progress: Array<[number, number]> = [];
const firstBuild = await buildPreviewCacheGeneration({
  sources: [sourceA],
  quality: "medium",
  cache,
  factory,
  onProgress: (value) =>
    progress.push([value.completedCount, value.totalCount]),
});
assert.equal(firstBuild.status, "completed");
assert.equal(firstBuild.generation, 1);
assert.deepEqual(progress, [
  [0, 1],
  [1, 1],
]);
assert.equal(factoryCallCount, 1);
const firstKey = firstBuild.resourceKeyBySourceId.get("layer-a");
assert.ok(firstKey);

const firstResolver = createPreviewDrawableSourceResolver(
  cache,
  firstBuild.resourceKeyBySourceId
);
const firstResolved = firstResolver({
  renderItemId: "render-a",
  drawableId: "drawable-a",
  sourceId: "layer-a",
  logicalSize: { width: 20, height: 40 },
  originalSource: {
    kind: "original",
    image: sourceA.sourceCanvas,
    pixelSize: { width: 20, height: 40 },
  },
});
assert.equal(firstResolved?.kind, "preview");
assert.deepEqual(firstResolved?.pixelSize, { width: 10, height: 20 });
assert.equal(
  firstResolver({
    renderItemId: "render-a",
    drawableId: "drawable-a",
    sourceId: "layer-a",
    logicalSize: { width: 21, height: 40 },
    originalSource: {
      kind: "original",
      image: sourceA.sourceCanvas,
      pixelSize: { width: 20, height: 40 },
    },
  }),
  null
);

const hitBuild = await buildPreviewCacheGeneration({
  sources: [sourceA],
  quality: "medium",
  cache,
  factory: async () => {
    throw new Error("cache hit must not invoke factory");
  },
});
assert.equal(hitBuild.status, "completed");
assert.equal(hitBuild.generation, 2);
assert.equal(hitBuild.resourceKeyBySourceId.get("layer-a"), firstKey);

let releaseSlowFactory: (() => void) | null = null;
const slowFactory: PreviewBitmapFactoryPort = async (input) => {
  await new Promise<void>((resolve) => {
    releaseSlowFactory = resolve;
  });
  return factory(input);
};
const slowSource = makeBuildSource("slow");
const slowBuildPromise = buildPreviewCacheGeneration({
  sources: [slowSource],
  quality: "high",
  cache,
  factory: slowFactory,
});
await Promise.resolve();
assert.equal(cache.getGeneration(), 3);
assert.equal(firstResolver({
  renderItemId: "render-a",
  drawableId: "drawable-a",
  sourceId: "layer-a",
  logicalSize: { width: 20, height: 40 },
  originalSource: {
    kind: "original",
    image: sourceA.sourceCanvas,
    pixelSize: { width: 20, height: 40 },
  },
})?.kind, "preview");

const replacementSource = makeBuildSource("replacement", 12, 8);
cache.setActiveKeys(getPreviewBuildCacheKeys([replacementSource], "low"));
const replacementBuild = await buildPreviewCacheGeneration({
  sources: [replacementSource],
  quality: "low",
  cache,
  factory,
});
assert.equal(replacementBuild.status, "completed");
assert.equal(replacementBuild.generation, 4);
assert.ok(releaseSlowFactory);
releaseSlowFactory();
const slowBuild = await slowBuildPromise;
assert.equal(slowBuild.status, "stale");
assert.equal(disposedKeys.length, 1);
assert.equal(
  firstResolver({
    renderItemId: "render-replacement",
    drawableId: "drawable-replacement",
    sourceId: "replacement",
    logicalSize: { width: 12, height: 8 },
    originalSource: {
      kind: "original",
      image: replacementSource.sourceCanvas,
      pixelSize: { width: 12, height: 8 },
    },
  }),
  null
);
const replacementResolver = createPreviewDrawableSourceResolver(
  cache,
  replacementBuild.resourceKeyBySourceId
);
assert.deepEqual(
  replacementResolver({
    renderItemId: "render-replacement",
    drawableId: "drawable-replacement",
    sourceId: "replacement",
    logicalSize: { width: 12, height: 8 },
    originalSource: {
      kind: "original",
      image: replacementSource.sourceCanvas,
      pixelSize: { width: 12, height: 8 },
    },
  })?.pixelSize,
  { width: 3, height: 2 }
);

const layer = makeLayer("layer-a");
const timelineItem: TimelineItem = {
  id: "timeline-a",
  name: "Layer A",
  kind: "layer",
  visible: true,
  compId: "root",
  sourceId: layer.id,
  startFrame: 0,
  durationFrames: 30,
};
const renderItem: RenderItem = {
  id: "render-a",
  name: "Layer A",
  kind: "layer",
  visible: true,
  sourceId: layer.id,
  drawables: [
    {
      id: "drawable-a",
      left: 0,
      top: 0,
      visible: true,
      sourceLayerId: layer.id,
      canvas: sourceA.sourceCanvas,
    },
  ],
};
const frameOptions = {
  compositionId: "root",
  width: 200,
  height: 100,
  renderItems: [renderItem],
  timelineItems: [timelineItem],
  layerMap: new Map([[layer.id, layer]]),
  compositionMap: new Map(),
  metaByCompId: {},
  globalFrame: 0,
};
const originalFrame = buildRenderFrame(frameOptions);
const previewFrame = buildRenderFrame({
  ...frameOptions,
  resolveDrawableSource: firstResolver,
});
const originalCommand = originalFrame.commands[0];
const previewCommand = previewFrame.commands[0];
assert.equal(originalCommand?.type, "drawable");
assert.equal(previewCommand?.type, "drawable");
if (originalCommand?.type !== "drawable" || previewCommand?.type !== "drawable") {
  throw new Error("drawable command expected");
}
assert.equal(originalCommand.source.kind, "original");
assert.equal(previewCommand.source.kind, "preview");
assert.deepEqual(previewCommand.logicalSize, originalCommand.logicalSize);
assert.deepEqual(previewCommand.transform, originalCommand.transform);
assert.deepEqual(previewCommand.transform.anchor, layer.anchor);
assert.deepEqual(previewCommand.transform.scale, layer.scale);

const drawCalls: unknown[][] = [];
const context = {
  clearRect: () => undefined,
  beginPath: () => undefined,
  rect: () => undefined,
  clip: () => undefined,
  save: () => undefined,
  restore: () => undefined,
  translate: () => undefined,
  rotate: () => undefined,
  scale: () => undefined,
  drawImage: (...args: unknown[]) => drawCalls.push(args),
  globalAlpha: 1,
} as Canvas2DRenderContext;
drawRenderCommandsToContext(context, previewFrame.commands, () => null);
assert.deepEqual(drawCalls[0]?.slice(1), [0, 0, 20, 40]);
assert.deepEqual(collectRenderFrameSourceIds(previewFrame), ["layer-a"]);

const motionBefore = buildLayerMotionPath(
  layer,
  [renderItem],
  [timelineItem],
  30,
  0,
  30
);
const motionAfter = buildLayerMotionPath(
  layer,
  [renderItem],
  [timelineItem],
  30,
  0,
  30
);
assert.deepEqual(motionAfter, motionBefore);

const motionPathMeta = {
  width: 200,
  height: 100,
  layerCount: 1,
  sourceFileName: "character.psd",
  frameRate: 30,
  durationFrames: 30,
};
const createPositionDraftSnapshot = (
  targetLayer: Layer,
  localFrame: number,
  position: { x: number; y: number }
) => {
  const overlay = buildLayerSelectionOverlay(
    targetLayer,
    [renderItem],
    [timelineItem],
    localFrame,
    motionPathMeta.frameRate
  );
  assert.ok(overlay);
  const snapshot = resolveDraftTransformSnapshot({
    target: { kind: "layer", layer: targetLayer },
    localFrame,
    frameRate: motionPathMeta.frameRate,
    selectedMeta: motionPathMeta,
    overlay,
    patch: { position },
  });
  assert.ok(snapshot);
  return snapshot;
};

const staticDraftPosition = { x: 90, y: 70 };
const staticDraftSnapshot = createPositionDraftSnapshot(
  layer,
  10,
  staticDraftPosition
);
const staticDraftMotion = buildLayerMotionPath(
  layer,
  [renderItem],
  [timelineItem],
  30,
  10,
  30,
  staticDraftSnapshot
);
const staticCommittedMotion = buildLayerMotionPath(
  { ...layer, position: staticDraftPosition },
  [renderItem],
  [timelineItem],
  30,
  10,
  30
);
assert.deepEqual(staticDraftMotion, staticCommittedMotion);

const anchorDraftSnapshot = resolveDraftTransformSnapshot({
  target: { kind: "layer", layer },
  localFrame: 10,
  frameRate: motionPathMeta.frameRate,
  selectedMeta: motionPathMeta,
  overlay: buildLayerSelectionOverlay(
    layer,
    [renderItem],
    [timelineItem],
    10,
    motionPathMeta.frameRate
  )!,
  patch: {
    anchor: { x: 18, y: 12 },
    transformOffset: { x: 9, y: 1 },
  },
});
assert.ok(anchorDraftSnapshot);
const anchorDraftMotion = buildLayerMotionPath(
  layer,
  [renderItem],
  [timelineItem],
  30,
  10,
  30,
  anchorDraftSnapshot
);
const anchorCommittedMotion = buildLayerMotionPath(
  {
    ...layer,
    anchor: anchorDraftSnapshot.anchor,
    transformOffset: anchorDraftSnapshot.transformOffset,
  },
  [renderItem],
  [timelineItem],
  30,
  10,
  30
);
assert.deepEqual(anchorDraftMotion, anchorCommittedMotion);

const animatedLayer: Layer = {
  ...layer,
  enabledProperties: { ...layer.enabledProperties, position: true },
  positionKeyframes: [
    { frame: 0, value: { x: 30, y: 20 } },
    { frame: 20, value: { x: 110, y: 80 } },
  ],
};
const animatedDraftPosition = { x: 80, y: 65 };
const animatedDraftSnapshot = createPositionDraftSnapshot(
  animatedLayer,
  10,
  animatedDraftPosition
);
const animatedDraftMotion = buildLayerMotionPath(
  animatedLayer,
  [renderItem],
  [timelineItem],
  30,
  10,
  30,
  animatedDraftSnapshot
);
const animatedCommittedMotion = buildLayerMotionPath(
  {
    ...animatedLayer,
    position: animatedDraftPosition,
    positionKeyframes: [
      animatedLayer.positionKeyframes[0]!,
      { frame: 10, value: animatedDraftPosition },
      animatedLayer.positionKeyframes[1]!,
    ],
  },
  [renderItem],
  [timelineItem],
  30,
  10,
  30
);
assert.deepEqual(animatedDraftMotion, animatedCommittedMotion);

const aliasLayerA = makeLayer("alias-a", "layer-id:shared");
const aliasLayerB = makeLayer("alias-b", "layer-id:shared");
const aliasCanvas = { width: 30, height: 10 } as HTMLCanvasElement;
const aliasSources = collectPreviewBuildSources(
  {
    a: [
      {
        ...renderItem,
        sourceId: aliasLayerA.id,
        drawables: [
          {
            ...renderItem.drawables[0]!,
            sourceLayerId: aliasLayerA.id,
            canvas: aliasCanvas,
          },
        ],
      },
    ],
    b: [
      {
        ...renderItem,
        id: "render-alias-b",
        sourceId: aliasLayerB.id,
        drawables: [
          {
            ...renderItem.drawables[0]!,
            sourceLayerId: aliasLayerB.id,
            canvas: aliasCanvas,
          },
        ],
      },
    ],
  },
  new Map([
    [aliasLayerA.id, aliasLayerA],
    [aliasLayerB.id, aliasLayerB],
  ])
);
assert.equal(aliasSources.length, 1);
assert.deepEqual(aliasSources[0]?.sourceIds, ["alias-a", "alias-b"]);

console.log("Canvas preview integration verification passed");
