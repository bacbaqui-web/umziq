import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import { createAudioBasicNexusPort } from "@/engines/audio";
import { readFileSync } from "node:fs";

function common(parentLayerDocumentId: string | null, sourceId: string | null): LayerDocumentCommon {
  return {
    source: sourceId ? { sourceId } : null,
    transform: { position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 }, scaleLinked: true, rotation: 0, opacity: 100 },
    placement: { parentLayerDocumentId, order: 0, startFrame: 5, durationFrames: 60, sourceOffsetFrames: 3, visible: true, alias: null },
    animation: { positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [], enabledProperties: { position: false, scale: false, rotation: false, opacity: false } },
    effects: [], modifiers: [],
  };
}

const project: LayerDocumentProject = {
  metadata: { schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION, projectId: "audio-properties", name: "Audio properties" },
  payload: {
    sourceRegistry: { sourcesById: {
      audio: { sourceId: "audio", kind: "audio", displayName: "voice.wav", version: 1, refresh: { status: "normal" }, locator: { locatorId: "audio", kind: "linked-file", suggestedFileName: "voice.wav", relativePathHint: null }, contentFingerprint: null, data: { mimeType: "audio/wav", durationFrames: 100, channelCount: 1, sampleRate: 48_000, provenance: "imported" } },
    } },
    layerDocumentsById: {
      root: { layerDocumentId: "root", revision: 0, name: "Root", type: "group", common: common(null, null), data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 120 } },
      cut: { layerDocumentId: "cut", revision: 0, name: "Cut", type: "group", common: common("root", null), data: { role: "composition", width: 1080, height: 1920, frameRate: 30, durationFrames: 120 } },
      voice: { layerDocumentId: "voice", revision: 2, name: "Voice", type: "audio", common: common("cut", "audio"), data: { gain: 1, muted: false, fadeInFrames: 2, fadeOutFrames: 3 } },
    },
  },
};

let committed = null as import("@/models").LayerDocumentTransaction | null;
const port = createAudioBasicNexusPort({
  readProject: () => project,
  readSelectedLayerDocumentId: () => "voice",
  commit: (transaction) => { committed = transaction; return { ok: true }; },
});
assert.equal(port.commit({ ...port.read()!, name: " Narration ", gain: 99, muted: true, startFrame: 110, durationFrames: 999, sourceOffsetFrames: 90, fadeInFrames: 20, fadeOutFrames: 20 }).ok, true);
if (!committed) throw new Error("Audio transaction was not committed");
assert.equal(project.payload.layerDocumentsById.voice.name, "Voice", "preparation/Draft does not mutate Project");
const audio = committed.after.payload.layerDocumentsById.voice;
assert.equal(audio.type, "audio");
if (audio.type !== "audio") throw new Error("expected Audio");
assert.equal(audio.name, "Narration");
assert.equal(audio.revision, 3, "one command increments revision once");
assert.deepEqual(audio.data, { gain: 4, muted: true, fadeInFrames: 10, fadeOutFrames: 0 });
assert.deepEqual({ start: audio.common.placement.startFrame, duration: audio.common.placement.durationFrames, offset: audio.common.placement.sourceOffsetFrames }, { start: 110, duration: 10, offset: 90 });
assert.deepEqual(committed.historyEntry.affectedLayerDocumentIds, ["voice"]);
assert.equal(committed.before, project, "undo snapshot remains the canonical before Project");

assert.equal(port.commit(port.read()!).ok, false);

const audioEngine = readFileSync("src/engines/audio/useAudioEngine.ts", "utf8");
const audioBasicController = readFileSync("src/engines/audio/controllers/useAudioBasicController.ts", "utf8");
const audioBasicViewHelpers = readFileSync("src/engines/audio/helpers/audioBasicViewModelHelpers.ts", "utf8");
const visualComposer = readFileSync("src/engines/visual/composers/useLayerDocumentPropertiesComposer.ts", "utf8");
assert.match(audioEngine, /basicPort/);
assert.match(audioEngine, /useAudioComposer/);
assert.match(audioBasicViewHelpers, /fadeInFrames/);
assert.match(audioBasicController, /toggleMuted/);
assert.doesNotMatch(audioEngine, /@\/engines\/visual/);
assert.doesNotMatch(visualComposer, /AudioProperties|audioSection/);

console.log("Layer Document Audio Properties verification passed");
