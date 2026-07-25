import assert from "node:assert/strict";
import {
  prepareLayerDocumentAudioFutureCommand,
} from "@/layer-types";
import type {
  LayerDocumentProject,
} from "@/models";
import {
  getEditorPlaceholderDescriptorForLayerType,
} from "@/engines/playback-render/adapters/editorPlaceholderInputAdapter";

const placeholderExpectations = {
  drawing: {
    placeholderKind: "drawing",
    label: null,
    fill: "#747980",
    textColor: "#f5f7f9",
    size: { width: 240, height: 160 },
  },
  text: {
    placeholderKind: "text",
    label: "TEXT",
    fill: "#39414b",
    textColor: "#ffffff",
    size: { width: 320, height: 120 },
  },
  audio: {
    placeholderKind: "audio",
    label: "AUDIO",
    fill: "#30363d",
    textColor: "#d7e7f7",
    size: { width: 320, height: 96 },
  },
} as const;

for (const type of [
  "drawing",
  "text",
  "audio",
] as const) {
  assert.deepEqual(
    getEditorPlaceholderDescriptorForLayerType(type),
    placeholderExpectations[type],
    `${type} placeholder 표시 계약이 변경되었습니다.`
  );
}
assert.equal(
  getEditorPlaceholderDescriptorForLayerType("shape"),
  null
);

const project = {
  projectId: "audio-unsupported-fixture",
} as unknown as LayerDocumentProject;
assert.deepEqual(
  prepareLayerDocumentAudioFutureCommand(project, {
    layerDocumentId: "audio-layer",
    operation: "domain-update",
  }),
  {
    ok: false,
    status: "unsupported",
    reason: "audio-domain-data-empty",
    layerDocumentId: "audio-layer",
    project,
    projectUpdateCount: 0,
    transactionCount: 0,
    historyEntryCount: 0,
  }
);

console.log("Layer Type support verification passed");
