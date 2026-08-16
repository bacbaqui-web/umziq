import assert from "node:assert/strict";
import {
  prepareLayerDocumentAudioUpdate,
  queryLayerDocumentAudio,
} from "@/layer-types";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocumentCommon,
  type LayerDocumentProject,
} from "@/models";
import { getEditorPlaceholderDescriptorForLayerType } from "@/render/adapters/editorPlaceholderInputAdapter";

const placeholderExpectations = {
  drawing: { placeholderKind: "drawing", label: null, fill: "#747980", textColor: "#f5f7f9", size: { width: 240, height: 160 } },
  text: { placeholderKind: "text", label: "TEXT", fill: "#39414b", textColor: "#ffffff", size: { width: 320, height: 120 } },
  audio: { placeholderKind: "audio", label: "AUDIO", fill: "#30363d", textColor: "#d7e7f7", size: { width: 320, height: 96 } },
} as const;

for (const type of ["drawing", "text", "audio"] as const) {
  assert.deepEqual(getEditorPlaceholderDescriptorForLayerType(type), placeholderExpectations[type]);
}
assert.equal(getEditorPlaceholderDescriptorForLayerType("shape"), null);

function common(parentLayerDocumentId: string | null, order: number): LayerDocumentCommon {
  return {
    source: null,
    transform: {
      position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 },
      anchor: { x: 0, y: 0 }, scale: { x: 100, y: 100 },
      scaleLinked: true, rotation: 0, opacity: 100,
    },
    placement: {
      parentLayerDocumentId, order, startFrame: 0, durationFrames: 90,
      sourceOffsetFrames: 0, visible: true, alias: null,
    },
    animation: {
      positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [],
      enabledProperties: { position: false, scale: false, rotation: false, opacity: false },
    },
    effects: [], modifiers: [],
  };
}

const project: LayerDocumentProject = {
  metadata: {
    schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
    projectId: "audio-contract-fixture", name: "Audio contract fixture",
  },
  payload: {
    sourceRegistry: { sourcesById: {} },
    layerDocumentsById: {
      root: {
        layerDocumentId: "root", revision: 0, name: "Root", type: "group",
        common: common(null, 0),
        data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 90 },
      },
      audio: {
        layerDocumentId: "audio", revision: 0, name: "Voice", type: "audio",
        common: { ...common("root", 0), effects: [{
          effectId: "audio-effect", type: "future-audio-effect", enabled: false,
          parameters: { amount: 0.5 },
        }] },
        data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },
      },
    },
  },
};

const query = queryLayerDocumentAudio(project, "audio");
assert.equal(query.status, "ready");
if (query.status !== "ready") throw new Error("Audio query must be ready");
query.data.gain = 99;
assert.equal(project.payload.layerDocumentsById.audio.data.gain, 1);

const prepared = prepareLayerDocumentAudioUpdate(project, {
  layerDocumentId: "audio",
  data: { gain: 0.5, muted: true, fadeInFrames: 3, fadeOutFrames: 6 },
});
assert.equal(prepared.ok, true);
if (!prepared.ok) throw new Error(prepared.error.message);
assert.deepEqual(prepared.transaction.after.payload.layerDocumentsById.audio.data, {
  gain: 0.5, muted: true, fadeInFrames: 3, fadeOutFrames: 6,
});
assert.deepEqual(
  prepared.transaction.after.payload.layerDocumentsById.audio.common.effects,
  project.payload.layerDocumentsById.audio.common.effects
);
assert.equal(project.payload.layerDocumentsById.audio.data.gain, 1);
assert.equal(queryLayerDocumentAudio(project, "missing").status, "not-found");
assert.equal(queryLayerDocumentAudio(project, "root").status, "type-mismatch");

const invalid = prepareLayerDocumentAudioUpdate(project, {
  layerDocumentId: "audio",
  data: { gain: -1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },
});
assert.equal(invalid.ok, false);

console.log("Layer Type support verification passed");
