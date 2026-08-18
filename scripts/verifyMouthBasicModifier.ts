import assert from "node:assert/strict";
import {
  analyzeMouthBasicTransitions,
  evaluateMouthBasicOpacity,
} from "@/animation";
import { evaluateLayerDocumentTransform } from "@/render/helpers/layerDocumentRuntimeEvaluationHelpers";
import type { LayerDocument } from "@/models";

const sampleRate = 48_000;
const samples = new Float32Array(sampleRate);
for (let index = Math.floor(sampleRate * 0.2); index < Math.floor(sampleRate * 0.62); index += 1) {
  samples[index] = Math.sin(index / sampleRate * Math.PI * 2 * 220) * 0.6;
}
const analysis = analyzeMouthBasicTransitions({
  sampleRate,
  duration: 1,
  numberOfChannels: 1,
  getChannelData: () => samples,
}, 30);
assert.equal(analysis.durationFrames, 30);
assert.ok(analysis.transitionFrames.length >= 4, "speech produces editable opacity transitions");
assert.ok(analysis.transitionFrames[0]! >= 5 && analysis.transitionFrames[0]! <= 7, "speech begins near 0.2 seconds");

const mouth = {
  modifierId: "mouth:visual",
  type: "mouth-basic" as const,
  enabled: true,
  audioLayerDocumentId: "voice",
  startFrame: 10,
  durationFrames: analysis.durationFrames,
  transitionFrames: analysis.transitionFrames,
};
assert.equal(evaluateMouthBasicOpacity(mouth, 9), 100);
assert.equal(evaluateMouthBasicOpacity(mouth, 10 + analysis.transitionFrames[0]!), 0);
assert.equal(evaluateMouthBasicOpacity(mouth, 40), 100);

const visual: LayerDocument = {
  layerDocumentId: "visual",
  revision: 0,
  name: "입",
  type: "drawing",
  common: {
    source: null,
    transform: {
      position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 },
      scale: { x: 100, y: 100 }, scaleLinked: true, rotation: 0, opacity: 80,
    },
    placement: { parentLayerDocumentId: "root", order: 0, startFrame: 0, durationFrames: 60, sourceOffsetFrames: 0, visible: true, alias: null },
    animation: { positionKeyframes: [], scaleKeyframes: [], rotationKeyframes: [], opacityKeyframes: [], enabledProperties: { position: false, scale: false, rotation: false, opacity: false } },
    effects: [], modifiers: [mouth],
  },
  data: { documentVersion: 1, elements: [] },
};
assert.equal(evaluateLayerDocumentTransform(visual, 10 + analysis.transitionFrames[0]!, 30).opacity, 0);
assert.equal(evaluateLayerDocumentTransform(visual, 0, 30).opacity, 80);

console.log("Mouth basic modifier verification passed");
