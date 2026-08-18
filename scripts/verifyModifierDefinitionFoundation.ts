import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LAYER_MODIFIER_DEFINITIONS,
  createDefaultLayerModifier,
  getLayerModifierDefinition,
  normalizeKnownLayerModifier,
  validateKnownLayerModifier,
} from "@/models";
import {
  buildMouthBasicConnectionClip,
} from "@/animation";
import {
  createModifierPropertiesController,
} from "@/engines/properties";
import type {
  LayerDocument,
  LayerDocumentProject,
  LayerModifier,
} from "@/models";

assert.deepEqual(
  LAYER_MODIFIER_DEFINITIONS.map((definition) => definition.type),
  ["acceleration", "mouth-basic", "wiggle", "swing", "oscillate"]
);

const mouth = createDefaultLayerModifier("mouth-basic", {
  layerDocumentId: "mouth",
  durationFrames: 90,
});
assert.equal(mouth.type, "mouth-basic");
assert.equal(mouth.modifierId, "mouth-basic:mouth");
assert.equal(mouth.enabled, true);
assert.equal(mouth.durationFrames, 90);
assert.equal(
  getLayerModifierDefinition("mouth-basic").timeline.contentKind,
  "mouth-segments"
);

const normalizedMouth = normalizeKnownLayerModifier({
  ...mouth,
  durationFrames: 8.9,
  transitionFrames: [7, 2, 2, 10, -1, 4.8],
});
assert.equal(normalizedMouth.type, "mouth-basic");
assert.equal(normalizedMouth.durationFrames, 8);
assert.deepEqual(normalizedMouth.transitionFrames, [2, 4, 7]);
assert.ok(validateKnownLayerModifier({
  ...mouth,
  durationFrames: 8,
  transitionFrames: [4, 2, 2, 9],
}).some((issue) => issue.field === "transitionFrames"));

const acceleration = createDefaultLayerModifier("acceleration", {
  layerDocumentId: "visual",
  durationFrames: 45,
});
assert.deepEqual(acceleration, {
  modifierId: "acceleration:visual",
  type: "acceleration",
  enabled: true,
  properties: ["position"],
  curve: "ease-out-soft",
  startFrame: 0,
  durationFrames: 45,
});

const silent = new Float32Array(48_000);
const clip = buildMouthBasicConnectionClip({
  buffer: {
    sampleRate: 48_000,
    duration: 1,
    numberOfChannels: 1,
    getChannelData: () => silent,
  },
  frameRate: 30,
  audioSourceOffsetFrames: 2,
  audioDurationFrames: 20,
  audioAbsoluteStartFrame: 40,
  targetAbsoluteStartFrame: 10,
  targetSourceOffsetFrames: 3,
});
assert.equal(clip.startFrame, 33);
assert.equal(clip.durationFrames, 20);
assert.deepEqual(clip.transitionFrames, []);

const common = (
  parentLayerDocumentId: string | null,
  startFrame: number,
  sourceId: string | null,
  modifiers: LayerModifier[] = []
): LayerDocument["common"] => ({
  source: sourceId ? { sourceId } : null,
  transform: {
    position: { x: 0, y: 0 },
    transformOffset: { x: 0, y: 0 },
    anchor: { x: 0, y: 0 },
    scale: { x: 100, y: 100 },
    scaleLinked: true,
    rotation: 0,
    opacity: 100,
  },
  placement: {
    parentLayerDocumentId,
    order: 0,
    startFrame,
    durationFrames: 30,
    sourceOffsetFrames: 0,
    visible: true,
    alias: null,
  },
  animation: {
    positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [],
    enabledProperties: { position: false, scale: false, rotation: false, opacity: false },
  },
  effects: [],
  modifiers,
});
const project: LayerDocumentProject = {
  metadata: { schemaVersion: 3, projectId: "project", name: "Project" },
  payload: {
    sourceRegistry: { sourcesById: {} },
    layerDocumentsById: {
      root: {
        layerDocumentId: "root", revision: 0, name: "Project", type: "group",
        common: common(null, 0, null),
        data: { role: "project-root", width: 1080, height: 1920, frameRate: 30, durationFrames: 120 },
      },
      visual: {
        layerDocumentId: "visual", revision: 0, name: "Mouth", type: "drawing",
        common: common("root", 10, null, [mouth]),
        data: { documentVersion: 1, elements: [] },
      },
      audio: {
        layerDocumentId: "audio", revision: 0, name: "Voice", type: "audio",
        common: common("root", 20, "audio-source"),
        data: { gain: 1, muted: false, fadeInFrames: 0, fadeOutFrames: 0 },
      },
    },
  },
};
let dispatched: { id: string; modifiers: LayerModifier[] } | null = null;
const modifierController = createModifierPropertiesController({
  readProject: () => project,
  readDecodedAudio: () => ({
    sampleRate: 48_000,
    duration: 1,
    numberOfChannels: 1,
    getChannelData: () => silent,
  }),
  dispatchModifiers: (id, modifiers) => {
    dispatched = { id, modifiers };
    return { ok: true };
  },
});
assert.deepEqual(modifierController.readMouthAudioOptions(), [{ id: "audio", label: "Voice" }]);
assert.deepEqual(modifierController.connectMouthBasicAudio("visual", "audio"), { ok: true });
assert.equal(dispatched?.id, "visual");
const connected = dispatched?.modifiers.find((modifier) => modifier.type === "mouth-basic");
assert.equal(connected?.type, "mouth-basic");
if (connected?.type === "mouth-basic") {
  assert.equal(connected.audioLayerDocumentId, "audio");
  assert.equal(connected.startFrame, 10);
}

const root = readFileSync(
  new URL("../src/editor/useEditorCompositionRoot.ts", import.meta.url),
  "utf8"
);
assert.doesNotMatch(root, /analyzeMouthBasicTransitions/);
assert.doesNotMatch(root, /absoluteLayerStart/);
assert.doesNotMatch(root, /kind:\s*["']set-modifiers["']/);
assert.match(root, /readDecodedAudio:/);

console.log("Modifier Definition foundation verification passed");
