import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  createLayerDocumentAudioRuntimeStore,
  createLayerDocumentSourceRuntimeResolutionStore,
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
  prepareLayerDocumentAudioImport,
  resolveLayerDocumentAudioImportCut,
} from "@/engines/project";
import { confirmLayerDocumentAudioPreparedSource } from "@/engines/library";

function common(parentLayerDocumentId: string | null, order: number): LayerDocumentCommon {
  return {
    source: null,
    transform: {
      position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 },
      anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 },
      scaleLinked: true, rotation: 0, opacity: 100,
    },
    placement: {
      parentLayerDocumentId, order, startFrame: 0, durationFrames: 300,
      sourceOffsetFrames: 0, visible: true, alias: null,
    },
    animation: {
      positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [],
      enabledProperties: { position: false, scale: false, rotation: false, opacity: false },
    },
    effects: [], modifiers: [],
  };
}

function fixture(): LayerDocumentProject {
  return {
    metadata: { schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, projectId: "audio-import", name: "Audio import" },
    payload: {
      sourceRegistry: { sourcesById: {} },
      layerDocumentsById: {
        root: {
          layerDocumentId: "root", revision: 0, name: "Root", type: "group",
          common: common(null, 0),
          data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 300 },
        },
        cut: {
          layerDocumentId: "cut", revision: 0, name: "Cut", type: "group",
          common: common("root", 0),
          data: { role: "composition", width: 1080, height: 1920, frameRate: 30, durationFrames: 300 },
        },
      },
    },
  };
}

let project = fixture();
assert.equal(resolveLayerDocumentAudioImportCut({ project, selectedLayerDocumentId: "cut" }), "cut");
assert.equal(resolveLayerDocumentAudioImportCut({ project, selectedLayerDocumentId: "root" }), null);

let disposed = 0;
const decoder = {
  decode: async () => ({
    decodedAudio: { fixture: true },
    metadata: { durationSeconds: 2, channelCount: 2, sampleRate: 48_000 },
    dispose: () => { disposed += 1; },
  }),
};
const file = new File([new Uint8Array([1, 2, 3])], "voice.wav", { type: "audio/wav" });
const prepared = await prepareLayerDocumentAudioImport({
  project, file, token: "first", selectedLayerDocumentId: "cut", decoder,
});
assert.equal(prepared.command.sources.length, 1);
assert.equal(prepared.command.layers[0].common.placement.parentLayerDocumentId, "cut");
assert.equal(prepared.command.layers[0].common.placement.durationFrames, 60);
assert.deepEqual(prepared.command.parentDurationExtensions, [{
  layerDocumentId: "cut",
  durationFrames: 300,
}]);

const longPrepared = await prepareLayerDocumentAudioImport({
  project: fixture(), file, token: "long", selectedLayerDocumentId: "cut",
  decoder: {
    decode: async () => ({
      decodedAudio: { fixture: "long" },
      metadata: { durationSeconds: 12.01, channelCount: 2, sampleRate: 48_000 },
    }),
  },
});
assert.equal(
  longPrepared.command.layers[0].common.placement.durationFrames,
  361,
  "fractional Audio duration rounds up so the tail is not truncated"
);
const longTransaction = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
  .prepareImport(fixture(), longPrepared.command);
assert.equal(longTransaction.ok, true);
if (longTransaction.ok) {
  assert.equal(
    longTransaction.transaction.after.payload.layerDocumentsById.cut.type === "group" &&
      longTransaction.transaction.after.payload.layerDocumentsById.cut.data.durationFrames,
    361,
    "Audio import extends the Cut to the full source duration"
  );
  assert.equal(
    longTransaction.transaction.after.payload.layerDocumentsById.root.type === "group" &&
      longTransaction.transaction.after.payload.layerDocumentsById.root.data.durationFrames,
    361,
    "Audio import extends ancestor playback duration with the Cut"
  );
}
longPrepared.runtime.cancel();

const audioRuntime = createLayerDocumentAudioRuntimeStore();
const resolution = createLayerDocumentSourceRuntimeResolutionStore();
let commits = 0;
const confirm = confirmLayerDocumentAudioPreparedSource({
  prepared,
  readProject: () => project,
  prepare: (current, command) =>
    LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(current, command),
  commit: (result) => {
    if (!result.ok) return { ok: false as const, stage: "preparation" as const, message: result.error.message };
    project = result.transaction.after;
    commits += 1;
    return { ok: true as const };
  },
  runtime: audioRuntime,
  sourceResolution: resolution,
});
assert.equal(confirm.ok, true, JSON.stringify(confirm));
assert.equal(commits, 1);
assert.equal(Object.keys(project.payload.sourceRegistry.sourcesById).length, 1);
assert.equal(project.payload.layerDocumentsById[prepared.layerDocumentId].type, "audio");
assert.equal(audioRuntime.resolve(prepared.sourceId)?.metadata.sampleRate, 48_000);
assert.equal(resolution.read(prepared.sourceId).status, "available");

const shared = await prepareLayerDocumentAudioImport({
  project, file, token: "second", explicitCutLayerDocumentId: "cut", decoder,
});
assert.equal(shared.reusedSource, true);
assert.equal(shared.command.sources.length, 0);
const sharedResult = confirmLayerDocumentAudioPreparedSource({
  prepared: shared, readProject: () => project,
  prepare: (current, command) => LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(current, command),
  commit: (result) => {
    if (!result.ok) return { ok: false as const, stage: "preparation" as const, message: result.error.message };
    project = result.transaction.after; commits += 1; return { ok: true as const };
  },
  runtime: audioRuntime, sourceResolution: resolution,
});
assert.equal(sharedResult.ok, true);
assert.equal(Object.keys(project.payload.sourceRegistry.sourcesById).length, 1);
assert.equal(commits, 2);
assert.equal(disposed, 1, "duplicate decoded resource must be disposed");

const cancelled = await prepareLayerDocumentAudioImport({
  project, file, token: "cancel", explicitCutLayerDocumentId: "cut", decoder,
});
assert.equal(cancelled.runtime.cancel().disposedCount, 1);
const stale = confirmLayerDocumentAudioPreparedSource({
  prepared: cancelled, readProject: () => project,
  prepare: (current, command) => LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(current, command),
  commit: () => { throw new Error("must not commit"); },
  runtime: audioRuntime, sourceResolution: resolution,
});
assert.equal(stale.ok, false);
assert.equal(commits, 2);

await assert.rejects(
  prepareLayerDocumentAudioImport({
    project,
    file: new File(["x"], "not-audio.txt", { type: "text/plain" }),
    token: "invalid", explicitCutLayerDocumentId: "cut", decoder,
  }),
  /audio\/\*/
);
assert.equal(commits, 2);
audioRuntime.dispose();
console.log("Layer Document Audio import verification passed");
