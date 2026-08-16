import assert from "node:assert/strict";
import {
  buildLayerDocumentCanvasReadModel,
  type LayerDocumentCanvasRenderAssetPort,
} from "@/engines/canvas";
import {
  createCompositionPreviewCacheRuntime,
  createPreviewSurfaceCacheRuntime,
  resolvePreviewCompositionCacheForRender,
} from "@/engines/canvas/testing";
import {
  buildLayerDocumentTransformDraftSnapshot,
  buildLayerDocumentEditorFrameReadModel,
  buildLayerDocumentSourceResourceCacheKey,
  createLayerDocumentSourceRuntimeResourceCache,
  renderPreviewSceneToCanvas,
  renderAccurateRenderer,
  renderPreviewRenderer,
  type EvaluatedScene,
  type EvaluatedSceneDrawableNode,
  type PreviewRenderSurface,
  type PreviewCanvasDrawState,
  type RenderNodeVisualResolver,
  type LayerDocumentTransformDraftSnapshot,
} from "@/render";
import {
  drawPreviewSceneToContext,
} from "@/render/testing";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  validateLayerDocumentProject,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type SourceRegistryRecord,
} from "@/models";
import {
  prepareSourceRegistryRefresh,
} from "@/engines/project";

const timedSourceKey =
  buildLayerDocumentSourceResourceCacheKey({
    sourceId: "audio-source",
    sourceKind: "audio",
    visualKeyPolicy:
      "timed-frame-quality-sample",
    sourceVersion: 3,
    sourceFingerprint: "audio-v3",
    localFrame: 12,
    sourceSamplingQuality: "high",
  });
assert.equal(
  timedSourceKey,
  JSON.stringify([
    "layer-document-timed-source-resource-v1",
    "audio",
    "audio-source",
    3,
    "audio-v3",
    12,
    "high",
  ])
);

const transform = {
  position: { x: 0, y: 0 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

function drawable(
  suffix: string,
  sourceId: string
): EvaluatedSceneDrawableNode {
  return {
    type: "drawable",
    layerDocumentId: `layer-document-${suffix}`,
    renderItemId: `render-${suffix}`,
    drawableId: `drawable-${suffix}`,
    sourceId,
    sourceResourceCacheKey: `source-cache-${sourceId}`,
    layerResultCacheKey: `result-cache-${suffix}`,
    sourceType: "psd",
    localFrame: 0,
    visible: true,
    order: 0,
    logicalSize: { width: 80, height: 80 },
    transform,
    opacity: 100,
  };
}

const image = {} as CanvasImageSource;
function common(
  parentLayerDocumentId: string | null,
  order: number,
  sourceId: string | null = null
): LayerDocumentCommon {
  return {
    source: sourceId ? { sourceId } : null,
    transform: {
      ...transform,
      scaleLinked: true,
      opacity: 100,
    },
    placement: {
      parentLayerDocumentId,
      order,
      startFrame: 0,
      durationFrames: 90,
      sourceOffsetFrames: 0,
      visible: true,
      alias: null,
    },
    animation: {
      positionKeyframes: [],
      scaleKeyframes: [],
      rotationKeyframes: [],
      opacityKeyframes: [],
      enabledProperties: {
        position: false,
        scale: false,
        rotation: false,
        opacity: false,
      },
    },
    effects: [],
    modifiers: [],
  };
}

function sources(): Record<string, SourceRegistryRecord> {
  const refresh = {
    status: "normal" as const,
  };
  return Object.fromEntries(["a", "b"].flatMap((suffix) => [
    [
      `source-document-${suffix}`,
      {
        sourceId: `source-document-${suffix}`,
        kind: "psd-document" as const,
        displayName: `${suffix}.psd`,
        version: 1,
        refresh,
        locator: {
          locatorId: `linked:source-document-${suffix}`,
          kind: "linked-file" as const,
          suggestedFileName: `${suffix}.psd`,
          relativePathHint: null,
        },
        contentFingerprint: null,
        data: {
          importSettings: {
            compositionName: suffix.toUpperCase(),
            hiddenLayerMode: "preserve" as const,
          },
        },
      },
    ],
    [
      `source-node-${suffix}`,
      {
        sourceId: `source-node-${suffix}`,
        kind: "psd-node" as const,
        displayName: `Node ${suffix}`,
        version: 1,
        refresh,
        data: {
          documentSourceId: `source-document-${suffix}`,
          sourceKey: `layer:${suffix}`,
          sourcePath: "Node",
          visualFingerprint: `node-${suffix}-v1`,
        },
      },
    ],
  ])) as Record<string, SourceRegistryRecord>;
}

function projectFixture(): LayerDocumentProject {
  const layers: Record<string, LayerDocument> = {
    root: {
      layerDocumentId: "root",
      name: "Root",
      revision: 0,
      type: "group",
      common: common(null, 0),
      data: {
        role: "project-root",
        width: 200,
        height: 100,
        frameRate: 30,
        durationFrames: 90,
      },
    },
    "group-a": {
      layerDocumentId: "group-a",
      name: "Group A",
      revision: 0,
      type: "group",
      common: common("root", 0),
      data: {
        role: "composition",
        width: 100,
        height: 100,
        frameRate: 30,
        durationFrames: 90,
      },
    },
    "group-b": {
      layerDocumentId: "group-b",
      name: "Group B",
      revision: 0,
      type: "group",
      common: common("root", 1),
      data: {
        role: "composition",
        width: 100,
        height: 100,
        frameRate: 30,
        durationFrames: 90,
      },
    },
    "layer-a": {
      layerDocumentId: "layer-a",
      name: "Layer A",
      revision: 0,
      type: "psd",
      common: common("group-a", 0, "source-node-a"),
      data: {},
    },
    "layer-b": {
      layerDocumentId: "layer-b",
      name: "Layer B",
      revision: 0,
      type: "psd",
      common: common("group-b", 0, "source-node-b"),
      data: {},
    },
  };
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "preview-cache-fixture",
      name: "Preview cache fixture",
    },
    payload: {
      layerDocumentsById: layers,
      sourceRegistry: { sourcesById: sources() },
    },
  };
}

const resolvedLayerDocuments: string[] = [];
const renderAssets: LayerDocumentCanvasRenderAssetPort = {
  resolve: (request) => {
    resolvedLayerDocuments.push(request.layerDocumentId);
    return {
      source: {
        kind: "original",
        image,
        pixelSize: request.logicalSize,
      },
      alphaCanvas: null,
      sourceVisualIdentity:
        request.sourceResourceCacheKey,
    };
  },
};
function runtimeFor(
  project: LayerDocumentProject,
  draft: LayerDocumentTransformDraftSnapshot | null = null,
  globalFrame = 0
) {
  return buildLayerDocumentEditorFrameReadModel({
    project,
    activeGroupLayerDocumentId: "root",
    globalFrame,
    sourceSamplingQuality: "original",
    draft,
    resolvePsdSource: (request) => ({
      renderItemId: `runtime-${request.sourceId}`,
      drawableId: `drawable-${request.sourceId}`,
      logicalSize: { width: 80, height: 80 },
    }),
    readSourceResolutionStatus: () => "available",
  });
}
function canvasFor(
  project: LayerDocumentProject,
  previousPreviewScene = null,
  draft: LayerDocumentTransformDraftSnapshot | null = null
) {
  return buildLayerDocumentCanvasReadModel({
    activeScene: {
      layerDocumentId: "root",
      label: "Root",
      width: 200,
      height: 100,
      frameRate: 30,
      durationFrames: 90,
    },
    runtime: runtimeFor(project, draft),
    selectedLayerDocumentId: "layer-a",
    previewQuality: "original",
    viewport: {
      previewSize: { width: 200, height: 100 },
      viewportScale: 1,
      viewportOffset: { x: 0, y: 0 },
    },
    renderAssets,
    previousPreviewScene,
  });
}

const project = projectFixture();
assert.deepEqual(validateLayerDocumentProject(project), []);
const publicRuntime = runtimeFor(project);
assert.equal(publicRuntime.ok, true);
if (!publicRuntime.ok) throw new Error(publicRuntime.reason);
const evaluatedScene = publicRuntime.model.scene;
const compositionA = evaluatedScene.nodes[0];
const compositionB = evaluatedScene.nodes[1];
assert.equal(compositionA?.type, "composition");
assert.equal(compositionB?.type, "composition");
if (
  compositionA?.type !== "composition" ||
  compositionB?.type !== "composition"
) {
  throw new Error("Expected public composition nodes");
}
const drawableA = compositionA.children[0];
assert.equal(drawableA?.type, "drawable");
if (drawableA?.type !== "drawable") {
  throw new Error("Expected public drawable node");
}

const resolveNodeVisual: RenderNodeVisualResolver = (request) => {
  resolvedLayerDocuments.push(request.layerDocumentId);
  return {
    kind: "original",
    image,
    pixelSize: request.logicalSize,
  };
};

const accurate = renderAccurateRenderer({
  evaluatedScene,
  resolveNodeVisual,
}).frame;
assert.equal(accurate.commands.length, 2);
assert.deepEqual(
  accurate.commands.map((command) =>
    command.type === "composition"
      ? command.children[0]?.type
      : command.type
  ),
  ["drawable", "drawable"]
);
assert.deepEqual(resolvedLayerDocuments.slice(0, 2), [
  "layer-a",
  "layer-b",
]);

resolvedLayerDocuments.length = 0;
const fastCanvas = canvasFor(project);
assert.equal(fastCanvas.ok, true);
if (!fastCanvas.ok) throw new Error(fastCanvas.reason);
const previewScene = fastCanvas.model.renderer.previewScene;
assert.ok(previewScene);
if (!previewScene) throw new Error("Expected public preview scene");
assert.deepEqual(
  previewScene.nodes.map((node) => node.layerDocumentId),
  ["group-a", "group-b"]
);
assert.deepEqual(
  previewScene.nodes.map((node) => node.children[0]?.sourceResourceCacheKey),
  publicRuntime.model.inputs
    .filter((input) => input.type === "psd")
    .map((input) => input.sourceResourceCacheKey)
);

const unchangedCanvas = canvasFor(
  project,
  previewScene
);
assert.equal(unchangedCanvas.ok, true);
if (!unchangedCanvas.ok) {
  throw new Error(unchangedCanvas.reason);
}
const unchangedFast =
  unchangedCanvas.model.renderer.previewScene;
assert.ok(unchangedFast);
if (!unchangedFast) {
  throw new Error("Expected unchanged preview scene");
}
assert.strictEqual(unchangedFast, previewScene);
assert.strictEqual(unchangedFast.nodes[0], previewScene.nodes[0]);
assert.strictEqual(unchangedFast.nodes[1], previewScene.nodes[1]);

const frameOnlyRuntime = runtimeFor(project, null, 1);
assert.equal(frameOnlyRuntime.ok, true);
if (!frameOnlyRuntime.ok) {
  throw new Error(frameOnlyRuntime.reason);
}
const frameOnlyInput =
  frameOnlyRuntime.model.inputs.find(
    (input) => input.layerDocumentId === "layer-a"
  );
const baseInput =
  publicRuntime.model.inputs.find(
    (input) => input.layerDocumentId === "layer-a"
  );
assert.ok(frameOnlyInput);
assert.ok(baseInput);
assert.notEqual(
  frameOnlyInput?.evaluationIdentity,
  baseInput?.evaluationIdentity
);
assert.equal(
  frameOnlyInput?.layerResultCacheKey,
  baseInput?.layerResultCacheKey
);
const frameOnlyPreview = renderPreviewRenderer(
  frameOnlyRuntime.model.scene,
  undefined,
  previewScene
).previewScene;
assert.notStrictEqual(frameOnlyPreview, previewScene);
assert.strictEqual(
  frameOnlyPreview.nodes[0],
  previewScene.nodes[0]
);
assert.strictEqual(
  frameOnlyPreview.nodes[1],
  previewScene.nodes[1]
);

const visualProject = structuredClone(project);
visualProject.payload.layerDocumentsById[
  "layer-a"
]!.common.transform.position = { x: 12, y: 4 };
const visualCanvas = canvasFor(
  visualProject,
  previewScene
);
assert.equal(visualCanvas.ok, true);
if (!visualCanvas.ok) {
  throw new Error(visualCanvas.reason);
}
const fastWithChangedChild =
  visualCanvas.model.renderer.previewScene;
assert.ok(fastWithChangedChild);
if (!fastWithChangedChild) {
  throw new Error("Expected changed preview scene");
}
assert.notStrictEqual(fastWithChangedChild, previewScene);
assert.notStrictEqual(
  fastWithChangedChild.nodes[0],
  previewScene.nodes[0]
);
assert.notStrictEqual(
  fastWithChangedChild.nodes[0]?.children[0],
  previewScene.nodes[0]?.children[0]
);
assert.strictEqual(
  fastWithChangedChild.nodes[1],
  previewScene.nodes[1]
);
assert.equal(
  fastWithChangedChild.nodes[0]?.sourceResourceCacheKey,
  previewScene.nodes[0]?.sourceResourceCacheKey
);
assert.notEqual(
  fastWithChangedChild.nodes[0]?.layerResultCacheKey,
  previewScene.nodes[0]?.layerResultCacheKey
);

const currentSource =
  project.payload.sourceRegistry.sourcesById[
    "source-node-a"
  ];
assert.ok(currentSource);
const preparedRefresh = prepareSourceRegistryRefresh(
  project,
  {
    source: {
      ...currentSource!,
      version: currentSource!.version + 1,
      data: {
        ...currentSource!.data,
        visualFingerprint: "node-a-v2",
      },
    },
    cacheContext: {
      globalFrame: 0,
      localFrameByLayerDocumentId: {
        "layer-a": 0,
      },
      quality: "original",
    },
  }
);
assert.equal(preparedRefresh.ok, true);
if (!preparedRefresh.ok) {
  throw new Error(preparedRefresh.error.message);
}
const refreshInvalidation =
  preparedRefresh.transaction.cacheInvalidations[0];
assert.ok(refreshInvalidation);
assert.notEqual(
  refreshInvalidation?.sourceResourceCacheKeyBefore,
  refreshInvalidation?.sourceResourceCacheKeyAfter
);
assert.notEqual(
  refreshInvalidation?.layerResultCacheKeyBefore,
  refreshInvalidation?.layerResultCacheKeyAfter
);
const refreshedCanvas = canvasFor(
  preparedRefresh.transaction.after,
  previewScene
);
assert.equal(refreshedCanvas.ok, true);
if (!refreshedCanvas.ok) {
  throw new Error(refreshedCanvas.reason);
}
const refreshedPreview =
  refreshedCanvas.model.renderer.previewScene;
assert.ok(refreshedPreview);
if (!refreshedPreview) {
  throw new Error("Expected refreshed preview scene");
}
assert.notStrictEqual(
  refreshedPreview.nodes[0],
  previewScene.nodes[0]
);
assert.notStrictEqual(
  refreshedPreview.nodes[0]?.children[0],
  previewScene.nodes[0]?.children[0]
);
assert.strictEqual(
  refreshedPreview.nodes[1],
  previewScene.nodes[1]
);
assert.deepEqual(
  refreshedPreview.nodes[0]?.children[0]?.transform,
  previewScene.nodes[0]?.children[0]?.transform
);
assert.equal(
  refreshedPreview.nodes[0]?.children[0]
    ?.sourceResourceCacheKey,
  refreshInvalidation?.sourceResourceCacheKeyAfter
);
const refreshedRuntime = runtimeFor(
  preparedRefresh.transaction.after
);
assert.equal(refreshedRuntime.ok, true);
if (!refreshedRuntime.ok) {
  throw new Error(refreshedRuntime.reason);
}
const refreshedInput = refreshedRuntime.model.inputs.find(
  (input) => input.layerDocumentId === "layer-a"
);
assert.equal(
  refreshedInput?.evaluationIdentity,
  refreshInvalidation?.layerResultCacheKeyAfter
);
assert.equal(
  refreshedPreview.nodes[0]?.children[0]
    ?.layerResultCacheKey,
  refreshedInput?.layerResultCacheKey
);

const resultKeyProject = structuredClone(project);
resultKeyProject.payload.layerDocumentsById[
  "layer-a"
]!.revision += 1;
const resultKeyCanvas = canvasFor(
  resultKeyProject,
  previewScene
);
assert.equal(resultKeyCanvas.ok, true);
if (!resultKeyCanvas.ok) {
  throw new Error(resultKeyCanvas.reason);
}
const resultKeyPreview =
  resultKeyCanvas.model.renderer.previewScene;
assert.ok(resultKeyPreview);
if (!resultKeyPreview) {
  throw new Error("Expected result-key preview scene");
}
assert.strictEqual(
  resultKeyPreview.nodes[0],
  previewScene.nodes[0]
);
assert.strictEqual(
  resultKeyPreview.nodes[0]?.children[0],
  previewScene.nodes[0]?.children[0]
);
assert.strictEqual(
  resultKeyPreview.nodes[1],
  previewScene.nodes[1]
);
assert.deepEqual(
  resultKeyPreview.nodes[0]?.children[0]?.transform,
  previewScene.nodes[0]?.children[0]?.transform
);
assert.equal(
  resultKeyPreview.nodes[0]?.children[0]
    ?.sourceResourceCacheKey,
  previewScene.nodes[0]?.children[0]
    ?.sourceResourceCacheKey
);
assert.equal(
  resultKeyPreview.nodes[0]?.children[0]
    ?.layerResultCacheKey,
  previewScene.nodes[0]?.children[0]
    ?.layerResultCacheKey
);
const resultKeyRuntime = runtimeFor(resultKeyProject);
assert.equal(resultKeyRuntime.ok, true);
if (!resultKeyRuntime.ok) {
  throw new Error(resultKeyRuntime.reason);
}
assert.notEqual(
  resultKeyRuntime.model.inputs.find(
    (input) => input.layerDocumentId === "layer-a"
  )?.evaluationIdentity,
  baseInput?.evaluationIdentity
);

let surfaceCreateCount = 0;
let drawImageCount = 0;
function createContext() {
  return {
    globalAlpha: 1,
    fillStyle: "",
    font: "",
    textAlign: "left" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
    clearRect: () => undefined,
    beginPath: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    fillRect: () => undefined,
    fillText: () => undefined,
    setTransform: () => undefined,
    drawImage: () => {
      drawImageCount += 1;
    },
  };
}
const rootContext = createContext();
const surfaces: PreviewRenderSurface[] = [];
const createSurface = (
  width: number,
  height: number,
  pixelScale: number
): PreviewRenderSurface => {
  surfaceCreateCount += 1;
  const surface = {
    canvas: {
      width: Math.ceil(width * pixelScale),
      height: Math.ceil(height * pixelScale),
    } as HTMLCanvasElement,
    context: createContext(),
  };
  surfaces.push(surface);
  return surface;
};
const surfaceCache = createPreviewSurfaceCacheRuntime();
const compositionCache = createCompositionPreviewCacheRuntime({
  releaseSurface: surfaceCache.releaseSurface,
});

resolvedLayerDocuments.length = 0;
compositionCache.beginFrame();
drawPreviewSceneToContext(
  rootContext,
  previewScene,
  createSurface,
  1,
  undefined,
  compositionCache,
  "original",
  surfaceCache,
  resolveNodeVisual
);
compositionCache.endFrame();
assert.equal(surfaceCreateCount, 2);
assert.equal(compositionCache.getSnapshot().size, 2);
assert.deepEqual(resolvedLayerDocuments, [
  "layer-b",
  "layer-a",
]);

compositionCache.beginFrame();
drawPreviewSceneToContext(
  rootContext,
  previewScene,
  createSurface,
  1,
  undefined,
  compositionCache,
  "original",
  surfaceCache,
  resolveNodeVisual
);
compositionCache.endFrame();
assert.equal(surfaceCreateCount, 2);
assert.equal(resolvedLayerDocuments.length, 2);

const baseLayerInput = publicRuntime.model.inputs.find(
  (input) => input.layerDocumentId === "layer-a"
);
assert.ok(baseLayerInput);
const changedDraft = buildLayerDocumentTransformDraftSnapshot(
  baseLayerInput!,
  { position: { x: 12, y: 4 } }
);
const changedCanvas = canvasFor(
  project,
  previewScene,
  changedDraft
);
assert.equal(changedCanvas.ok, true);
if (!changedCanvas.ok) {
  throw new Error(changedCanvas.reason);
}
const changedA =
  changedCanvas.model.renderer.previewScene;
assert.notStrictEqual(changedA.nodes[0], previewScene.nodes[0]);
assert.strictEqual(changedA.nodes[1], previewScene.nodes[1]);
const resolvedBeforeChangedDraw =
  resolvedLayerDocuments.length;
compositionCache.beginFrame();
drawPreviewSceneToContext(
  rootContext,
  changedA,
  createSurface,
  1,
  undefined,
  compositionCache,
  "original",
  surfaceCache,
  resolveNodeVisual
);
compositionCache.endFrame();
assert.equal(surfaceCreateCount, 2);
assert.deepEqual(
  resolvedLayerDocuments.slice(
    resolvedBeforeChangedDraw
  ),
  ["layer-a"]
);
assert.equal(compositionCache.getSnapshot().size, 2);

const publicDraft = buildLayerDocumentTransformDraftSnapshot(
  baseLayerInput!,
  { position: { x: 18, y: 6 } }
);
const publicDraftCanvas = canvasFor(
  project,
  previewScene,
  publicDraft
);
assert.equal(publicDraftCanvas.ok, true);
if (!publicDraftCanvas.ok) {
  throw new Error(publicDraftCanvas.reason);
}
assert.equal(
  publicDraftCanvas.model.selectedInput?.draftApplied,
  true
);
const publicDraftPreview =
  publicDraftCanvas.model.renderer.previewScene;
assert.ok(publicDraftPreview);
if (!publicDraftPreview) {
  throw new Error("Expected public Draft preview scene");
}
const cacheSnapshotBeforeDraft = compositionCache.getSnapshot();
assert.equal(
  resolvePreviewCompositionCacheForRender({
    compositionCache,
  }),
  compositionCache
);
drawPreviewSceneToContext(
  rootContext,
  publicDraftPreview,
  createSurface,
  1,
  undefined,
  resolvePreviewCompositionCacheForRender({
    compositionCache,
  }),
  "original",
  surfaceCache,
  resolveNodeVisual
);
assert.deepEqual(
  compositionCache.getSnapshot(),
  cacheSnapshotBeforeDraft
);
assert.strictEqual(
  resolvePreviewCompositionCacheForRender({
    compositionCache,
  }),
  compositionCache
);
compositionCache.beginFrame();
drawPreviewSceneToContext(
  rootContext,
  changedA,
  createSurface,
  1,
  undefined,
  compositionCache,
  "original",
  surfaceCache,
  resolveNodeVisual
);
compositionCache.endFrame();
assert.deepEqual(
  compositionCache.getSnapshot(),
  cacheSnapshotBeforeDraft
);

const onlySecondPsd = {
  ...changedA,
  nodes: [changedA.nodes[1]],
};
compositionCache.beginFrame();
drawPreviewSceneToContext(
  rootContext,
  onlySecondPsd,
  createSurface,
  1,
  undefined,
  compositionCache,
  "original",
  surfaceCache,
  resolveNodeVisual
);
compositionCache.endFrame();
assert.equal(compositionCache.getSnapshot().size, 1);
assert.ok(surfaceCache.getSnapshot().poolSize >= 1);
assert.ok(drawImageCount > 0);

let poolCreateCount = 0;
let poolResetCount = 0;
const poolSurfaces: PreviewRenderSurface[] = [];
const createPoolSurface = (
  width: number,
  height: number,
  scale: number
): PreviewRenderSurface => {
  poolCreateCount += 1;
  const surface = {
    canvas: {
      width: Math.ceil(width * scale),
      height: Math.ceil(height * scale),
    } as HTMLCanvasElement,
    context: {
      ...createContext(),
      clearRect: () => {
        poolResetCount += 1;
      },
    },
  };
  poolSurfaces.push(surface);
  return surface;
};
const boundedPool = createPreviewSurfaceCacheRuntime({
  maxPoolSize: 2,
});
const poolInput = (
  width: number,
  height: number,
  previewQuality: string
) => ({
  logicalWidth: width,
  logicalHeight: height,
  previewQuality,
  previewScale: 1,
  createSurface: createPoolSurface,
});
const pooledA = boundedPool.acquireSurface(
  poolInput(10, 10, "original")
);
assert.ok(pooledA);
pooledA!.canvas.width = 999;
boundedPool.releaseSurface(pooledA!);
const reusedA = boundedPool.acquireSurface(
  poolInput(10, 10, "original")
);
assert.strictEqual(reusedA, pooledA);
assert.equal(poolCreateCount, 1);
assert.equal(reusedA?.canvas.width, 10);
assert.equal(poolResetCount, 1);
boundedPool.releaseSurface(reusedA!);
const pooledB = boundedPool.acquireSurface(
  poolInput(20, 10, "high")
);
assert.ok(pooledB);
boundedPool.releaseSurface(pooledB!);
const pooledC = boundedPool.acquireSurface(
  poolInput(30, 10, "medium")
);
assert.ok(pooledC);
boundedPool.releaseSurface(pooledC!);
assert.equal(boundedPool.getSnapshot().poolSize, 2);
assert.equal(pooledA?.canvas.width, 0);
assert.equal(poolCreateCount, 3);
boundedPool.dispose();
boundedPool.dispose();
assert.equal(boundedPool.getSnapshot().poolSize, 0);
assert.ok(
  poolSurfaces.every((surface) => surface.canvas.width === 0)
);

let disposedA = 0;
let disposedB = 0;
const sourceRuntime = createLayerDocumentSourceRuntimeResourceCache();
const runtimeEntry = (
  sourceId: string,
  onDispose: () => void
) => ({
  sourceId,
  sourceResourceCacheKey: `source-cache-${sourceId}`,
  resolution: {
    renderItemId: `runtime-${sourceId}`,
    drawableId: `runtime-drawable-${sourceId}`,
    logicalSize: { width: 80, height: 80 },
  },
  resource: { sourceId },
  dispose: onDispose,
});
assert.equal(
  sourceRuntime.registerBatch([
    runtimeEntry("psd-a", () => {
      disposedA += 1;
    }),
    runtimeEntry("psd-b", () => {
      disposedB += 1;
    }),
  ]).ok,
  true
);
assert.equal(
  sourceRuntime.invalidate({ kind: "source", sourceId: "psd-a" }),
  1
);
assert.equal(disposedA, 1);
assert.ok(
  sourceRuntime.resolve({
    sourceId: "psd-b",
    sourceResourceCacheKey: "source-cache-psd-b",
  })
);
sourceRuntime.dispose();
sourceRuntime.dispose();
assert.equal(disposedA, 1);
assert.equal(disposedB, 1);

function directDrawable(
  suffix: string,
  x: number,
  order: number
): EvaluatedSceneDrawableNode {
  return {
    ...drawable(suffix, `direct-${suffix}`),
    order,
    logicalSize: { width: 20, height: 20 },
    transform: {
      ...transform,
      position: { x, y: 20.25 },
    },
  };
}
const directScene: EvaluatedScene = {
  compositionId: "direct-root",
  globalFrame: 0,
  size: { width: 200, height: 100 },
  localFrameBySourceId: new Map(),
  localFrameByLayerDocumentId: new Map(),
  nodes: [
    directDrawable("mover", 20.25, 0),
    directDrawable("separated", 170.25, 1),
    directDrawable("foreground", 40.25, 2),
  ],
};
const directPreview =
  renderPreviewRenderer(directScene).previewScene;
const directResolveCalls: string[] = [];
const directResolver: RenderNodeVisualResolver = (request) => {
  directResolveCalls.push(request.layerDocumentId);
  return {
    kind: "original",
    image,
    pixelSize: request.logicalSize,
  };
};
const clearCalls: number[][] = [];
const canvasContext = {
  ...createContext(),
  clearRect: (...values: number[]) => {
    clearCalls.push(values);
  },
};
const canvas = {
  width: 0,
  height: 0,
  getContext: () => canvasContext,
} as unknown as HTMLCanvasElement;
const drawState: PreviewCanvasDrawState = {
  previousScene: null,
  previousNodeBoundsById: new Map(),
  previousPixelScale: null,
};
renderPreviewSceneToCanvas({
  canvas,
  previewScene: directPreview,
  resolveNodeVisual: directResolver,
  createSurface,
  drawState,
});
assert.deepEqual(directResolveCalls, [
  "layer-document-foreground",
  "layer-document-separated",
  "layer-document-mover",
]);
assert.deepEqual(clearCalls[0], [0, 0, 200, 100]);
directResolveCalls.length = 0;
renderPreviewSceneToCanvas({
  canvas,
  previewScene: directPreview,
  resolveNodeVisual: directResolver,
  createSurface,
  drawState,
});
assert.deepEqual(directResolveCalls, []);
const movedDirectScene: EvaluatedScene = {
  ...directScene,
  nodes: directScene.nodes.map((node) =>
    node.layerDocumentId === "layer-document-mover"
      ? {
          ...node,
          transform: {
            ...node.transform,
            position: { x: 30.75, y: 20.25 },
          },
        }
      : node
  ),
};
const movedPreview = renderPreviewRenderer(
  movedDirectScene,
  undefined,
  directPreview
).previewScene;
renderPreviewSceneToCanvas({
  canvas,
  previewScene: movedPreview,
  resolveNodeVisual: directResolver,
  createSurface,
  drawState,
});
assert.deepEqual(directResolveCalls, [
  "layer-document-foreground",
  "layer-document-separated",
  "layer-document-mover",
]);
assert.deepEqual(clearCalls.at(-1), [0, 0, 200, 100]);

compositionCache.beginFrame();
compositionCache.endFrame();
assert.equal(compositionCache.getSnapshot().size, 0);
assert.ok(surfaceCache.getSnapshot().poolSize > 0);
compositionCache.dispose();
surfaceCache.dispose();
compositionCache.dispose();
surfaceCache.dispose();
assert.equal(compositionCache.getSnapshot().size, 0);
assert.equal(surfaceCache.getSnapshot().activeCount, 0);
assert.equal(surfaceCache.getSnapshot().poolSize, 0);
assert.ok(surfaces.every((surface) => surface.canvas.width === 0));
