import assert from "node:assert/strict";
import type { AudioSourceRecord } from "@/models";
import { createInitialLayerDocumentNexusOptions } from "@/editor/layerDocumentEditorBootstrap";
import { createLayerDocumentAudioRuntimeStore } from "@/engines/project";
import { createLayerDocumentProjectLinkedSourcePreparation } from "@/engines/project/adapters/layerDocumentProjectLinkedSourcePreparationAdapter";

const project = structuredClone(
  createInitialLayerDocumentNexusOptions().project
);
const file = new File(["reloaded audio"], "voice.wav", {
  type: "audio/wav",
});
const source: AudioSourceRecord = {
  sourceId: "audio:reload",
  kind: "audio",
  displayName: "voice.wav",
  version: 1,
  refresh: { status: "normal" },
  locator: {
    locatorId: "linked:audio:reload",
    kind: "linked-file",
    suggestedFileName: "voice.wav",
    relativePathHint: "audio/voice.wav",
  },
  contentFingerprint: null,
  data: {
    mimeType: "audio/wav",
    durationFrames: 60,
    channelCount: 2,
    sampleRate: 48_000,
    provenance: "imported",
  },
};
project.payload.sourceRegistry.sourcesById[source.sourceId] = source;

let decodedDisposeCount = 0;
const preparation = createLayerDocumentProjectLinkedSourcePreparation({
  audioDecoder: {
    decode: async () => ({
      decodedAudio: { kind: "fake-audio-buffer" },
      metadata: {
        durationSeconds: 2,
        channelCount: 2,
        sampleRate: 48_000,
      },
      dispose: () => { decodedDisposeCount += 1; },
    }),
  },
});
const prepared = await preparation.prepare({
  project,
  source,
  input: {
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  },
});
assert.equal(prepared.ok, true);
if (!prepared.ok) throw new Error(prepared.message);
assert.equal(prepared.value.resources.length, 0);
assert.equal(prepared.value.audioResources?.length, 1);
assert.deepEqual(prepared.value.availableSourceIds, [source.sourceId]);
assert.equal(prepared.value.contentFingerprint.byteLength, file.size);

const audioRuntime = createLayerDocumentAudioRuntimeStore();
const preflight = audioRuntime.preflight(prepared.value.audioResources ?? []);
assert.equal(preflight.ok, true);
const registered = audioRuntime.register(prepared.value.audioResources ?? []);
assert.equal(registered.ok, true);
prepared.value.transfer();
assert.equal(
  audioRuntime.resolve(source.sourceId)?.metadata.durationSeconds,
  2
);
assert.equal(prepared.value.discard(), 0);
audioRuntime.dispose();
assert.equal(decodedDisposeCount, 1);

console.log("Layer Document Audio Project reload verification passed");
