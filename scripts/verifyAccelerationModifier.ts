import assert from "node:assert/strict";
import { evaluateAccelerationProgress, remapAccelerationFrame } from "@/animation";
import type { LayerDocument } from "@/models";
import { evaluateLayerDocumentTransform } from "@/render/helpers/layerDocumentRuntimeEvaluationHelpers";

const modifier = {
  modifierId: "acceleration:visual",
  type: "acceleration" as const,
  enabled: true,
  properties: ["position" as const],
  curve: "ease-in-soft" as const,
  startFrame: 0,
  durationFrames: 10,
};

assert.equal(evaluateAccelerationProgress("ease-in-soft", 0.5), 0.25);
assert.equal(evaluateAccelerationProgress("ease-out-soft", 0.5), 0.75);
assert.equal(evaluateAccelerationProgress("ease-in-strong", 0.5), 0.0625);
assert.equal(evaluateAccelerationProgress("ease-out-strong", 0.5), 0.9375);
assert.equal(remapAccelerationFrame(modifier, -1), -1);
assert.equal(remapAccelerationFrame(modifier, 5), 2.5);
assert.equal(remapAccelerationFrame(modifier, 10), 10);

const visual: LayerDocument = {
  layerDocumentId: "visual",
  revision: 0,
  name: "레이어",
  type: "drawing",
  common: {
    source: null,
    transform: {
      position: { x: 0, y: 0 }, transformOffset: { x: 0, y: 0 }, anchor: { x: 0, y: 0 },
      scale: { x: 100, y: 100 }, scaleLinked: true, rotation: 0, opacity: 100,
    },
    placement: { parentLayerDocumentId: "root", order: 0, startFrame: 0, durationFrames: 20, sourceOffsetFrames: 0, visible: true, alias: null },
    animation: {
      positionKeyframes: [
        { frame: 0, value: { x: 0, y: 0 }, interpolation: "linear" },
        { frame: 10, value: { x: 100, y: 0 }, interpolation: "linear" },
      ],
      scaleKeyframes: [
        { frame: 0, value: { x: 100, y: 100 }, interpolation: "linear" },
        { frame: 10, value: { x: 200, y: 200 }, interpolation: "linear" },
      ],
      rotationKeyframes: [], opacityKeyframes: [],
      enabledProperties: { position: true, scale: true, rotation: false, opacity: false },
    },
    effects: [], modifiers: [modifier],
  },
  data: { documentVersion: 1, elements: [] },
};

const middle = evaluateLayerDocumentTransform(visual, 5, 30);
assert.equal(middle.transform.position.x, 25, "selected position uses remapped time");
assert.equal(middle.transform.scale.x, 150, "unselected scale remains linear");
assert.equal(evaluateLayerDocumentTransform(visual, 10, 30).transform.position.x, 100, "clip boundary remains continuous");

console.log("Acceleration modifier verification passed");
