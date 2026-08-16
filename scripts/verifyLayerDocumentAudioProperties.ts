import assert from "node:assert/strict";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import {
  buildLayerDocumentPropertiesDescriptor,
  buildLayerDocumentPropertiesViewProps,
  prepareLayerDocumentPropertiesCommand,
  type LayerDocumentPropertiesController,
} from "@/engines/properties";

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

const prepared = prepareLayerDocumentPropertiesCommand({
  project,
  selectedLayerDocumentId: "voice",
  command: { kind: "set-audio-properties", layerDocumentId: "voice", name: " Narration ", gain: 99, muted: true, startFrame: 110, durationFrames: 999, sourceOffsetFrames: 90, fadeInFrames: 20, fadeOutFrames: 20 },
});
assert.equal(prepared.ok, true);
if (!prepared.ok) throw new Error(prepared.message);
assert.equal(prepared.historyEntryCount, 1);
assert.equal(project.payload.layerDocumentsById.voice.name, "Voice", "preparation/Draft does not mutate Project");
const audio = prepared.transaction.after.payload.layerDocumentsById.voice;
assert.equal(audio.type, "audio");
if (audio.type !== "audio") throw new Error("expected Audio");
assert.equal(audio.name, "Narration");
assert.equal(audio.revision, 3, "one command increments revision once");
assert.deepEqual(audio.data, { gain: 4, muted: true, fadeInFrames: 10, fadeOutFrames: 0 });
assert.deepEqual({ start: audio.common.placement.startFrame, duration: audio.common.placement.durationFrames, offset: audio.common.placement.sourceOffsetFrames }, { start: 110, duration: 10, offset: 90 });
assert.deepEqual(prepared.transaction.historyEntry.affectedLayerDocumentIds, ["voice"]);
assert.equal(prepared.transaction.before, project, "undo snapshot remains the canonical before Project");

const unchanged = prepareLayerDocumentPropertiesCommand({
  project,
  selectedLayerDocumentId: "voice",
  command: { kind: "set-audio-properties", layerDocumentId: "voice", name: "Voice", gain: 1, muted: false, startFrame: 5, durationFrames: 60, sourceOffsetFrames: 3, fadeInFrames: 2, fadeOutFrames: 3 },
});
assert.equal(unchanged.ok, false);
assert.equal(unchanged.historyEntryCount, 0);

const descriptor = buildLayerDocumentPropertiesDescriptor({ project, selectedLayerDocumentId: "voice", readSourceResolutionStatus: () => "available" });
assert.equal(descriptor.status, "ready");
if (descriptor.status !== "ready") throw new Error("descriptor unavailable");
const controller = {
  read: () => ({ descriptor, displayedTransform: descriptor.descriptor.transform, globalFrame: 0, localFrame: 0, runtime: { selectedLayerDocumentId: "voice", selectedLayerRevision: 2, globalFrame: 0, localFrame: 0, focusedInputId: null, focusedTransform: null, inputDrafts: {} } }),
  readSelectedKeyframe: () => null,
} as unknown as LayerDocumentPropertiesController;
const view = buildLayerDocumentPropertiesViewProps({ controller });
assert.ok(view.readModel.audioSection);
assert.equal(view.readModel.audioSection?.fields.length, 7);
assert.equal(view.readModel.transformSectionVisible, false);
assert.equal(view.readModel.keyframe.visible, false);
assert.equal(view.readModel.modifiers.length, 0);
assert.equal(view.readModel.modifierLibrary.visible, false);

console.log("Layer Document Audio Properties verification passed");
