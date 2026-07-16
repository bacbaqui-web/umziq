import assert from "node:assert/strict";
import { createPropertyTrackState, type Composition, type Layer } from "../src/models";
import {
  applyAnchorToCompositions,
  applyPositionToCompositions,
  applyScaleToCompositions,
  movePropertyKeyframeInCompositions,
  removePropertyKeyframeFromCompositions,
  setPropertyTrackInCompositions,
  setScaleLinkedInCompositions,
} from "../src/engines/animation/actions/animationProjectMutations";

const layer: Layer = {
  id: "layer",
  name: "Layer",
  visible: true,
  position: { x: 1, y: 2 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 10, y: 20 },
  positionKeyframes: [{ frame: 0, value: { x: 1, y: 2 } }],
  scale: { x: 100, y: 100 },
  scaleKeyframes: [],
  scaleLinked: true,
  rotation: 0,
  rotationKeyframes: [],
  opacity: 100,
  opacityKeyframes: [],
  enabledProperties: createPropertyTrackState(),
};

const child: Composition = {
  id: "child",
  name: "Child",
  type: "sub",
  layers: [layer],
  position: { x: 0, y: 0 },
  positionKeyframes: [],
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 50, y: 50 },
  scale: { x: 100, y: 100 },
  scaleKeyframes: [],
  scaleLinked: true,
  rotation: 0,
  rotationKeyframes: [],
  opacity: 100,
  opacityKeyframes: [],
  enabledProperties: createPropertyTrackState(),
};

const root: Composition = { ...child, id: "root", name: "Root", type: "main", layers: [], children: [child] };
const source = [root];

const staticPosition = applyPositionToCompositions(
  source,
  { kind: "layer", id: "layer" },
  { x: 20, y: 30 },
  5,
  false
);
assert.deepEqual(staticPosition[0].children?.[0].layers[0].position, { x: 20, y: 30 });
assert.deepEqual(staticPosition[0].children?.[0].layers[0].positionKeyframes, layer.positionKeyframes);
assert.deepEqual(layer.position, { x: 1, y: 2 });

const animatedPosition = applyPositionToCompositions(
  source,
  { kind: "layer", id: "layer" },
  { x: 50, y: 60 },
  10,
  true
);
assert.deepEqual(animatedPosition[0].children?.[0].layers[0].positionKeyframes, [
  { frame: 0, value: { x: 1, y: 2 } },
  { frame: 10, value: { x: 50, y: 60 } },
]);

const compositionScale = applyScaleToCompositions(
  source,
  { kind: "composition", id: "child" },
  { x: -120, y: 80 },
  3,
  true
);
assert.deepEqual(compositionScale[0].children?.[0].scale, { x: -120, y: 80 });
assert.deepEqual(compositionScale[0].children?.[0].scaleKeyframes, [
  { frame: 3, value: { x: -120, y: 80 } },
]);

const trackEnabled = setPropertyTrackInCompositions(
  source,
  { kind: "layer", id: "layer" },
  "opacity",
  true,
  { position: { x: 0, y: 0 }, scale: { x: 100, y: 100 }, rotation: 0, opacity: 75 },
  { position: 4, scale: 4, rotation: 4, opacity: 4 }
);
assert.equal(trackEnabled[0].children?.[0].layers[0].enabledProperties.opacity, true);
assert.deepEqual(trackEnabled[0].children?.[0].layers[0].opacityKeyframes, [{ frame: 4, value: 75 }]);

const linked = setScaleLinkedInCompositions(source, { kind: "layer", id: "layer" }, false);
assert.equal(linked[0].children?.[0].layers[0].scaleLinked, false);

const anchored = applyAnchorToCompositions(
  source,
  { kind: "composition", id: "child" },
  { x: 12, y: 13 },
  { x: 4, y: 5 }
);
assert.deepEqual(anchored[0].children?.[0].anchor, { x: 12, y: 13 });
assert.deepEqual(anchored[0].children?.[0].transformOffset, { x: 4, y: 5 });

const collisionSource = applyPositionToCompositions(
  animatedPosition,
  { kind: "layer", id: "layer" },
  { x: 70, y: 80 },
  20,
  true
);
const moved = movePropertyKeyframeInCompositions(collisionSource, {
  target: { kind: "layer", id: "layer" },
  property: "position",
  frame: 10,
  toFrame: 20,
});
assert.deepEqual(moved[0].children?.[0].layers[0].positionKeyframes, [
  { frame: 0, value: { x: 1, y: 2 } },
  { frame: 20, value: { x: 50, y: 60 } },
]);

const removed = removePropertyKeyframeFromCompositions(moved, {
  target: { kind: "layer", id: "layer" },
  property: "position",
  frame: 20,
});
assert.deepEqual(removed[0].children?.[0].layers[0].positionKeyframes, [
  { frame: 0, value: { x: 1, y: 2 } },
]);

console.log("Animation command mutation verification passed");
