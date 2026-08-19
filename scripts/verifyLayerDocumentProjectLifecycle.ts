import assert from "node:assert/strict";
import {
  buildLayerDocumentGroupScopeReadModel,
  buildSetLayerDocumentNameTransaction,
  type LayerDocumentProject,
} from "@/models";
import {
  createLayerDocumentProjectLifecycleController,
  createLayerDocumentNexusState,
  reduceLayerDocumentNexus,
  type LayerDocumentNexusAction,
  type LayerDocumentNexusState,
} from "@/engines/project";
import {
  createInitialLayerDocumentNexusOptions,
} from "@/editor/layerDocumentEditorBootstrap";
import {
  createLayerDocumentSourceRuntimeResourceCache,
} from "@/render";
import {
  createLayerDocumentTimelinePlaybackRuntime,
} from "@/engines/timeline/state/layerDocumentTimelinePlaybackRuntime";

const initialOptions =
  createInitialLayerDocumentNexusOptions();
const initialized =
  createLayerDocumentNexusState(initialOptions);
assert.equal(initialized.ok, true);
if (!initialized.ok) {
  throw new Error(initialized.error.message);
}
const stateRef: {
  current: LayerDocumentNexusState;
} = { current: initialized.state };
const nexus = {
  get state() {
    return stateRef.current;
  },
  transition: (
    action: LayerDocumentNexusAction
  ) => {
    const result =
      reduceLayerDocumentNexus(
        stateRef.current,
        action
      );
    if (result.ok && result.changed) {
      stateRef.current = result.state;
    }
    return result;
  },
};

const runtimeCalls = {
  clearDraft: 0,
  resetLocalUi: 0,
  stopPlayback: 0,
  resetSourceResolution: 0,
  recomputeRender: 0,
  invalidations: [] as unknown[],
  effects: [] as unknown[],
};
let disposedResources = 0;
const sourceRuntime =
  createLayerDocumentSourceRuntimeResourceCache();
const registered = sourceRuntime.register({
  sourceId: "old-runtime-source",
  sourceResourceCacheKey: "old-runtime-key",
  resolution: {
    renderItemId: "old-runtime",
    drawableId: "old-runtime-drawable",
    logicalSize: { width: 1, height: 1 },
  },
  resource: {},
  dispose: () => {
    disposedResources += 1;
  },
});
assert.equal(registered.ok, true);
const playback =
  createLayerDocumentTimelinePlaybackRuntime({
    scope: {
      read: () =>
        buildLayerDocumentGroupScopeReadModel(
          nexus.state.currentProject,
          nexus.state.session
            .activeGroupLayerDocumentId
        ),
    },
    scheduler: {
      setRepeating: () => Symbol("clock"),
      clearRepeating: () => {},
    },
  });
const lifecycle =
  createLayerDocumentProjectLifecycleController({
    nexus,
    runtime: {
      clearDraft: () => {
        runtimeCalls.clearDraft += 1;
      },
      resetLocalUi: () => {
        runtimeCalls.resetLocalUi += 1;
      },
      stopPlayback: () => {
        runtimeCalls.stopPlayback += 1;
        playback.commands.pause();
      },
      invalidateSourceRuntime: (invalidation) => {
        runtimeCalls.invalidations.push(invalidation);
        return sourceRuntime.invalidate(invalidation);
      },
      resetSourceResolution: () => {
        runtimeCalls.resetSourceResolution += 1;
      },
      recomputeRender: () => {
        runtimeCalls.recomputeRender += 1;
      },
      publishNexusEffect: (effect) => {
        runtimeCalls.effects.push(effect);
        playback.validity.reconcile();
      },
    },
  });

assert.deepEqual(
  {
    document: lifecycle.read().document,
    dirty: lifecycle.read().dirty,
    operation: lifecycle.read().operation,
  },
  {
    document: "untitled",
    dirty: "clean",
    operation: "idle",
  }
);

const rootId =
  initialOptions.activeGroupLayerDocumentId!;
const savedSnapshot = structuredClone(
  nexus.state.currentProject
);
const saving = lifecycle.beginOperation("saving");
const rename =
  buildSetLayerDocumentNameTransaction(
    nexus.state.currentProject,
    {
      layerDocumentId: rootId,
      name: "Edited after save began",
    }
  );
assert.equal(rename.ok, true);
if (!rename.ok) throw new Error(rename.error.message);
const renamed = nexus.transition({
  kind: "commit-layer-transaction",
  transaction: rename.transaction,
});
assert.equal(renamed.ok, true);
assert.equal(lifecycle.read().dirty, "dirty");

const markedSaved = lifecycle.markSaved({
  savedSnapshot,
  token: saving,
});
assert.equal(markedSaved.ok, true);
assert.equal(lifecycle.read().document, "file-backed");
assert.equal(
  lifecycle.read().dirty,
  "dirty",
  "Saving an older immutable snapshot must not clean a newer edit"
);
const undoneToSavepoint = nexus.transition({
  kind: "undo",
});
assert.equal(undoneToSavepoint.ok, true);
assert.equal(
  lifecycle.read().dirty,
  "clean",
  "Undo to the canonical savepoint must become clean"
);

const firstLoad =
  lifecycle.beginOperation("loading");
const secondLoad =
  lifecycle.beginOperation("loading");
const beforeStaleNexus = nexus.state;
const beforeStaleRuntime =
  structuredClone(runtimeCalls);
const staleProject = structuredClone(
  nexus.state.currentProject
);
staleProject.metadata.name = "Stale Load";
const staleResult = lifecycle.replaceProject({
  project: staleProject,
  document: "file-backed",
  token: firstLoad,
});
assert.equal(staleResult.ok, false);
if (!staleResult.ok) {
  assert.equal(
    staleResult.error.code,
    "stale-operation"
  );
}
assert.strictEqual(nexus.state, beforeStaleNexus);
assert.deepEqual(runtimeCalls, beforeStaleRuntime);
assert.deepEqual(
  lifecycle.read().operationToken,
  secondLoad
);

const invalidProject = structuredClone(
  nexus.state.currentProject
) as LayerDocumentProject;
invalidProject.payload.layerDocumentsById[
  rootId
].data = {};
const beforeInvalidNexus = nexus.state;
const beforeInvalidProject =
  nexus.state.currentProject;
const beforeInvalidRuntime =
  structuredClone(runtimeCalls);
const invalidResult = lifecycle.replaceProject({
  project: invalidProject,
  document: "file-backed",
  token: secondLoad,
});
assert.equal(invalidResult.ok, false);
if (!invalidResult.ok) {
  assert.equal(
    invalidResult.error.code,
    "invalid-project"
  );
}
assert.strictEqual(nexus.state, beforeInvalidNexus);
assert.strictEqual(
  nexus.state.currentProject,
  beforeInvalidProject
);
assert.deepEqual(runtimeCalls, beforeInvalidRuntime);
assert.equal(lifecycle.read().operation, "idle");

const replacement = structuredClone(
  nexus.state.currentProject
);
replacement.metadata.projectId =
  "loaded-project";
replacement.metadata.name = "Loaded Project";
replacement.payload.layerDocumentsById[
  rootId
].name = "Loaded Root";
const replacementRoot =
  replacement.payload.layerDocumentsById[
    rootId
  ];
assert.equal(replacementRoot.type, "group");
if (replacementRoot.type !== "group") {
  throw new Error("root fixture");
}
replacementRoot.data.durationFrames = 20;
replacementRoot.common.placement.durationFrames =
  20;
playback.commands.setRange(10, 100);
playback.commands.seek(25);
playback.commands.play();
const candidateSnapshot =
  structuredClone(replacement);
const loading =
  lifecycle.beginOperation("loading");
const replaced = lifecycle.replaceProject({
  project: replacement,
  document: "file-backed",
  token: loading,
});
assert.equal(replaced.ok, true);
assert.deepEqual(replacement, candidateSnapshot);
assert.notStrictEqual(
  nexus.state.currentProject,
  replacement
);
assert.equal(
  nexus.state.currentProject.metadata.projectId,
  "loaded-project"
);
assert.equal(nexus.state.undoStack.length, 0);
assert.equal(nexus.state.redoStack.length, 0);
assert.equal(nexus.state.canUndo, false);
assert.equal(nexus.state.canRedo, false);
assert.deepEqual(nexus.state.runtimeSession, {
  selectedTransformKeyframe: null,
});
assert.equal(nexus.state.session.layerSelection, null);
assert.equal(nexus.state.session.sourceSelection, null);
assert.equal(runtimeCalls.stopPlayback, 1);
assert.equal(runtimeCalls.clearDraft, 1);
assert.equal(runtimeCalls.resetLocalUi, 1);
assert.equal(runtimeCalls.resetSourceResolution, 1);
assert.equal(runtimeCalls.recomputeRender, 1);
assert.deepEqual(playback.read(), {
  currentFrame: 19,
  range: { startFrame: 10, endFrame: 20 },
  isPlaying: false,
  loop: false,
});
assert.deepEqual(runtimeCalls.invalidations, [
  { kind: "all" },
]);
assert.equal(disposedResources, 1);
playback.dispose();
assert.equal(runtimeCalls.effects.length, 1);
assert.equal(lifecycle.read().dirty, "clean");
assert.equal(lifecycle.read().operation, "idle");

const newProject = structuredClone(
  initialOptions.project
);
newProject.metadata.projectId = "new-project";
newProject.metadata.name = "New Project";
const newResult = lifecycle.replaceProject({
  project: newProject,
  document: "untitled",
});
assert.equal(newResult.ok, true);
assert.equal(lifecycle.read().document, "untitled");
assert.equal(lifecycle.read().dirty, "clean");
assert.equal(runtimeCalls.stopPlayback, 2);
assert.deepEqual(runtimeCalls.invalidations, [
  { kind: "all" },
  { kind: "all" },
]);
assert.equal(
  disposedResources,
  1,
  "Repeated all invalidation must not dispose an old resource twice"
);

const superseded =
  lifecycle.beginOperation("saving");
const active =
  lifecycle.beginOperation("loading");
assert.equal(
  lifecycle.finishOperation(superseded),
  false
);
assert.deepEqual(
  lifecycle.read().operationToken,
  active
);
assert.equal(
  lifecycle.finishOperation(active),
  true
);
assert.equal(lifecycle.read().operation, "idle");

const oldLoad =
  lifecycle.beginOperation("loading");
const replacementDuringLoad =
  structuredClone(nexus.state.currentProject);
replacementDuringLoad.metadata.projectId =
  "newer-project";
const newer = lifecycle.replaceProject({
  project: replacementDuringLoad,
  document: "untitled",
});
assert.equal(newer.ok, true);
const lateOldLoad = lifecycle.replaceProject({
  project: newProject,
  document: "file-backed",
  token: oldLoad,
});
assert.equal(lateOldLoad.ok, false);
if (!lateOldLoad.ok) {
  assert.equal(
    lateOldLoad.error.code,
    "stale-operation"
  );
}
assert.equal(
  nexus.state.currentProject.metadata.projectId,
  "newer-project"
);

console.log(
  "Layer Document Project lifecycle verification passed"
);
