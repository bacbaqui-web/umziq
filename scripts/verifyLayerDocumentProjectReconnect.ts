import assert from "node:assert/strict";
import {
  type LayerDocument,
  type LayerDocumentProject,
  type LinkedSourceContentFingerprint,
} from "@/models";
import {
  createLayerDocumentProjectReconnectController,
  createLayerDocumentSourceRuntimeResolutionStore,
  type LayerDocumentProjectOpenAdapterResult,
  type LayerDocumentProjectOpenFileHandle,
  type PreparedLayerDocumentLinkedSourceRuntime,
} from "@/engines/project";
import {
  createLayerDocumentSourceRuntimeResourceCache,
} from "@/render";
import {
  createInitialLayerDocumentNexusOptions,
} from "@/editor/layerDocumentEditorBootstrap";

const MATCHING_FINGERPRINT:
LinkedSourceContentFingerprint = {
  algorithm: "sha-256",
  digestHex: "a".repeat(64),
  byteLength: 4,
};
const WRONG_FINGERPRINT:
LinkedSourceContentFingerprint = {
  algorithm: "sha-256",
  digestHex: "b".repeat(64),
  byteLength: 4,
};

function projectFixture(): LayerDocumentProject {
  const project = structuredClone(
    createInitialLayerDocumentNexusOptions().project
  );
  project.metadata.projectId = "reconnect-project";
  const root = Object.values(
    project.payload.layerDocumentsById
  )[0];
  const documentSource = (
    sourceId: string,
    fileName: string
  ) => ({
    sourceId,
    kind: "psd-document" as const,
    displayName: fileName,
    version: 1,
    refresh: { status: "normal" as const },
    locator: {
      locatorId: `linked:${sourceId}`,
      kind: "linked-file" as const,
      suggestedFileName: fileName,
      relativePathHint: `assets/${fileName}`,
    },
    contentFingerprint: MATCHING_FINGERPRINT,
    data: {
      importSettings: {
        compositionName: fileName,
        hiddenLayerMode: "preserve" as const,
      },
    },
  });
  const nodeSource = (
    sourceId: string,
    documentSourceId: string
  ) => ({
    sourceId,
    kind: "psd-node" as const,
    displayName: sourceId,
    version: 1,
    refresh: { status: "normal" as const },
    data: {
      documentSourceId,
      sourceKey: `layer:${sourceId}`,
      sourcePath: `Root/${sourceId}`,
      visualFingerprint: `${sourceId}-visual`,
    },
  });
  const layer = (
    layerDocumentId: string,
    sourceId: string,
    order: number
  ): LayerDocument => ({
    layerDocumentId,
    name: layerDocumentId,
    revision: 0,
    type: "psd",
    common: {
      ...structuredClone(root.common),
      source: { sourceId },
      placement: {
        ...structuredClone(root.common.placement),
        parentLayerDocumentId:
          root.layerDocumentId,
        order,
      },
    },
    data: {},
  });
  project.payload.sourceRegistry.sourcesById = {
    document: documentSource(
      "document",
      "original.psd"
    ),
    "node-a": nodeSource("node-a", "document"),
    "node-b": nodeSource("node-b", "document"),
    other: documentSource("other", "other.psd"),
    "other-node": nodeSource(
      "other-node",
      "other"
    ),
  };
  project.payload.layerDocumentsById["layer-a"] =
    layer("layer-a", "node-a", 0);
  project.payload.layerDocumentsById["layer-b"] =
    layer("layer-b", "node-b", 1);
  project.payload.layerDocumentsById["other-layer"] =
    layer("other-layer", "other-node", 2);
  return project;
}

function handle(file: File):
LayerDocumentProjectOpenFileHandle {
  return {
    name: file.name,
    getFile: async () => file,
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
    }),
  };
}

function selected(
  file: File,
  fileHandle:
    LayerDocumentProjectOpenFileHandle | null = null
): LayerDocumentProjectOpenAdapterResult {
  return {
    ok: true,
    value: {
      file,
      bytes: new Uint8Array(),
      handle: fileHandle,
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function prepared(options: {
  fingerprint: LinkedSourceContentFingerprint;
  dispose: () => void;
}): PreparedLayerDocumentLinkedSourceRuntime {
  let ownership:
    "prepared" | "discarded" | "transferred" =
      "prepared";
  const resources = ["node-a", "node-b"].map(
    (sourceId) => ({
      sourceId,
      sourceResourceCacheKey: `new:${sourceId}`,
      resolution: {
        renderItemId: `new:${sourceId}`,
        drawableId: `new:${sourceId}`,
        logicalSize: { width: 20, height: 20 },
      },
      resource: { sourceId, generation: "new" },
      dispose: options.dispose,
    })
  );
  return {
    contentFingerprint: options.fingerprint,
    resources,
    availableSourceIds: [
      "document",
      "node-a",
      "node-b",
    ],
    unavailableSourceIds: [],
    discard: () => {
      if (ownership !== "prepared") return 0;
      ownership = "discarded";
      resources.forEach((resource) =>
        resource.dispose()
      );
      return resources.length;
    },
    transfer: () => {
      if (ownership === "prepared") {
        ownership = "transferred";
      }
    },
  };
}

const project = projectFixture();
const sourceRuntime =
  createLayerDocumentSourceRuntimeResourceCache();
const oldDisposals = {
  "node-a": 0,
  "node-b": 0,
  "other-node": 0,
};
for (
  const sourceId
  of ["node-a", "node-b", "other-node"] as const
) {
  assert.equal(sourceRuntime.register({
    sourceId,
    sourceResourceCacheKey: `old:${sourceId}`,
    resolution: {
      renderItemId: `old:${sourceId}`,
      drawableId: `old:${sourceId}`,
      logicalSize: { width: 10, height: 10 },
    },
    resource: { sourceId, generation: "old" },
    dispose: () => {
      oldDisposals[sourceId] += 1;
    },
  }).ok, true);
}
const resolutions =
  createLayerDocumentSourceRuntimeResolutionStore();
["document", "node-a", "node-b"].forEach(
  (sourceId) => resolutions.setMissing(sourceId)
);
const browserQueue:
  LayerDocumentProjectOpenAdapterResult[] = [];
let preparationFingerprint =
  MATCHING_FINGERPRINT;
let preparationFailure: string | null = null;
let preparationCalls = 0;
let preparationGate:
  ReturnType<typeof deferred> | null = null;
let preparedDisposals = 0;
const localHandleUpdates: unknown[] = [];
let selectedReconnect:
  Extract<LayerDocumentProjectOpenAdapterResult, { ok: true }>["value"] | null = null;
const controller =
  createLayerDocumentProjectReconnectController({
    readProject: () => project,
    sourceAccess: {
      chooseLinkedSource: async () => {
        const result = browserQueue.shift();
        if (!result) throw new Error("Missing browser result");
        if (!result.ok) return result;
        selectedReconnect = result.value;
        return {
          ok: true,
          value: {
            resourceId: "test:reconnect",
            fileName: result.value.file.name,
            mimeType: result.value.file.type || null,
            byteLength: result.value.file.size,
            relativePathHint: null,
          },
        };
      },
      readSource: async () => selectedReconnect
        ? { ok: true, value: selectedReconnect.bytes }
        : { ok: false, error: { code: "not-found", message: "missing" } },
      copyIntoProjectAssets: async ({ sources }) => ({ ok: true, value: sources }),
      release: () => {},
    },
    preparation: {
      prepare: async () => {
        preparationCalls += 1;
        if (preparationFailure) {
          return {
            ok: false,
            message: preparationFailure,
          };
        }
        const runtime = prepared({
          fingerprint: preparationFingerprint,
          dispose: () => {
            preparedDisposals += 1;
          },
        });
        const gate = preparationGate;
        if (gate) await gate.promise;
        return { ok: true, value: runtime };
      },
    },
    sourceRuntime,
    sourceResolution: resolutions,
    reconnectCommit: {
      commitAvailable: (update) => {
        update.sourceIds.forEach((sourceId) =>
          resolutions.setAvailable({ sourceId })
        );
        localHandleUpdates.push(update);
      },
    },
  });

const readModel = controller.read();
assert.equal(readModel.items.length, 1);
assert.deepEqual(
  readModel.items[0].dependentSourceIds,
  ["document", "node-a", "node-b"]
);
assert.deepEqual(
  readModel.items[0].dependentLayerDocumentIds,
  ["layer-a", "layer-b"]
);
assert.equal(
  readModel.items[0].fingerprintPolicy,
  "verified"
);

browserQueue.push({
  ok: false,
  error: {
    code: "cancelled",
    message: "cancelled",
  },
});
const cancelled =
  await controller.reconnect("document");
assert.equal(cancelled.ok, false);
assert.equal(preparedDisposals, 0);
assert.equal(localHandleUpdates.length, 0);

browserQueue.push({
  ok: false,
  error: {
    code: "permission-denied",
    message: "denied",
  },
});
const denied =
  await controller.reconnect("document");
assert.equal(denied.ok, false);
assert.equal(
  resolutions.read("document").status,
  "missing"
);

const wrongFile = new File(
  [new Uint8Array([9, 9, 9, 9])],
  "original.psd"
);
preparationFingerprint = WRONG_FINGERPRINT;
browserQueue.push(selected(wrongFile, handle(wrongFile)));
const mismatch =
  await controller.reconnect("document");
assert.equal(mismatch.ok, true);
if (mismatch.ok) {
  assert.equal(
    mismatch.status,
    "confirmation-required"
  );
  if (mismatch.status === "confirmation-required") {
    assert.equal(
      mismatch.reason,
      "fingerprint-mismatch"
    );
    assert.deepEqual(mismatch.choices, [
      "refresh-source",
      "replace-source",
    ]);
  }
}
assert.equal(preparedDisposals, 2);
assert.equal(localHandleUpdates.length, 0);
assert.ok(sourceRuntime.resolve({
  sourceId: "node-a",
  sourceResourceCacheKey: "old:node-a",
}));

const documentSource =
  project.payload.sourceRegistry.sourcesById.document;
if (documentSource.kind !== "psd-document") {
  throw new Error("Expected PSD document");
}
project.payload.sourceRegistry.sourcesById.document = {
  ...documentSource,
  contentFingerprint: null,
};
preparationFingerprint = MATCHING_FINGERPRINT;
browserQueue.push(selected(wrongFile));
const legacy = await controller.reconnect("document");
assert.equal(legacy.ok, true);
if (legacy.ok) {
  assert.equal(
    legacy.status,
    "confirmation-required"
  );
  if (legacy.status === "confirmation-required") {
    assert.equal(
      legacy.reason,
      "legacy-unverified-fingerprint"
    );
  }
}
assert.equal(preparedDisposals, 4);
project.payload.sourceRegistry.sourcesById.document =
  documentSource;

preparationFailure = "PSD parse failed";
browserQueue.push(selected(wrongFile));
const parseFailed =
  await controller.reconnect("document");
assert.equal(parseFailed.ok, false);
if (!parseFailed.ok) {
  assert.equal(parseFailed.error.code, "parse-failed");
}
assert.equal(
  resolutions.read("node-a").status,
  "error"
);
preparationFailure = null;
["document", "node-a", "node-b"].forEach(
  (sourceId) => resolutions.setMissing(sourceId)
);

const movedFile = new File(
  [new Uint8Array([1, 2, 3, 4])],
  "moved.psd"
);
const movedHandle = handle(movedFile);
browserQueue.push(selected(movedFile, movedHandle));
const projectBeforeRuntimeOnlyReconnect = structuredClone(project);
const reconnected =
  await controller.reconnect("document");
assert.equal(reconnected.ok, true);
if (reconnected.ok) {
  assert.equal(reconnected.status, "reconnected");
}
assert.equal(localHandleUpdates.length, 1);
assert.deepEqual(
  localHandleUpdates[0],
  {
    projectId: "reconnect-project",
    locatorId: "linked:document",
    source: {
      resourceId: "test:reconnect",
      fileName: "moved.psd",
      mimeType: null,
      byteLength: 4,
      relativePathHint: null,
    },
    sourceIds: ["document", "node-a", "node-b"],
  }
);
assert.deepEqual(
  project,
  projectBeforeRuntimeOnlyReconnect,
  "same-source runtime-only reconnect leaves Project unchanged, so History stays 0"
);
assert.equal(resolutions.read("document").status, "available");
assert.equal(resolutions.read("node-a").status, "available");
assert.equal(resolutions.read("node-b").status, "available");
assert.equal(oldDisposals["node-a"], 1);
assert.equal(oldDisposals["node-b"], 1);
assert.equal(oldDisposals["other-node"], 0);
assert.ok(sourceRuntime.resolve({
  sourceId: "other-node",
  sourceResourceCacheKey: "old:other-node",
}));

const staleGate = deferred();
preparationGate = staleGate;
browserQueue.push(
  selected(movedFile),
  selected(movedFile)
);
const staleReconnect =
  controller.reconnect("document");
const callsBeforeStale = preparationCalls;
while (preparationCalls === callsBeforeStale) {
  await Promise.resolve();
}
preparationGate = null;
const latestReconnect =
  controller.reconnect("document");
assert.equal((await latestReconnect).ok, true);
const disposalsBeforeStale =
  preparedDisposals;
staleGate.resolve();
const stale = await staleReconnect;
assert.equal(stale.ok, false);
if (!stale.ok) {
  assert.equal(
    stale.error.code,
    "stale-operation"
  );
}
assert.equal(
  preparedDisposals,
  disposalsBeforeStale + 2
);

console.log(
  "Layer Document Project Reconnect verification passed"
);
