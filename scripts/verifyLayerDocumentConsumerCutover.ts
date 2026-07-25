import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  findNonPlainDataPath,
  validateLayerDocumentProject,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerSourceReference,
  type PsdDocumentSourceRecord,
  type PsdNodeSourceRecord,
} from "@/models";
import {
  createLayerDocumentCanvasCutoverCommandPort,
  createLayerDocumentConsumerCutoverAssembly,
} from "@/cutover";
import {
  createLayerDocumentCanvasCommands,
} from "@/engines/canvas/adapters/layerDocumentCanvasCommandAdapter";
import {
  createLayerDocumentProjectOwnerState,
  createLayerDocumentPreparedRuntimeLifecycle,
  createLayerDocumentSourceRuntimeResolutionStore,
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  prepareLayerDocumentPsdImport,
  prepareLayerDocumentPsdRefresh,
  reduceLayerDocumentProjectOwner,
  type LayerDocumentProjectOwnerEffect,
  type LayerDocumentProjectOwnerPort,
  type LayerDocumentProjectOwnerState,
} from "@/engines/project";
import {
  createLayerDocumentSourceRuntimeResourceCache,
  type LayerDocumentTransformDraftSnapshot,
} from "@/engines/playback-render";
import {
  LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
} from "@/engines/properties/adapters/layerDocumentPanelPreparationAdapter";
import {
  LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
} from "@/engines/drawing";
import {
  LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
} from "@/engines/text";
import {
  LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
} from "@/engines/audio";

function common(
  parentLayerDocumentId: string | null,
  order: number,
  source: LayerSourceReference | null = null
): LayerDocumentCommon {
  return {
    source,
    transform: {
      position: { x: 10 + order, y: 20 + order },
      transformOffset: { x: 0, y: 0 },
      anchor: { x: 50, y: 50 },
      scale: { x: 100, y: 100 },
      scaleLinked: true,
      rotation: 0,
      opacity: 100,
    },
    placement: {
      parentLayerDocumentId,
      order,
      startFrame: 0,
      durationFrames: 120,
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

function animatedCommon(
  parentLayerDocumentId: string | null,
  order: number,
  source: LayerSourceReference | null = null
): LayerDocumentCommon {
  const result = common(
    parentLayerDocumentId,
    order,
    source
  );
  return {
    ...result,
    animation: {
      positionKeyframes: [
        {
          frame: 0,
          value: { x: 90, y: 100 },
        },
        {
          frame: 7,
          value: { x: 170, y: 180 },
        },
      ],
      scaleKeyframes: [{
        frame: 0,
        value: { x: 110, y: 120 },
      }],
      rotationKeyframes: [{ frame: 0, value: 5 }],
      opacityKeyframes: [{ frame: 0, value: 95 }],
      enabledProperties: {
        position: true,
        scale: true,
        rotation: true,
        opacity: true,
      },
    },
  };
}

function normalRefresh() {
  return {
    status: "normal" as const,
  };
}

function psdDocument(
  sourceId: string,
  version = 1,
  fingerprint = `${sourceId}-v${version}`
): PsdDocumentSourceRecord {
  return {
    sourceId,
    kind: "psd-document",
    displayName: `${sourceId}.psd`,
    version,
    refresh: normalRefresh(),
    locator: {
      locatorId: `linked:${sourceId}`,
      kind: "linked-file",
      suggestedFileName: `${sourceId}.psd`,
      relativePathHint: `fixtures/${sourceId}.psd`,
    },
    contentFingerprint: {
      algorithm: "sha-256",
      digestHex: fingerprint.padEnd(64, "0").slice(0, 64)
        .replace(/[^0-9a-f]/g, "a"),
      byteLength: version,
    },
    data: {
      importSettings: {
        compositionName: sourceId,
        hiddenLayerMode: "preserve",
      },
    },
  };
}

function psdNode(options: {
  sourceId: string;
  documentSourceId: string;
  version?: number;
  fingerprint?: string;
}): PsdNodeSourceRecord {
  const version = options.version ?? 1;
  return {
    sourceId: options.sourceId,
    kind: "psd-node",
    displayName: options.sourceId,
    version,
    refresh: normalRefresh(),
    data: {
      documentSourceId: options.documentSourceId,
      sourceKey: `layer:${options.sourceId}`,
      sourcePath: options.sourceId,
      visualFingerprint:
        options.fingerprint ??
        `${options.sourceId}-v${version}`,
    },
  };
}

function projectFixture(): LayerDocumentProject {
  const documentSource = psdDocument("document");
  const nodeSource = psdNode({
    sourceId: "node",
    documentSourceId: documentSource.sourceId,
  });
  const layers: Record<string, LayerDocument> = {
    root: {
      layerDocumentId: "root",
      revision: 0,
      name: "Root",
      type: "group",
      common: common(null, 0),
      data: {
        role: "project-root",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 120,
      },
    },
    psd: {
      layerDocumentId: "psd",
      revision: 2,
      name: "PSD placement",
      type: "psd",
      common: animatedCommon(
        "root",
        0,
        { sourceId: "node" }
      ),
      data: {},
    },
    drawing: {
      layerDocumentId: "drawing",
      revision: 3,
      name: "Drawing placement",
      type: "drawing",
      common: common("root", 1),
      data: {
        documentVersion: 1,
        elements: [{ kind: "stroke", width: 2 }],
      },
    },
    text: {
      layerDocumentId: "text",
      revision: 4,
      name: "Text placement",
      type: "text",
      common: common("root", 2),
      data: {
        text: "Before",
        style: {
          fontFamily: "sans-serif",
          fontSize: 42,
          color: "#ffffff",
        },
      },
    },
    audio: {
      layerDocumentId: "audio",
      revision: 1,
      name: "Audio placement",
      type: "audio",
      common: common("root", 3),
      data: {},
    },
  };
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "cutover-fixture",
      name: "Cutover fixture",
    },
    payload: {
      layerDocumentsById: layers,
      sourceRegistry: {
        sourcesById: {
          [documentSource.sourceId]: documentSource,
          [nodeSource.sourceId]: nodeSource,
        },
      },
    },
  };
}

function flattenRows(
  rows: ReturnType<
    ReturnType<
      typeof createLayerDocumentConsumerCutoverAssembly
    >["timeline"]["readViewProps"]
  >["rows"]
) {
  return rows.flatMap((row) => [
    row,
    ...flattenRows(row.children),
  ]);
}

const initialized = createLayerDocumentProjectOwnerState({
  project: projectFixture(),
  layerSelection: {
    kind: "layer-document",
    layerDocumentId: "psd",
  },
  sourceSelection: {
    kind: "psd-tree-source",
    sourceId: "node",
  },
  playback: {
    currentFrame: 20,
    range: { startFrame: 0, endFrame: 119 },
  },
});
assert.equal(initialized.ok, true);
if (!initialized.ok) throw new Error(initialized.error.message);

let ownerState: LayerDocumentProjectOwnerState =
  initialized.state;
let transitionCallCount = 0;
const owner: LayerDocumentProjectOwnerPort = {
  get state() {
    return ownerState;
  },
  transition: (action) => {
    transitionCallCount += 1;
    const result = reduceLayerDocumentProjectOwner(
      ownerState,
      action
    );
    if (result.ok) ownerState = result.state;
    return result;
  },
};

let draft: LayerDocumentTransformDraftSnapshot | null = null;
let draftPublishCount = 0;
let draftClearCount = 0;
const effects: LayerDocumentProjectOwnerEffect[] = [];
const metricCounts = new Map<string, number>();
const metrics = {
  increment: (counter: string, amount = 1) => {
    metricCounts.set(
      counter,
      (metricCounts.get(counter) ?? 0) + amount
    );
  },
};
const resources =
  createLayerDocumentSourceRuntimeResourceCache({ metrics });
const sourceResolution =
  createLayerDocumentSourceRuntimeResolutionStore();
sourceResolution.setAvailable({ sourceId: "document" });
sourceResolution.setAvailable({ sourceId: "node" });
const assembly = createLayerDocumentConsumerCutoverAssembly({
  owner,
  panelPreparation:
    LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
  sourcePreparation:
    LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  drawingPreparation:
    LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
  textPreparation:
    LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
  audioPreparation:
    LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
  sourceRuntime: resources,
  sourceResolution,
  draftSession: {
    read: () => draft,
    publish: (nextDraft) => {
      draft = nextDraft;
      draftPublishCount += 1;
    },
    clear: () => {
      draft = null;
      draftClearCount += 1;
    },
  },
  effects: {
    applyOwnerEffect: (effect) => {
      effects.push(effect);
    },
  },
  metrics,
});

const initialTimeline = assembly.timeline.readViewProps();
assert.equal(initialTimeline.available, true);
assert.equal(initialTimeline.selectedLayerDocumentId, "psd");
assert.deepEqual(initialTimeline.playbackRange, {
  startFrame: 0,
  endFrame: 119,
});
assert.equal(
  flattenRows(initialTimeline.rows).find(
    (row) => row.layerDocumentId === "psd"
  )?.sourceId,
  "node"
);
assert.equal(
  flattenRows(initialTimeline.rows).find(
    (row) => row.layerDocumentId === "psd"
  )?.source?.resolutionStatus,
  "available"
);
assert.equal(
  assembly.properties.describe().status,
  "ready"
);
assert.equal(
  assembly.sources.readTree().selectedSourceId,
  "node"
);
let callsBefore = transitionCallCount;
const historyBeforePlayback = owner.state.undoStack.length;
const playbackUpdated = assembly.playback.set({
  currentFrame: 21,
  range: { startFrame: 0, endFrame: 119 },
});
assert.equal(playbackUpdated.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(owner.state.undoStack.length, historyBeforePlayback);
assert.deepEqual(assembly.playback.read(), {
  currentFrame: 21,
  range: { startFrame: 0, endFrame: 119 },
});
assert.equal(
  assembly.playback.set({
    currentFrame: 20,
    range: { startFrame: 0, endFrame: 119 },
  }).ok,
  true
);

const importDocument = psdDocument("import-document");
const importNode = psdNode({
  sourceId: "import-node",
  documentSourceId: importDocument.sourceId,
});
const importedLayer: LayerDocument = {
  layerDocumentId: "import-layer",
  revision: 0,
  name: "Imported placement",
  type: "psd",
  common: common("root", 4, {
    sourceId: importNode.sourceId,
  }),
  data: {},
};
callsBefore = transitionCallCount;
const imported = assembly.sources.importSources({
  sources: [importDocument, importNode],
  layers: [importedLayer],
  selectSourceId: importNode.sourceId,
  selectLayerDocumentId: importedLayer.layerDocumentId,
});
assert.equal(imported.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(
  assembly.sources.readTree().selectedSourceId,
  importNode.sourceId
);
assert.equal(
  assembly.sources.readTree().documents.some(
    (document) =>
      document.sourceId === importDocument.sourceId &&
      document.children.some(
        (child) => child.sourceId === importNode.sourceId
      )
  ),
  true
);
assert.equal(
  flattenRows(
    assembly.timeline.readViewProps().rows
  ).some((row) => row.layerDocumentId === "import-layer"),
  true
);

const confirmedDocument = psdDocument("confirmed-document");
const confirmedNode = psdNode({
  sourceId: "confirmed-node",
  documentSourceId: confirmedDocument.sourceId,
});
const confirmedLayer: LayerDocument = {
  layerDocumentId: "confirmed-layer",
  revision: 0,
  name: "Confirmed placement",
  type: "psd",
  common: common("root", 5, {
    sourceId: confirmedNode.sourceId,
  }),
  data: {},
};
let failedPreparedDisposeCount = 0;
let confirmedPreparedDisposeCount = 0;
const confirmedRuntimeKey = "confirmed-static-visual-key";
callsBefore = transitionCallCount;
const historyBeforeConfirmedImport = owner.state.undoStack.length;
const confirmedPreparedInput = {
    fileName: "confirmed.psd",
    width: 640,
    height: 360,
    groupCount: 0,
    layerCount: 1,
    command: {
      sources: [confirmedDocument, confirmedNode],
      layers: [confirmedLayer],
      selectSourceId: confirmedNode.sourceId,
      selectLayerDocumentId: confirmedLayer.layerDocumentId,
    },
    resolution: {
      documentSourceId: confirmedDocument.sourceId,
      sourceIds: [
        confirmedDocument.sourceId,
        confirmedNode.sourceId,
      ],
      file: new File([], "confirmed.psd"),
    },
    runtime: createLayerDocumentPreparedRuntimeLifecycle([{
      sourceId: confirmedNode.sourceId,
      sourceResourceCacheKey: confirmedRuntimeKey,
      resolution: {
        renderItemId: "confirmed-runtime",
        drawableId: "confirmed-drawable",
        logicalSize: { width: 640, height: 360 },
      },
      resource: {
        runtimeOnlyCanvas: true,
        draw: () => undefined,
      },
      dispose: () => {
        confirmedPreparedDisposeCount += 1;
      },
    }]),
  };
const confirmedPrepared =
  assembly.sources.confirmPreparedPsdImport(
    confirmedPreparedInput
  );
assert.equal(confirmedPrepared.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeConfirmedImport + 1
);
assert.equal(confirmedPreparedDisposeCount, 0);
assert.ok(
  resources.resolve({
    sourceId: confirmedNode.sourceId,
    sourceResourceCacheKey: confirmedRuntimeKey,
  })
);
callsBefore = transitionCallCount;
const historyBeforeDoubleConfirm = owner.state.undoStack.length;
const confirmedAgain =
  assembly.sources.confirmPreparedPsdImport(
    confirmedPreparedInput
  );
assert.equal(confirmedAgain.ok, false);
assert.equal(transitionCallCount, callsBefore);
assert.equal(owner.state.undoStack.length, historyBeforeDoubleConfirm);
assert.equal(confirmedPreparedDisposeCount, 0);
const cancelAfterSuccess =
  assembly.sources.cancelPreparedPsdImport(
    confirmedPreparedInput
  );
assert.equal(cancelAfterSuccess.changed, false);
assert.equal(cancelAfterSuccess.disposedCount, 0);
assert.equal(confirmedPreparedDisposeCount, 0);
assert.ok(
  resources.resolve({
    sourceId: confirmedNode.sourceId,
    sourceResourceCacheKey: confirmedRuntimeKey,
  })
);
assert.equal(findNonPlainDataPath(assembly.project.read()), null);
assert.doesNotMatch(
  JSON.stringify(assembly.project.read()),
  /runtimeOnlyCanvas|\bdraw\b/
);

callsBefore = transitionCallCount;
const historyBeforeFailedConfirm = owner.state.undoStack.length;
const failedRuntime = createLayerDocumentPreparedRuntimeLifecycle([{
  sourceId: "failed-runtime",
  sourceResourceCacheKey: "failed-runtime-key",
  resolution: {
    renderItemId: "failed-runtime",
    drawableId: "failed-runtime",
    logicalSize: { width: 1, height: 1 },
  },
  resource: {},
  dispose: () => {
    failedPreparedDisposeCount += 1;
  },
}]);
const failedPrepared =
  assembly.sources.confirmPreparedPsdImport({
    fileName: "duplicate.psd",
    width: 1,
    height: 1,
    groupCount: 0,
    layerCount: 0,
    command: {
      sources: [confirmedDocument],
      layers: [],
      selectSourceId: confirmedDocument.sourceId,
      selectLayerDocumentId: null,
    },
    resolution: {
      documentSourceId: confirmedDocument.sourceId,
      sourceIds: [confirmedDocument.sourceId],
      file: new File([], "duplicate.psd"),
    },
    runtime: failedRuntime,
  });
assert.equal(failedPrepared.ok, false);
assert.equal(transitionCallCount, callsBefore);
assert.equal(owner.state.undoStack.length, historyBeforeFailedConfirm);
assert.equal(failedPreparedDisposeCount, 1);

let cancelledPreparedDisposeCount = 0;
callsBefore = transitionCallCount;
const projectBeforeCancel = assembly.project.read();
const cancelledPreparedInput = {
  fileName: "cancelled.psd",
  width: 1,
  height: 1,
  groupCount: 0,
  layerCount: 0,
  command: {
    sources: [psdDocument("cancelled-document")],
    layers: [],
    selectSourceId: "cancelled-document",
    selectLayerDocumentId: null,
  },
  resolution: {
    documentSourceId: "cancelled-document",
    sourceIds: ["cancelled-document"],
    file: new File([], "cancelled.psd"),
  },
  runtime: createLayerDocumentPreparedRuntimeLifecycle([
    {
      sourceId: "cancelled-runtime-throws",
      sourceResourceCacheKey: "cancelled-runtime-key-throws",
      resolution: {
        renderItemId: "cancelled-runtime-throws",
        drawableId: "cancelled-runtime-throws",
        logicalSize: { width: 1, height: 1 },
      },
      resource: {},
      dispose: () => {
        throw new Error("expected prepared disposal failure");
      },
    },
    {
      sourceId: "cancelled-runtime",
      sourceResourceCacheKey: "cancelled-runtime-key",
      resolution: {
        renderItemId: "cancelled-runtime",
        drawableId: "cancelled-runtime",
        logicalSize: { width: 1, height: 1 },
      },
      resource: {},
      dispose: () => {
        cancelledPreparedDisposeCount += 1;
      },
    },
  ]),
};
const firstCancel =
  assembly.sources.cancelPreparedPsdImport(
    cancelledPreparedInput
  );
const secondCancel =
  assembly.sources.cancelPreparedPsdImport(
    cancelledPreparedInput
  );
assert.equal(firstCancel.disposedCount, 2);
assert.equal(secondCancel.disposedCount, 0);
assert.equal(cancelledPreparedDisposeCount, 1);
assert.equal(transitionCallCount, callsBefore);
assert.strictEqual(assembly.project.read(), projectBeforeCancel);

const batchEntry = (
  sourceId: string,
  key: string,
  onDispose: () => void
) => ({
  sourceId,
  sourceResourceCacheKey: key,
  resolution: {
    renderItemId: `runtime:${sourceId}`,
    drawableId: `drawable:${sourceId}`,
    logicalSize: { width: 10, height: 10 },
  },
  resource: { sourceId },
  dispose: onDispose,
});
let firstFailureDisposeCount = 0;
const firstFailureCache =
  createLayerDocumentSourceRuntimeResourceCache({
    registrationFailureInjection: (_entry, index) => index === 0,
  });
const firstFailureEntries = [
  batchEntry("first-a", "key-a", () => {
    firstFailureDisposeCount += 1;
  }),
  batchEntry("first-b", "key-b", () => {
    firstFailureDisposeCount += 1;
  }),
];
const firstBatchFailure =
  firstFailureCache.registerBatch(firstFailureEntries);
assert.equal(firstBatchFailure.ok, false);
assert.equal(firstBatchFailure.registeredCount, 0);
assert.equal(
  firstFailureCache.resolve({
    sourceId: "first-a",
    sourceResourceCacheKey: "key-a",
  }),
  null
);
assert.equal(
  firstFailureCache.resolve({
    sourceId: "first-b",
    sourceResourceCacheKey: "key-b",
  }),
  null
);
assert.equal(firstFailureDisposeCount, 0);
firstFailureCache.dispose();

let safeDisposeCount = 0;
const safeDisposeCache =
  createLayerDocumentSourceRuntimeResourceCache();
assert.equal(
  safeDisposeCache.registerBatch([
    batchEntry("dispose-throws", "dispose-key-a", () => {
      throw new Error("expected dispose failure");
    }),
    batchEntry("dispose-completes", "dispose-key-b", () => {
      safeDisposeCount += 1;
    }),
  ]).ok,
  true
);
safeDisposeCache.dispose();
assert.equal(safeDisposeCount, 1);
assert.equal(
  safeDisposeCache.resolve({
    sourceId: "dispose-completes",
    sourceResourceCacheKey: "dispose-key-b",
  }),
  null
);

let middleFailureIndex: number | null = 1;
let pendingDisposeCount = 0;
const pendingResources =
  createLayerDocumentSourceRuntimeResourceCache({
    registrationFailureInjection: (_entry, index) =>
      index === middleFailureIndex,
  });
const pendingInitialized = createLayerDocumentProjectOwnerState({
  project: projectFixture(),
});
assert.equal(pendingInitialized.ok, true);
if (!pendingInitialized.ok) {
  throw new Error(pendingInitialized.error.message);
}
let pendingOwnerState = pendingInitialized.state;
let pendingTransitionCount = 0;
const pendingOwner: LayerDocumentProjectOwnerPort = {
  get state() {
    return pendingOwnerState;
  },
  transition: (action) => {
    pendingTransitionCount += 1;
    const result = reduceLayerDocumentProjectOwner(
      pendingOwnerState,
      action
    );
    if (result.ok) pendingOwnerState = result.state;
    return result;
  },
};
const pendingAssembly =
  createLayerDocumentConsumerCutoverAssembly({
    owner: pendingOwner,
    panelPreparation: LAYER_DOCUMENT_PANEL_PREPARATION_PORT,
    sourcePreparation: LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
    drawingPreparation: LAYER_DOCUMENT_DRAWING_PREPARATION_PORT,
    textPreparation: LAYER_DOCUMENT_TEXT_PREPARATION_PORT,
    audioPreparation: LAYER_DOCUMENT_AUDIO_PREPARATION_PORT,
    sourceRuntime: pendingResources,
    sourceResolution:
      createLayerDocumentSourceRuntimeResolutionStore(),
    draftSession: {
      read: () => null,
      publish: () => undefined,
      clear: () => undefined,
    },
    effects: { applyOwnerEffect: () => undefined },
    metrics: { increment: () => undefined },
  });
const pendingDocument = psdDocument("pending-document");
const pendingNodeA = psdNode({
  sourceId: "pending-node-a",
  documentSourceId: pendingDocument.sourceId,
});
const pendingNodeB = psdNode({
  sourceId: "pending-node-b",
  documentSourceId: pendingDocument.sourceId,
});
const pendingPrepared = {
  fileName: "pending.psd",
  width: 10,
  height: 10,
  groupCount: 0,
  layerCount: 2,
  command: {
    sources: [pendingDocument, pendingNodeA, pendingNodeB],
    layers: [
      {
        layerDocumentId: "pending-layer-a",
        revision: 0,
        name: "Pending A",
        type: "psd" as const,
        common: common("root", 4, {
          sourceId: pendingNodeA.sourceId,
        }),
        data: {},
      },
      {
        layerDocumentId: "pending-layer-b",
        revision: 0,
        name: "Pending B",
        type: "psd" as const,
        common: common("root", 5, {
          sourceId: pendingNodeB.sourceId,
        }),
        data: {},
      },
    ],
    selectSourceId: pendingNodeA.sourceId,
    selectLayerDocumentId: "pending-layer-a",
  },
  resolution: {
    documentSourceId: pendingDocument.sourceId,
    sourceIds: [
      pendingDocument.sourceId,
      pendingNodeA.sourceId,
      pendingNodeB.sourceId,
    ],
    file: new File([], "pending.psd"),
  },
  runtime: createLayerDocumentPreparedRuntimeLifecycle([
    batchEntry("pending-node-a", "pending-key-a", () => {
      pendingDisposeCount += 1;
    }),
    batchEntry("pending-node-b", "pending-key-b", () => {
      pendingDisposeCount += 1;
    }),
  ]),
};
const pendingFirstConfirm =
  pendingAssembly.sources.confirmPreparedPsdImport(
    pendingPrepared
  );
assert.equal(pendingFirstConfirm.ok, false);
assert.equal(
  pendingFirstConfirm.ok ? null : pendingFirstConfirm.stage,
  "runtime-registration"
);
assert.equal(
  pendingFirstConfirm.ok ? null : pendingFirstConfirm.recovery,
  "retry-runtime-registration"
);
assert.equal(pendingTransitionCount, 1);
assert.equal(pendingOwner.state.undoStack.length, 1);
assert.equal(
  pendingPrepared.runtime.readState(),
  "runtime-registration-pending"
);
assert.equal(pendingDisposeCount, 0);
assert.equal(
  pendingResources.resolve({
    sourceId: "pending-node-a",
    sourceResourceCacheKey: "pending-key-a",
  }),
  null
);
assert.equal(
  pendingResources.resolve({
    sourceId: "pending-node-b",
    sourceResourceCacheKey: "pending-key-b",
  }),
  null
);
middleFailureIndex = null;
const pendingRetry =
  pendingAssembly.sources.confirmPreparedPsdImport(
    pendingPrepared
  );
assert.equal(pendingRetry.ok, true);
assert.equal(
  pendingRetry.ok ? pendingRetry.status : null,
  "runtime-registration-retried"
);
assert.equal(pendingTransitionCount, 1);
assert.equal(pendingOwner.state.undoStack.length, 1);
assert.equal(pendingPrepared.runtime.readState(), "transferred");
assert.equal(
  pendingAssembly.sources
    .cancelPreparedPsdImport(pendingPrepared).disposedCount,
  0
);
assert.ok(
  pendingResources.resolve({
    sourceId: "pending-node-a",
    sourceResourceCacheKey: "pending-key-a",
  })
);
pendingResources.dispose();
assert.equal(pendingDisposeCount, 2);

function parsedPsdFixture(canvas: {
  width: number;
  height: number;
  getContext: () => null;
}) {
  const nestedCanvas = {
    width: 48,
    height: 36,
    getContext: () => null,
  };
  return {
    width: 320,
    height: 180,
    children: [
      {
        id: 77,
        name: "Duplicate",
        left: 12,
        top: 18,
        opacity: 255,
        canvas,
      },
      {
        id: 77,
        name: "Duplicate",
        children: [{
          id: 91,
          name: "Nested Pixel",
          left: 4,
          top: 6,
          opacity: 255,
          canvas: nestedCanvas,
        }],
      },
    ],
  };
}

const parsedFile = new File(
  [new Uint8Array([1, 2, 3])],
  "parsed.psd"
);
const parsedCanvas = {
  width: 96,
  height: 54,
  getContext: () => null,
};
const parsedPrepared = await prepareLayerDocumentPsdImport({
  file: parsedFile,
  token: "parsed-token",
  parentLayerDocumentId: "root",
  order: 6,
  durationFrames: 120,
  parsePsd: async () => parsedPsdFixture(parsedCanvas),
});
assert.equal(findNonPlainDataPath(parsedPrepared.command), null);
assert.notEqual(findNonPlainDataPath(parsedPrepared), null);
assert.equal(parsedPrepared.command.sources.length, 4);
assert.equal(parsedPrepared.command.layers.length, 4);
assert.equal(parsedPrepared.runtime.readResourceCount(), 2);
const parsedSourceKeys = parsedPrepared.command.sources.flatMap(
  (source) =>
    source.kind === "psd-node"
      ? [source.data.sourceKey]
      : []
);
assert.equal(new Set(parsedSourceKeys).size, 3);
assert.equal(
  parsedSourceKeys.every((key) => key.startsWith("legacy-tree:")),
  false,
  "Only duplicate PSD IDs fall back to tree identity"
);
assert.equal(
  parsedSourceKeys.filter((key) =>
    key.startsWith("legacy-tree:")
  ).length,
  2
);
const parsedCompositionId =
  parsedPrepared.command.selectLayerDocumentId;
const parsedGroup = parsedPrepared.command.layers.find(
  (layer) =>
    layer.type === "group" &&
    layer.layerDocumentId !== parsedCompositionId
);
assert.ok(parsedGroup);
const parsedRootLeaf = parsedPrepared.command.layers.find(
  (layer) =>
    layer.type === "psd" &&
    layer.common.placement.parentLayerDocumentId ===
      parsedCompositionId
);
const parsedNestedLeaf = parsedPrepared.command.layers.find(
  (layer) =>
    layer.type === "psd" &&
    layer.common.placement.parentLayerDocumentId ===
      parsedGroup?.layerDocumentId
);
assert.equal(parsedGroup?.common.placement.order, 0);
assert.equal(parsedRootLeaf?.common.placement.order, 1);
assert.equal(parsedNestedLeaf?.common.placement.order, 0);
callsBefore = transitionCallCount;
const historyBeforeParsedConfirm = owner.state.undoStack.length;
const parsedConfirmed =
  assembly.sources.confirmPreparedPsdImport(parsedPrepared);
assert.equal(parsedConfirmed.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeParsedConfirm + 1
);
const parsedCanvasView = assembly.canvas.readViewProps({
  quality: "original",
  rendererMode: "full-render",
});
assert.equal(parsedCanvasView.runtime.ok, true);
if (!parsedCanvasView.runtime.ok) {
  throw new Error(parsedCanvasView.runtime.reason);
}
const parsedRuntimeInput =
  parsedCanvasView.runtime.model.inputs.find(
    (input) =>
      input.content.kind === "drawable" &&
      parsedPrepared.command.sources.some(
        (source) =>
          source.kind === "psd-node" &&
          source.sourceId === input.sourceId
      )
  );
assert.equal(parsedRuntimeInput?.content.kind, "drawable");
assert.equal(parsedCanvas.width, 96);
assert.deepEqual(validateLayerDocumentProject(assembly.project.read()), []);
const parsedDocumentSource =
  parsedPrepared.command.sources.find(
    (source) => source.kind === "psd-document"
  );
assert.equal(parsedDocumentSource?.kind, "psd-document");
if (!parsedDocumentSource || parsedDocumentSource.kind !== "psd-document") {
  throw new Error("Parsed document Source missing");
}
const refreshCanvas = {
  width: 96,
  height: 54,
  getContext: () => null,
};
const preparedRefresh = await prepareLayerDocumentPsdRefresh({
  file: parsedFile,
  documentSource: parsedDocumentSource,
  existingSources: Object.values(
    assembly.project.read().payload.sourceRegistry.sourcesById
  ),
  parsePsd: async () => parsedPsdFixture(refreshCanvas),
});
assert.equal(findNonPlainDataPath(preparedRefresh.command), null);
assert.notEqual(findNonPlainDataPath(preparedRefresh), null);
callsBefore = transitionCallCount;
const refreshConfirmed =
  assembly.sources.confirmPreparedPsdRefresh(
    preparedRefresh,
    {
      globalFrame: 20,
      localFrameByLayerDocumentId: {},
      quality: "original",
    }
  );
assert.equal(refreshConfirmed.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(owner.state.undoStack.length, 0);
assert.equal(preparedRefresh.runtime.readState(), "transferred");
assert.equal(parsedCanvas.width, 0);
assert.equal(parsedCanvas.height, 0);
const refreshCancelAfterSuccess =
  assembly.sources.cancelPreparedPsdRefresh(preparedRefresh);
assert.equal(refreshCancelAfterSuccess.disposedCount, 0);
const refreshConfirmAgain =
  assembly.sources.confirmPreparedPsdRefresh(
    preparedRefresh,
    {
      globalFrame: 20,
      localFrameByLayerDocumentId: {},
      quality: "original",
    }
  );
assert.equal(refreshConfirmAgain.ok, false);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(refreshCanvas.width, 96);

const latestParsedDocument =
  assembly.project.read().payload.sourceRegistry.sourcesById[
    parsedDocumentSource.sourceId
  ];
assert.equal(latestParsedDocument?.kind, "psd-document");
if (!latestParsedDocument || latestParsedDocument.kind !== "psd-document") {
  throw new Error("Refreshed document Source missing");
}
const cancelledRefreshCanvas = {
  width: 90,
  height: 50,
  getContext: () => null,
};
const cancelledRefresh = await prepareLayerDocumentPsdRefresh({
  file: parsedFile,
  documentSource: latestParsedDocument,
  existingSources: Object.values(
    assembly.project.read().payload.sourceRegistry.sourcesById
  ),
  parsePsd: async () => parsedPsdFixture(cancelledRefreshCanvas),
});
const firstRefreshCancel =
  assembly.sources.cancelPreparedPsdRefresh(cancelledRefresh);
const secondRefreshCancel =
  assembly.sources.cancelPreparedPsdRefresh(cancelledRefresh);
assert.equal(firstRefreshCancel.disposedCount, 2);
assert.equal(secondRefreshCancel.disposedCount, 0);
assert.equal(cancelledRefreshCanvas.width, 0);

const cancelledCanvas = {
  width: 40,
  height: 30,
  getContext: () => null,
};
const cancelledParsed = await prepareLayerDocumentPsdImport({
  file: parsedFile,
  token: "cancelled-parsed-token",
  parentLayerDocumentId: "root",
  order: 7,
  durationFrames: 120,
  parsePsd: async () => parsedPsdFixture(cancelledCanvas),
});
callsBefore = transitionCallCount;
const historyBeforeParsedCancel = owner.state.undoStack.length;
assembly.sources.cancelPreparedPsdImport(cancelledParsed);
assert.equal(transitionCallCount, callsBefore);
assert.equal(owner.state.undoStack.length, historyBeforeParsedCancel);
assert.equal(cancelledCanvas.width, 0);
assert.equal(cancelledCanvas.height, 0);

const failedCanvas = {
  width: 50,
  height: 35,
  getContext: () => null,
};
const duplicateParsed = await prepareLayerDocumentPsdImport({
  file: parsedFile,
  token: "parsed-token",
  parentLayerDocumentId: "root",
  order: 6,
  durationFrames: 120,
  parsePsd: async () => parsedPsdFixture(failedCanvas),
});
assert.deepEqual(
  duplicateParsed.command.sources.map((source) => source.sourceId),
  parsedPrepared.command.sources.map((source) => source.sourceId)
);
assert.deepEqual(
  duplicateParsed.command.layers.map((layer) => ({
    id: layer.layerDocumentId,
    parent: layer.common.placement.parentLayerDocumentId,
    order: layer.common.placement.order,
  })),
  parsedPrepared.command.layers.map((layer) => ({
    id: layer.layerDocumentId,
    parent: layer.common.placement.parentLayerDocumentId,
    order: layer.common.placement.order,
  }))
);
callsBefore = transitionCallCount;
const historyBeforeParsedFailure = owner.state.undoStack.length;
const parsedFailure =
  assembly.sources.confirmPreparedPsdImport(duplicateParsed);
assert.equal(parsedFailure.ok, false);
assert.equal(transitionCallCount, callsBefore);
assert.equal(owner.state.undoStack.length, historyBeforeParsedFailure);
assert.equal(failedCanvas.width, 0);
assert.equal(failedCanvas.height, 0);

assert.equal(assembly.selection.selectLayer("psd").ok, true);
const beforeDuplicateRevision =
  assembly.project.read().payload.layerDocumentsById.psd
    .revision;
callsBefore = transitionCallCount;
const duplicated = assembly.timeline.dispatchIntent({
  kind: "duplicate-layer",
  layerDocumentId: "psd",
  newLayerDocumentId: "psd-copy",
});
assert.equal(duplicated.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
const duplicateProject = assembly.project.read();
assert.equal(
  duplicateProject.payload.layerDocumentsById.psd.common.source
    ?.sourceId,
  "node"
);
assert.equal(
  duplicateProject.payload.layerDocumentsById["psd-copy"]
    .common.source?.sourceId,
  "node"
);
assert.equal(
  assembly.timeline.readViewProps().selectedLayerDocumentId,
  "psd-copy"
);

let canvas = assembly.canvas.readViewProps({
  quality: "preview",
  rendererMode: "fast-render",
});
assert.equal(canvas.runtime.ok, true);
if (!canvas.runtime.ok) {
  throw new Error(canvas.runtime.reason);
}
const copyInputBeforeDraft = canvas.runtime.model.inputs.find(
  (input) => input.layerDocumentId === "psd-copy"
);
assert.ok(copyInputBeforeDraft?.sourceResourceCacheKey);
let disposedResourceCount = 0;
const canvasRuntimeResource = {
  runtimeOnly: true,
};
assembly.runtime.registrationBridge.registerResources([{
  sourceId: "node",
  sourceResourceCacheKey:
    copyInputBeforeDraft.sourceResourceCacheKey,
  resolution: {
    renderItemId: "runtime-node",
    drawableId: "runtime-drawable",
    logicalSize: { width: 320, height: 180 },
  },
  resource: canvasRuntimeResource,
  dispose: () => {
    disposedResourceCount += 1;
  },
}]);
assert.doesNotMatch(
  JSON.stringify(owner.state.currentProject),
  /runtimeOnly/
);
assert.doesNotMatch(
  JSON.stringify(owner.state.undoStack),
  /runtimeOnly/
);
assert.doesNotMatch(
  JSON.stringify(owner.state),
  /runtimeOnly/
);
canvas = assembly.canvas.readViewProps({
  quality: "preview",
  rendererMode: "fast-render",
});
assert.equal(canvas.selectedLayerDocumentId, "psd-copy");
assert.equal(canvas.runtime.ok, true);
if (!canvas.runtime.ok) {
  throw new Error(canvas.runtime.reason);
}
assert.equal(
  canvas.runtime.model.inputs.find(
    (input) => input.layerDocumentId === "psd-copy"
  )?.content.kind,
  "drawable"
);

const historyBeforeDraft = owner.state.undoStack.length;
const projectBeforeDraft = assembly.project.read();
const copyTransformBeforeDraft = structuredClone(
  projectBeforeDraft.payload.layerDocumentsById["psd-copy"]
    .common.transform
);
const copyAnimationBeforeDraft = structuredClone(
  projectBeforeDraft.payload.layerDocumentsById["psd-copy"]
    .common.animation
);
callsBefore = transitionCallCount;
const pointerMove = assembly.canvas.pointerMove({
  layerDocumentId: "psd-copy",
  quality: "preview",
  patch: {
    position: { x: 333, y: 444 },
    scale: { x: 155, y: 166 },
    rotation: 27,
    opacity: 55,
    anchor: { x: 40, y: 60 },
    transformOffset: { x: 7, y: 8 },
  },
});
assert.equal(pointerMove?.kind, "pointer-move");
assert.equal(transitionCallCount, callsBefore);
assert.strictEqual(assembly.project.read(), projectBeforeDraft);
assert.equal(owner.state.undoStack.length, historyBeforeDraft);
assert.equal(draftPublishCount, 1);
assert.ok(draft);
canvas = assembly.canvas.readViewProps({
  quality: "preview",
  rendererMode: "fast-render",
});
assert.equal(canvas.runtime.ok, true);
if (!canvas.runtime.ok) {
  throw new Error(canvas.runtime.reason);
}
assert.deepEqual(
  canvas.runtime.model.inputs.find(
    (input) => input.layerDocumentId === "psd-copy"
  )?.evaluatedTransform.position,
  { x: 333, y: 444 }
);

callsBefore = transitionCallCount;
const pointerUp = assembly.canvas.pointerUp();
assert.equal(pointerUp.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(draft, null);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeDraft + 1
);
const committedCopy =
  assembly.project.read().payload.layerDocumentsById[
    "psd-copy"
  ];
assert.deepEqual(committedCopy.common.transform, {
  ...copyTransformBeforeDraft,
  anchor: { x: 40, y: 60 },
  transformOffset: { x: 7, y: 8 },
});
assert.deepEqual(
  committedCopy.common.animation.positionKeyframes,
  [
    ...copyAnimationBeforeDraft.positionKeyframes,
    { frame: 20, value: { x: 333, y: 444 } },
  ]
);
assert.deepEqual(
  committedCopy.common.animation.scaleKeyframes,
  [
    ...copyAnimationBeforeDraft.scaleKeyframes,
    { frame: 20, value: { x: 155, y: 166 } },
  ]
);
assert.deepEqual(
  committedCopy.common.animation.rotationKeyframes,
  [
    ...copyAnimationBeforeDraft.rotationKeyframes,
    { frame: 20, value: 27 },
  ]
);
assert.deepEqual(
  committedCopy.common.animation.opacityKeyframes,
  [
    ...copyAnimationBeforeDraft.opacityKeyframes,
    { frame: 20, value: 55 },
  ]
);
const canvasAfterAnimatedCommit =
  assembly.canvas.readViewProps({
    quality: "preview",
    rendererMode: "fast-render",
  });
assert.equal(canvasAfterAnimatedCommit.runtime.ok, true);
if (!canvasAfterAnimatedCommit.runtime.ok) {
  throw new Error(canvasAfterAnimatedCommit.runtime.reason);
}
const committedRuntimeInput =
  canvasAfterAnimatedCommit.runtime.model.inputs.find(
    (input) => input.layerDocumentId === "psd-copy"
  );
assert.deepEqual(
  committedRuntimeInput?.evaluatedTransform.position,
  { x: 333, y: 444 }
);
assert.deepEqual(
  committedRuntimeInput?.evaluatedTransform.scale,
  { x: 155, y: 166 }
);
assert.equal(
  committedRuntimeInput?.evaluatedTransform.rotation,
  27
);
assert.equal(committedRuntimeInput?.opacity, 55);
assert.equal(assembly.project.undo().ok, true);
assert.deepEqual(
  assembly.project.read().payload.layerDocumentsById[
    "psd-copy"
  ].common.animation,
  copyAnimationBeforeDraft
);
assert.equal(owner.state.undoStack.length, historyBeforeDraft);
assert.equal(assembly.project.redo().ok, true);
assert.deepEqual(
  assembly.project.read().payload.layerDocumentsById[
    "psd-copy"
  ].common.animation,
  committedCopy.common.animation
);
assert.equal(disposedResourceCount, 0);
assert.ok(
  resources.resolve({
    sourceId: "node",
    sourceResourceCacheKey:
      copyInputBeforeDraft
        .sourceResourceCacheKey,
  })
);

const historyBeforeMotionPathDraft =
  owner.state.undoStack.length;
const projectBeforeMotionPathDraft =
  assembly.project.read();
const nativeCanvasCommands =
  createLayerDocumentCanvasCommands({
    selectedLayerDocumentId: "psd-copy",
    quality: "preview",
    port: createLayerDocumentCanvasCutoverCommandPort({
      assembly,
      quality: "preview",
    }),
  });
const motionPathBeforeDraft =
  assembly.canvas.readViewProps({
    quality: "preview",
    rendererMode: "fast-render",
  });
assert.equal(motionPathBeforeDraft.runtime.ok, true);
if (!motionPathBeforeDraft.runtime.ok) {
  throw new Error(motionPathBeforeDraft.runtime.reason);
}
assert.equal(
  motionPathBeforeDraft.runtime.model.scene.globalFrame,
  20
);
const originalFrameSevenSample =
  motionPathBeforeDraft.runtime.model.targets
    .find(
      (target) =>
        target.layerDocumentId === "psd-copy"
    )
    ?.motionPath.samples.find(
      (sample) => sample.frame === 7
    );
assert.ok(originalFrameSevenSample);
const historyBeforeKeyframeSelection =
  owner.state.undoStack.length;
const projectBeforeKeyframeSelection =
  assembly.project.read();
callsBefore = transitionCallCount;
const keyframeSelection =
  nativeCanvasCommands.selectMotionPathKeyframe({
    layerDocumentId: "psd-copy",
    globalFrame: 7,
    localFrame: 7,
  });
assert.equal(keyframeSelection.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.strictEqual(
  assembly.project.read(),
  projectBeforeKeyframeSelection
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeKeyframeSelection
);
assert.doesNotMatch(
  JSON.stringify(owner.state.undoStack),
  /selectedTransformKeyframe/
);
assert.deepEqual(
  owner.state.runtimeSession
    .selectedTransformKeyframe,
  {
    layerDocumentId: "psd-copy",
    property: "position",
    localFrame: 7,
    globalFrame: 7,
  }
);
assert.deepEqual(
  assembly.canvas.readViewProps({
    quality: "preview",
    rendererMode: "fast-render",
  }).selectedTransformKeyframe,
  owner.state.runtimeSession
    .selectedTransformKeyframe
);
callsBefore = transitionCallCount;
const motionPathMove =
  nativeCanvasCommands.publishMotionPathKeyframeDraft({
    kind: "upsert-position-keyframe",
    layerDocumentId: "psd-copy",
    globalFrame: 7,
    localFrame: 7,
    value: { x: 777, y: 888 },
  });
assert.equal(
  motionPathMove?.kind,
  "motion-path-keyframe-draft"
);
assert.equal(transitionCallCount, callsBefore);
assert.strictEqual(
  assembly.project.read(),
  projectBeforeMotionPathDraft
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeMotionPathDraft
);
assert.equal(draft?.globalFrame, 7);
assert.equal(draft?.localFrame, 7);
const motionPathDuringDraft =
  assembly.canvas.readViewProps({
    quality: "preview",
    rendererMode: "fast-render",
  });
assert.equal(motionPathDuringDraft.runtime.ok, true);
if (!motionPathDuringDraft.runtime.ok) {
  throw new Error(motionPathDuringDraft.runtime.reason);
}
assert.equal(
  motionPathDuringDraft.runtime.model.scene.globalFrame,
  20
);
assert.deepEqual(
  motionPathDuringDraft.runtime.model.targets
    .find(
      (target) =>
        target.layerDocumentId === "psd-copy"
    )
    ?.motionPath.samples.find(
      (sample) => sample.frame === 7
    )?.position,
  { x: 777, y: 888 }
);
nativeCanvasCommands
  .cancelMotionPathKeyframeDraft();
assert.strictEqual(
  assembly.project.read(),
  projectBeforeMotionPathDraft
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeMotionPathDraft
);
const motionPathAfterCancel =
  assembly.canvas.readViewProps({
    quality: "preview",
    rendererMode: "fast-render",
  });
assert.equal(motionPathAfterCancel.runtime.ok, true);
if (!motionPathAfterCancel.runtime.ok) {
  throw new Error(motionPathAfterCancel.runtime.reason);
}
assert.deepEqual(
  motionPathAfterCancel.runtime.model.targets
    .find(
      (target) =>
        target.layerDocumentId === "psd-copy"
    )
    ?.motionPath.samples.find(
      (sample) => sample.frame === 7
    )?.position,
  originalFrameSevenSample.position
);
assert.equal(assembly.playback.read().currentFrame, 20);

assert.equal(
  nativeCanvasCommands.publishMotionPathKeyframeDraft({
    kind: "upsert-position-keyframe",
    layerDocumentId: "psd-copy",
    globalFrame: 7,
    localFrame: 7,
    value: { x: 777, y: 888 },
  })?.kind,
  "motion-path-keyframe-draft"
);
callsBefore = transitionCallCount;
const motionPathCommit =
  nativeCanvasCommands
    .commitMotionPathKeyframeDraft();
assert.equal(motionPathCommit.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeMotionPathDraft + 1
);
assert.deepEqual(
  assembly.project.read().payload.layerDocumentsById[
    "psd-copy"
  ].common.animation.positionKeyframes.find(
    (keyframe) => keyframe.frame === 7
  ),
  { frame: 7, value: { x: 777, y: 888 } }
);
assert.doesNotMatch(
  JSON.stringify(owner.state.currentProject),
  /runtimeOnly/
);
assert.doesNotMatch(
  JSON.stringify(owner.state.undoStack),
  /runtimeOnly|selectedTransformKeyframe/
);

assert.equal(
  assembly.selection.selectLayer("drawing").ok,
  true
);
const disabledTrackProjectBefore =
  assembly.project.read();
const disabledTrackLayerBefore =
  disabledTrackProjectBefore.payload
    .layerDocumentsById.drawing;
const disabledTrackBasePosition =
  structuredClone(
    disabledTrackLayerBefore.common.transform.position
  );
const disabledTrackAnimationBefore =
  structuredClone(
    disabledTrackLayerBefore.common.animation
  );
assert.equal(
  disabledTrackAnimationBefore
    .enabledProperties.position,
  false
);
assert.equal(
  disabledTrackAnimationBefore.positionKeyframes
    .some((keyframe) => keyframe.frame === 9),
  false
);
const disabledTrackCommands =
  createLayerDocumentCanvasCommands({
    selectedLayerDocumentId: "drawing",
    quality: "preview",
    port: createLayerDocumentCanvasCutoverCommandPort({
      assembly,
      quality: "preview",
    }),
  });
const historyBeforeDisabledTrackDraft =
  owner.state.undoStack.length;
callsBefore = transitionCallCount;
assert.equal(
  disabledTrackCommands
    .publishMotionPathKeyframeDraft({
      kind: "upsert-position-keyframe",
      layerDocumentId: "drawing",
      globalFrame: 9,
      localFrame: 9,
      value: { x: 901, y: 902 },
    })?.kind,
  "motion-path-keyframe-draft"
);
assert.equal(transitionCallCount, callsBefore);
assert.strictEqual(
  assembly.project.read(),
  disabledTrackProjectBefore
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeDisabledTrackDraft
);
disabledTrackCommands
  .cancelMotionPathKeyframeDraft();
assert.strictEqual(
  assembly.project.read(),
  disabledTrackProjectBefore
);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeDisabledTrackDraft
);
assert.equal(
  disabledTrackCommands
    .publishMotionPathKeyframeDraft({
      kind: "upsert-position-keyframe",
      layerDocumentId: "drawing",
      globalFrame: 9,
      localFrame: 9,
      value: { x: 901, y: 902 },
    })?.kind,
  "motion-path-keyframe-draft"
);
callsBefore = transitionCallCount;
const disabledTrackCommit =
  disabledTrackCommands
    .commitMotionPathKeyframeDraft();
assert.equal(disabledTrackCommit.ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(
  owner.state.undoStack.length,
  historyBeforeDisabledTrackDraft + 1
);
const disabledTrackLayerCommitted =
  assembly.project.read().payload
    .layerDocumentsById.drawing;
assert.deepEqual(
  disabledTrackLayerCommitted.common.transform.position,
  disabledTrackBasePosition
);
assert.equal(
  disabledTrackLayerCommitted.common.animation
    .enabledProperties.position,
  true
);
assert.deepEqual(
  disabledTrackLayerCommitted.common.animation
    .positionKeyframes.find(
      (keyframe) => keyframe.frame === 9
  ),
  { frame: 9, value: { x: 901, y: 902 } }
);
assert.deepEqual(
  owner.state.runtimeSession
    .selectedTransformKeyframe,
  {
    layerDocumentId: "drawing",
    property: "position",
    localFrame: 9,
    globalFrame: 9,
  }
);
assert.doesNotMatch(
  JSON.stringify(owner.state.undoStack.at(-1)),
  /runtimeSession|selectedTransformKeyframe/
);
assert.equal(assembly.project.undo().ok, true);
const disabledTrackLayerUndone =
  assembly.project.read().payload
    .layerDocumentsById.drawing;
assert.deepEqual(
  disabledTrackLayerUndone.common.transform.position,
  disabledTrackBasePosition
);
assert.deepEqual(
  disabledTrackLayerUndone.common.animation,
  disabledTrackAnimationBefore
);
assert.equal(
  owner.state.runtimeSession
    .selectedTransformKeyframe,
  null
);
assert.equal(assembly.project.redo().ok, true);
const disabledTrackLayerRedone =
  assembly.project.read().payload
    .layerDocumentsById.drawing;
assert.deepEqual(
  disabledTrackLayerRedone.common.transform.position,
  disabledTrackBasePosition
);
assert.equal(
  disabledTrackLayerRedone.common.animation
    .enabledProperties.position,
  true
);
assert.deepEqual(
  disabledTrackLayerRedone.common.animation
    .positionKeyframes.find(
      (keyframe) => keyframe.frame === 9
  ),
  { frame: 9, value: { x: 901, y: 902 } }
);
assert.equal(
  owner.state.runtimeSession
    .selectedTransformKeyframe,
  null
);
assert.equal(
  assembly.selection.selectLayer("psd-copy").ok,
  true
);

assert.equal(
  assembly.timeline.dispatchIntent({
    kind: "set-visibility",
    layerDocumentId: "psd-copy",
    visible: false,
  }).ok,
  true
);
assert.equal(
  assembly.timeline.dispatchIntent({
    kind: "set-timing",
    layerDocumentId: "psd-copy",
    startFrame: 5,
    durationFrames: 80,
    sourceOffsetFrames: 2,
  }).ok,
  true
);
assert.equal(
  assembly.timeline.dispatchIntent({
    kind: "rename-layer",
    layerDocumentId: "psd-copy",
    name: "Renamed duplicate",
  }).ok,
  true
);
assert.equal(
  assembly.timeline.dispatchIntent({
    kind: "set-alias",
    layerDocumentId: "psd-copy",
    alias: "Duplicate alias",
  }).ok,
  true
);
assert.equal(
  assembly.timeline.dispatchIntent({
    kind: "split-layer",
    layerDocumentId: "psd-copy",
    newLayerDocumentId: "psd-split",
    splitGlobalFrame: 40,
  }).ok,
  true
);
assert.equal(
  assembly.timeline.dispatchIntent({
    kind: "delete-layer",
    layerDocumentId: "psd-split",
  }).ok,
  true
);
const editedRow = flattenRows(
  assembly.timeline.readViewProps().rows
).find((row) => row.layerDocumentId === "psd-copy");
assert.equal(editedRow?.name, "Renamed duplicate");
assert.equal(editedRow?.alias, "Duplicate alias");
assert.equal(editedRow?.label, "Duplicate alias");
assert.equal(editedRow?.visible, false);
assert.equal(editedRow?.startFrame, 5);
assert.equal(editedRow?.durationFrames, 35);
assert.equal(
  assembly.project.read().payload.layerDocumentsById[
    "psd-split"
  ],
  undefined
);

assert.equal(assembly.canvas.directSelect("drawing").ok, true);
assert.equal(
  assembly.properties.describe().status,
  "ready"
);
assert.equal(
  assembly.domains.drawing.update({
    layerDocumentId: "drawing",
    data: {
      documentVersion: 2,
      elements: [{ kind: "rectangle", width: 20 }],
    },
  }).ok,
  true
);
assert.equal(
  assembly.domains.drawing.query("drawing").status,
  "ready"
);
assert.equal(assembly.selection.selectLayer("text").ok, true);
assert.equal(
  assembly.domains.text.update({
    layerDocumentId: "text",
    data: {
      text: "After",
      style: {
        fontFamily: "serif",
        fontSize: 64,
        color: "#00ff00",
      },
    },
  }).ok,
  true
);
assert.equal(
  assembly.domains.text.query("text").status,
  "ready"
);
assert.equal(
  assembly.domains.audio.query("audio").status,
  "ready"
);
assert.equal(
  assembly.domains.audio.prepareFutureCommand({
    layerDocumentId: "audio",
    operation: "domain-update",
  }).status,
  "unsupported"
);

callsBefore = transitionCallCount;
assert.equal(assembly.project.undo().ok, true);
assert.equal(transitionCallCount, callsBefore + 1);
assert.equal(
  assembly.domains.text.query("text").status,
  "ready"
);
const undoneText = assembly.domains.text.query("text");
assert.equal(
  undoneText.status === "ready"
    ? undoneText.data.text
    : null,
  "Before"
);
assert.equal(
  assembly.timeline.readViewProps().selectedLayerDocumentId,
  "text"
);
assert.equal(assembly.properties.describe().status, "ready");
assert.equal(assembly.project.redo().ok, true);
const redoneText = assembly.domains.text.query("text");
assert.equal(
  redoneText.status === "ready"
    ? redoneText.data.text
    : null,
  "After"
);

assert.equal(assembly.selection.selectLayer("psd").ok, true);
const beforeRefreshLayer = structuredClone(
  assembly.project.read().payload.layerDocumentsById.psd
);
canvas = assembly.canvas.readViewProps({
  quality: "preview",
  rendererMode: "full-render",
});
assert.equal(canvas.runtime.ok, true);
if (!canvas.runtime.ok) {
  throw new Error(canvas.runtime.reason);
}
const psdInputBeforeRefresh = canvas.runtime.model.inputs.find(
  (input) => input.layerDocumentId === "psd"
);
assert.ok(psdInputBeforeRefresh?.sourceResourceCacheKey);
assembly.runtime.registrationBridge.registerResources([{
  sourceId: "node",
  sourceResourceCacheKey:
    psdInputBeforeRefresh.sourceResourceCacheKey,
  resolution: {
    renderItemId: "refresh-runtime-node",
    drawableId: "refresh-runtime-drawable",
    logicalSize: { width: 640, height: 360 },
  },
  resource: { runtimeOnly: true },
  dispose: () => {
    disposedResourceCount += 1;
  },
}]);
const currentNode =
  assembly.project.read().payload.sourceRegistry.sourcesById.node;
assert.equal(currentNode?.kind, "psd-node");
if (!currentNode || currentNode.kind !== "psd-node") {
  throw new Error("Expected node source");
}
const refreshResult = assembly.sources.refreshSource({
  source: {
    ...currentNode,
    version: currentNode.version + 1,
    data: {
      ...currentNode.data,
      visualFingerprint: "node-refreshed-v2",
    },
    refresh: normalRefresh(),
  },
  cacheContext: {
    globalFrame: 20,
    localFrameByLayerDocumentId: {
      psd: 20,
      "psd-copy": 15,
    },
    quality: "preview",
  },
});
assert.equal(refreshResult.ok, true);
assert.equal(owner.state.undoStack.length, 0);
assert.equal(owner.state.redoStack.length, 0);
assert.deepEqual(
  assembly.project.read().payload.layerDocumentsById.psd,
  beforeRefreshLayer
);
assert.equal(
  resources.resolve({
    sourceId: "node",
    sourceResourceCacheKey:
      psdInputBeforeRefresh.sourceResourceCacheKey,
  }),
  null
);
assert.equal(disposedResourceCount, 2);
const afterRefreshCanvas = assembly.canvas.readViewProps({
  quality: "preview",
  rendererMode: "full-render",
});
assert.equal(afterRefreshCanvas.runtime.ok, true);
if (!afterRefreshCanvas.runtime.ok) {
  throw new Error(afterRefreshCanvas.runtime.reason);
}
assert.notEqual(
  afterRefreshCanvas.runtime.model.inputs.find(
    (input) => input.layerDocumentId === "psd"
  )?.sourceResourceCacheKey,
  psdInputBeforeRefresh.sourceResourceCacheKey
);
assert.deepEqual(
  validateLayerDocumentProject(assembly.project.read()),
  []
);
const orphanSource = psdNode({
  sourceId: "orphan-runtime-source",
  documentSourceId: "document",
});
assert.equal(
  assembly.sources.importSources({
    sources: [orphanSource],
    layers: [],
    selectSourceId: orphanSource.sourceId,
    selectLayerDocumentId: null,
  }).ok,
  true
);
let orphanDisposed = 0;
let sentinelDisposed = 0;
assert.equal(resources.register({
  sourceId: orphanSource.sourceId,
  sourceResourceCacheKey: "orphan-key",
  resolution: {
    renderItemId: "orphan-render",
    drawableId: "orphan-drawable",
    logicalSize: { width: 1, height: 1 },
  },
  resource: {},
  dispose: () => {
    orphanDisposed += 1;
  },
}).ok, true);
assert.equal(resources.register({
  sourceId: "sentinel-source",
  sourceResourceCacheKey: "sentinel-key",
  resolution: {
    renderItemId: "sentinel-render",
    drawableId: "sentinel-drawable",
    logicalSize: { width: 1, height: 1 },
  },
  resource: {},
  dispose: () => {
    sentinelDisposed += 1;
  },
}).ok, true);
assert.equal(
  assembly.sources.refreshSource({
    source: {
      ...orphanSource,
      data: {
        ...orphanSource.data,
        visualFingerprint: "orphan-v2",
      },
      version: orphanSource.version + 1,
    },
    cacheContext: {
      globalFrame: 0,
      localFrameByLayerDocumentId: {},
      quality: "preview",
    },
  }).ok,
  true
);
assert.equal(orphanDisposed, 1);
assert.equal(sentinelDisposed, 0);
assert.ok(resources.resolve({
  sourceId: "sentinel-source",
  sourceResourceCacheKey: "sentinel-key",
}));
assert.equal(resources.register({
  sourceId: orphanSource.sourceId,
  sourceResourceCacheKey: "orphan-key-2",
  resolution: {
    renderItemId: "orphan-render-2",
    drawableId: "orphan-drawable-2",
    logicalSize: { width: 1, height: 1 },
  },
  resource: {},
  dispose: () => {
    orphanDisposed += 1;
  },
}).ok, true);
assert.equal(
  assembly.sources.deleteSource({
    sourceId: orphanSource.sourceId,
  }).ok,
  true
);
assert.equal(orphanDisposed, 1);
assert.equal(sentinelDisposed, 0);
assert.equal(resources.resolve({
  sourceId: orphanSource.sourceId,
  sourceResourceCacheKey: "orphan-key-2",
}), null);
assert.equal(assembly.project.undo().ok, true);
assert.ok(resources.resolve({
  sourceId: orphanSource.sourceId,
  sourceResourceCacheKey: "orphan-key-2",
}));
assert.equal(assembly.project.redo().ok, true);
assert.equal(resources.resolve({
  sourceId: orphanSource.sourceId,
  sourceResourceCacheKey: "orphan-key-2",
}), null);
assert.equal(assembly.project.undo().ok, true);
assert.equal(
  assembly.timeline.dispatchIntent({
    kind: "rename-layer",
    layerDocumentId: "psd",
    name: "PSD after source branch",
  }).ok,
  true
);
assert.equal(owner.state.redoStack.length, 0);
assert.equal(orphanDisposed, 1);
assert.ok(resources.resolve({
  sourceId: orphanSource.sourceId,
  sourceResourceCacheKey: "orphan-key-2",
}));
assert.equal(
  assembly.sources.deleteSource({
    sourceId: orphanSource.sourceId,
  }).ok,
  true
);
assert.equal(orphanDisposed, 1);
const clearHistoryNode =
  assembly.project.read().payload.sourceRegistry.sourcesById.node;
assert.equal(clearHistoryNode?.kind, "psd-node");
if (!clearHistoryNode || clearHistoryNode.kind !== "psd-node") {
  throw new Error("Expected clear-history PSD node");
}
assert.equal(
  assembly.sources.refreshSource({
    source: {
      ...clearHistoryNode,
      data: {
        ...clearHistoryNode.data,
        visualFingerprint: "node-clear-history",
      },
      version: clearHistoryNode.version + 1,
    },
    cacheContext: {
      globalFrame: 0,
      localFrameByLayerDocumentId: {},
      quality: "preview",
    },
  }).ok,
  true
);
assert.equal(owner.state.undoStack.length, 0);
assert.equal(owner.state.redoStack.length, 0);
assert.equal(orphanDisposed, 2);
assert.equal(sentinelDisposed, 0);
assert.ok(resources.resolve({
  sourceId: "sentinel-source",
  sourceResourceCacheKey: "sentinel-key",
}));

assert.equal(
  effects.length,
  transitionCallCount
);
assert.equal(
  metricCounts.get("layerDocumentCutoverOwnerTransition"),
  transitionCallCount
);
assert.equal(
  metricCounts.get("layerDocumentCutoverDraftPublication"),
  5
);
assert.ok(draftClearCount > 0);
assert.equal(beforeDuplicateRevision, 2);

const assemblySource = readFileSync(
  "src/cutover/createLayerDocumentConsumerCutoverAssembly.ts",
  "utf8"
);
const compositionRootSource = readFileSync(
  "src/editor/useEditorCompositionRoot.ts",
  "utf8"
);
assert.doesNotMatch(
  assemblySource,
  /ProjectSource|setComps|setTimelineItems|reconcileLegacy/
);
assert.doesNotMatch(
  compositionRootSource,
  /createLayerDocumentConsumerCutoverAssembly|@\/cutover/
);

resources.dispose();
assert.equal(orphanDisposed, 2);
assert.equal(sentinelDisposed, 1);
console.log(
  "Layer Document consumer cutover assembly verification passed"
);
