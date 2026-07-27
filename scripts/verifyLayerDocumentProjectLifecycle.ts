import assert from "node:assert/strict";
import {
  buildLayerDocumentGroupScopeReadModel,
  buildSetLayerDocumentNameTransaction,
  type LayerDocumentProject,
} from "@/models";
import {
  createLayerDocumentProjectLifecycleController,
  createLayerDocumentProjectOwnerState,
  reduceLayerDocumentProjectOwner,
  type LayerDocumentProjectOwnerAction,
  type LayerDocumentProjectOwnerState,
} from "@/engines/project";
import {
  createInitialLayerDocumentOwnerOptions,
} from "@/editor/layerDocumentEditorBootstrap";
import {
  createLayerDocumentSourceRuntimeResourceCache,
} from "@/render";
import {
  createLayerDocumentTimelinePlaybackRuntime,
} from "@/engines/timeline/adapters/layerDocumentTimelinePlaybackAdapter";

const initialOptions =
  createInitialLayerDocumentOwnerOptions();
const initialized =
  createLayerDocumentProjectOwnerState(initialOptions);
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
          owner.state.currentProject,
          owner.state.session
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
    owner,
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
      publishOwnerEffect: (effect) => {
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
  owner.state.currentProject
);
const saving = lifecycle.beginOperation("saving");
const rename =
  buildSetLayerDocumentNameTransaction(
    owner.state.currentProject,
    {
      layerDocumentId: rootId,
      name: "Edited after save began",
    }
  );
assert.equal(rename.ok, true);
if (!rename.ok) throw new Error(rename.error.message);
const renamed = owner.transition({
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
const undoneToSavepoint = owner.transition({
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
const beforeStaleOwner = owner.state;
const beforeStaleRuntime =
  structuredClone(runtimeCalls);
const staleProject = structuredClone(
  owner.state.currentProject
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
assert.strictEqual(owner.state, beforeStaleOwner);
assert.deepEqual(runtimeCalls, beforeStaleRuntime);
assert.deepEqual(
  lifecycle.read().operationToken,
  secondLoad
);

const invalidProject = structuredClone(
  owner.state.currentProject
) as LayerDocumentProject;
invalidProject.payload.layerDocumentsById[
  rootId
].data = {};
const beforeInvalidOwner = owner.state;
const beforeInvalidProject =
  owner.state.currentProject;
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
assert.strictEqual(owner.state, beforeInvalidOwner);
assert.strictEqual(
  owner.state.currentProject,
  beforeInvalidProject
);
assert.deepEqual(runtimeCalls, beforeInvalidRuntime);
assert.equal(lifecycle.read().operation, "idle");

const replacement = structuredClone(
  owner.state.currentProject
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
  owner.state.currentProject,
  replacement
);
assert.equal(
  owner.state.currentProject.metadata.projectId,
  "loaded-project"
);
assert.equal(owner.state.undoStack.length, 0);
assert.equal(owner.state.redoStack.length, 0);
assert.equal(owner.state.canUndo, false);
assert.equal(owner.state.canRedo, false);
assert.deepEqual(owner.state.runtimeSession, {
  selectedTransformKeyframe: null,
});
assert.equal(owner.state.session.layerSelection, null);
assert.equal(owner.state.session.sourceSelection, null);
assert.equal(runtimeCalls.stopPlayback, 1);
assert.equal(runtimeCalls.clearDraft, 1);
assert.equal(runtimeCalls.resetLocalUi, 1);
assert.equal(runtimeCalls.resetSourceResolution, 1);
assert.equal(runtimeCalls.recomputeRender, 1);
assert.deepEqual(playback.read(), {
  currentFrame: 19,
  range: { startFrame: 10, endFrame: 20 },
  isPlaying: false,
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
  structuredClone(owner.state.currentProject);
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
  owner.state.currentProject.metadata.projectId,
  "newer-project"
);

console.log(
  "Layer Document Project lifecycle verification passed"
);
