import assert from "node:assert/strict";
import {
  type LayerDocument,
  type LayerDocumentProject,
} from "@/models";
import {
  createLayerDocumentProjectBrowserOpenAdapter,
  createLayerDocumentProjectLifecycleController,
  createLayerDocumentProjectOpenController,
  createLayerDocumentProjectOwnerState,
  createLayerDocumentSourceRuntimeResolutionStore,
  saveLayerDocumentProjectToZiq,
  reduceLayerDocumentProjectOwner,
  type LayerDocumentProjectOpenFileHandle,
  type LayerDocumentProjectOwnerAction,
  type LayerDocumentProjectOwnerState,
  type PreparedLayerDocumentLinkedSourceRuntime,
} from "@/engines/project";
import {
  createLayerDocumentSourceRuntimeResourceCache,
} from "@/render";
import {
  createInitialLayerDocumentOwnerOptions,
} from "@/editor/layerDocumentEditorBootstrap";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function projectFixture(
  projectId: string,
  name: string
): LayerDocumentProject {
  const initial =
    createInitialLayerDocumentOwnerOptions().project;
  const project = structuredClone(initial);
  project.metadata.projectId = projectId;
  project.metadata.name = name;
  const root = Object.values(
    project.payload.layerDocumentsById
  )[0];
  const source = (
    sourceId: string,
    fileName: string
  ) => ({
    sourceId,
    kind: "video" as const,
    displayName: fileName,
    version: 1,
    refresh: { status: "normal" as const },
    locator: {
      locatorId: `linked:${sourceId}`,
      kind: "linked-file" as const,
      suggestedFileName: fileName,
      relativePathHint: `media/${fileName}`,
    },
    contentFingerprint: {
      algorithm: "sha-256" as const,
      digestHex: sourceId === "available"
        ? "a".repeat(64)
        : "b".repeat(64),
      byteLength: 3,
    },
    data: {
      mimeType: "video/mp4",
      durationFrames: 300,
      width: 1080,
      height: 1920,
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
    type: "video",
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
    available: source("available", "available.mp4"),
    missing: source("missing", "missing.mp4"),
  };
  project.payload.layerDocumentsById.available =
    layer("available", "available", 0);
  project.payload.layerDocumentsById.missing =
    layer("missing", "missing", 1);
  return project;
}

function projectFile(
  project: LayerDocumentProject,
  fileName = "project.ziq"
) {
  const saved =
    saveLayerDocumentProjectToZiq(project);
  assert.equal(saved.ok, true);
  if (!saved.ok) throw new Error(saved.error.message);
  return new File(
    [saved.value.slice().buffer],
    fileName,
    { type: "application/json" }
  );
}

function openHandle(
  file: File
): LayerDocumentProjectOpenFileHandle {
  return {
    name: file.name,
    getFile: async () => file,
    createWritable: async () => ({
      write: async () => {},
      close: async () => {},
    }),
  };
}

function ownerFixture() {
  const initialized =
    createLayerDocumentProjectOwnerState(
      createInitialLayerDocumentOwnerOptions()
    );
  assert.equal(initialized.ok, true);
  if (!initialized.ok) {
    throw new Error(initialized.error.message);
  }
  const stateRef: {
    current: LayerDocumentProjectOwnerState;
  } = { current: initialized.state };
  const owner = {
    get state() {
      return stateRef.current;
    },
    transition: (
      action: LayerDocumentProjectOwnerAction
    ) => {
      const result =
        reduceLayerDocumentProjectOwner(
          stateRef.current,
          action
        );
      if (result.ok && result.changed) {
        stateRef.current = result.state;
      }
      return result;
    },
  };
  return { owner };
}

function preparedRuntime(options: {
  sourceId: string;
  onDispose: () => void;
}): PreparedLayerDocumentLinkedSourceRuntime {
  let state: "prepared" | "discarded" | "transferred" =
    "prepared";
  const resource = {
    sourceId: options.sourceId,
    sourceResourceCacheKey:
      `loaded:${options.sourceId}`,
    resolution: {
      renderItemId: `loaded:${options.sourceId}`,
      drawableId: `drawable:${options.sourceId}`,
      logicalSize: { width: 10, height: 10 },
    },
    resource: { fresh: true },
    dispose: options.onDispose,
  };
  return {
    contentFingerprint: {
      algorithm: "sha-256",
      digestHex: "a".repeat(64),
      byteLength: 3,
    },
    resources: [resource],
    availableSourceIds: [options.sourceId],
    unavailableSourceIds: [],
    discard: () => {
      if (state !== "prepared") return 0;
      state = "discarded";
      resource.dispose();
      return 1;
    },
    transfer: () => {
      if (state === "prepared") state = "transferred";
    },
  };
}

const fixture = ownerFixture();
const sourceRuntime =
  createLayerDocumentSourceRuntimeResourceCache();
let oldDisposeCount = 0;
assert.equal(sourceRuntime.register({
  sourceId: "old-source",
  sourceResourceCacheKey: "old-key",
  resolution: {
    renderItemId: "old",
    drawableId: "old",
    logicalSize: { width: 1, height: 1 },
  },
  resource: { old: true },
  dispose: () => {
    oldDisposeCount += 1;
  },
}).ok, true);
const sourceResolution =
  createLayerDocumentSourceRuntimeResolutionStore();
sourceResolution.setMissing("old-source");
const lifecycle =
  createLayerDocumentProjectLifecycleController({
    owner: fixture.owner,
    runtime: {
      clearDraft: () => {},
      resetLocalUi: () => {},
      stopPlayback: () => {},
      invalidateSourceRuntime: (invalidation) =>
        sourceRuntime.invalidate(invalidation),
      resetSourceResolution:
        sourceResolution.reset,
    },
  });

const validProject =
  projectFixture("loaded-one", "Loaded One");
const validFile = projectFile(validProject);
const validHandle = openHandle(validFile);
const pickerQueue: Array<
  LayerDocumentProjectOpenFileHandle
> = [];
const nativeBrowser =
  createLayerDocumentProjectBrowserOpenAdapter({
    showOpenFilePicker: async () => {
      const handle = pickerQueue.shift();
      if (!handle) {
        throw new DOMException(
          "cancelled",
          "AbortError"
        );
      }
      return [handle];
    },
    chooseFileWithHiddenInput: async () => null,
  });
assert.equal(
  nativeBrowser.capability,
  "native-file-system"
);

const linkedFile = new File(
  [new Uint8Array([1, 2, 3])],
  "available.mp4"
);
let preparedDisposeCount = 0;
let preparationCount = 0;
let blockedPreparation:
  ReturnType<typeof deferred> | null = null;
let saveTarget: unknown = { oldTarget: true };
const openController =
  createLayerDocumentProjectOpenController({
    lifecycle,
    browser: nativeBrowser,
    linkedSourceAccess: {
      find: async ({ locatorId }) =>
        locatorId === "linked:available"
          ? {
              status: "available",
              file: linkedFile,
              handle: null,
              permission: "granted",
            }
          : {
              status: "missing",
              message: null,
            },
    },
    linkedSourcePreparation: {
      prepare: async ({ source }) => {
        preparationCount += 1;
        const prepared = preparedRuntime({
          sourceId: source.sourceId,
          onDispose: () => {
            preparedDisposeCount += 1;
          },
        });
        if (blockedPreparation) {
          await blockedPreparation.promise;
        }
        return { ok: true, value: prepared };
      },
    },
    sourceRuntime,
    sourceResolution,
    saveController: {
      commitTarget: (target) => {
        saveTarget = target;
      },
    },
  });

function invalidFile(text: string, name: string) {
  return new File([text], name, {
    type: "application/json",
  });
}

const beforeFailureState = fixture.owner.state;
const beforeFailureProject =
  fixture.owner.state.currentProject;
const beforeFailureTarget = saveTarget;
pickerQueue.push(openHandle(
  invalidFile("{broken", "broken.ziq")
));
const corrupt = await openController.open();
assert.equal(corrupt.ok, false);
assert.strictEqual(fixture.owner.state, beforeFailureState);
assert.strictEqual(
  fixture.owner.state.currentProject,
  beforeFailureProject
);
assert.equal(oldDisposeCount, 0);
assert.ok(sourceRuntime.resolve({
  sourceId: "old-source",
  sourceResourceCacheKey: "old-key",
}));
assert.strictEqual(saveTarget, beforeFailureTarget);

const futureEnvelope = JSON.parse(
  await validFile.text()
);
futureEnvelope.project.metadata.schemaVersion = 99;
pickerQueue.push(openHandle(invalidFile(
  JSON.stringify(futureEnvelope),
  "future.ziq"
)));
const future = await openController.open();
assert.equal(future.ok, false);
assert.strictEqual(fixture.owner.state, beforeFailureState);
assert.equal(oldDisposeCount, 0);
assert.strictEqual(saveTarget, beforeFailureTarget);

pickerQueue.push(validHandle);
const loaded = await openController.open();
assert.equal(loaded.ok, true);
if (!loaded.ok) throw new Error(loaded.error.message);
assert.equal(loaded.readiness, "ready-degraded");
assert.deepEqual(loaded.project, validProject);
assert.deepEqual(
  fixture.owner.state.currentProject,
  validProject
);
assert.equal(fixture.owner.state.undoStack.length, 0);
assert.equal(oldDisposeCount, 1);
assert.ok(sourceRuntime.resolve({
  sourceId: "available",
  sourceResourceCacheKey: "loaded:available",
}));
assert.deepEqual(
  sourceRuntime.resolve({
    sourceId: "available",
    sourceResourceCacheKey: "loaded:available",
  })?.resource,
  { fresh: true },
  "Load must register a newly prepared Runtime resource"
);
assert.equal(
  sourceResolution.read("available").status,
  "available"
);
assert.strictEqual(
  sourceResolution.read("available").file,
  linkedFile
);
assert.equal(
  sourceResolution.read("missing").status,
  "missing"
);
assert.deepEqual(loaded.missingSourceIds, ["missing"]);
assert.equal(preparationCount, 1);
assert.equal(
  (saveTarget as { handle?: unknown }).handle,
  validHandle
);
assert.equal(
  JSON.stringify(fixture.owner.state)
    .includes(validHandle.name),
  false,
  "Open File/Handle must remain outside Project, History, and Session"
);

const staleProject =
  projectFixture("stale-load", "Stale Load");
const latestProject =
  projectFixture("latest-load", "Latest Load");
const staleHandle =
  openHandle(projectFile(staleProject, "stale.ziq"));
const latestHandle =
  openHandle(projectFile(latestProject, "latest.ziq"));
const firstPreparationGate = deferred();
blockedPreparation = firstPreparationGate;
pickerQueue.push(staleHandle, latestHandle);
const staleOpen = openController.open();
while (preparationCount < 2) {
  await Promise.resolve();
}
blockedPreparation = null;
const latestOpen = openController.open();
assert.equal((await latestOpen).ok, true);
const disposalsBeforeStaleRelease =
  preparedDisposeCount;
firstPreparationGate.resolve();
const stale = await staleOpen;
assert.equal(stale.ok, false);
if (!stale.ok) {
  assert.equal(
    stale.error.code,
    "stale-operation"
  );
}
assert.equal(
  preparedDisposeCount,
  disposalsBeforeStaleRelease + 1,
  "Stale prepared Runtime must be disposed exactly once"
);
assert.equal(
  fixture.owner.state.currentProject
    .metadata.projectId,
  "latest-load"
);
assert.equal(
  (saveTarget as { handle?: unknown }).handle,
  latestHandle
);
assert.equal(oldDisposeCount, 1);

let fallbackAccept = "";
const fallbackBrowser =
  createLayerDocumentProjectBrowserOpenAdapter({
    chooseFileWithHiddenInput: async (accept) => {
      fallbackAccept = accept;
      return validFile;
    },
  });
assert.equal(
  fallbackBrowser.capability,
  "file-input"
);
const fallbackSelection =
  await fallbackBrowser.chooseProjectFile();
assert.equal(fallbackSelection.ok, true);
if (fallbackSelection.ok) {
  assert.strictEqual(
    fallbackSelection.value.file,
    validFile
  );
  assert.equal(
    fallbackSelection.value.handle,
    null
  );
}
assert.equal(fallbackAccept, ".ziq");
const cancelledFallback =
  createLayerDocumentProjectBrowserOpenAdapter({
    chooseFileWithHiddenInput: async () => null,
  });
const cancelled =
  await cancelledFallback.chooseProjectFile();
assert.equal(cancelled.ok, false);
if (!cancelled.ok) {
  assert.equal(cancelled.error.code, "cancelled");
}

console.log(
  "Layer Document Project Open verification passed"
);
