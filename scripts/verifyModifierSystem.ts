import assert from "node:assert/strict";
import {
  addModifierToCompositions,
  removeModifierFromCompositions,
  updateModifierNumberInCompositions,
} from "@/engines/animation/actions/animationProjectMutations";
import {
  applyPositionModifiers,
  createDefaultModifier,
  evaluateCompositionBasePosition,
  evaluateCompositionPosition,
  evaluateLayerBasePosition,
  evaluateLayerPosition,
  evaluatePositionKeyframes,
  evaluateWiggleOffset,
  normalizeModifierInstances,
  normalizeTargetModifiers,
} from "@/engines/animation";
import { createPropertyTrackState, type Composition, type Layer } from "@/models";

const legacyLayer = normalizeTargetModifiers({ id: "legacy-layer", name: "Legacy" });
const legacyComposition = normalizeTargetModifiers({ id: "legacy-comp", layers: [] });
assert.deepEqual(legacyLayer.modifiers, []);
assert.deepEqual(legacyComposition.modifiers, []);
assert.deepEqual(normalizeModifierInstances(undefined, "missing"), []);

const defaultWiggle = createDefaultModifier("wiggle", "layer");
assert.deepEqual(defaultWiggle, {
  id: "layer:wiggle",
  type: "wiggle",
  frequency: 0,
  amount: 0,
});

const layer: Layer = {
  id: "layer",
  name: "Layer",
  visible: true,
  position: { x: 20, y: 30 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 10, y: 10 },
  positionKeyframes: [
    { frame: 0, value: { x: 20, y: 30 } },
    { frame: 30, value: { x: 80, y: 90 } },
  ],
  scale: { x: 100, y: 100 },
  scaleKeyframes: [],
  scaleLinked: true,
  rotation: 0,
  rotationKeyframes: [],
  opacity: 100,
  opacityKeyframes: [],
  enabledProperties: createPropertyTrackState({ position: true }),
  modifiers: [],
};
const composition: Composition = {
  id: "comp",
  name: "Composition",
  type: "main",
  layers: [layer],
  children: [],
  position: { x: 50, y: 50 },
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
  modifiers: [],
};

const added = addModifierToCompositions(
  [composition],
  { kind: "layer", id: layer.id },
  "wiggle"
);
const duplicate = addModifierToCompositions(
  added,
  { kind: "layer", id: layer.id },
  "wiggle"
);
assert.equal(duplicate[0]?.layers[0]?.modifiers.length, 1);
assert.deepEqual(composition.layers[0]?.modifiers, []);

const configuredFrequency = updateModifierNumberInCompositions(
  duplicate,
  { kind: "layer", id: layer.id },
  "wiggle",
  "frequency",
  2
);
const configured = updateModifierNumberInCompositions(
  configuredFrequency,
  { kind: "layer", id: layer.id },
  "wiggle",
  "amount",
  15
);
assert.deepEqual(configured[0]?.layers[0]?.modifiers[0], {
  id: "layer:wiggle",
  type: "wiggle",
  frequency: 2,
  amount: 15,
});

const clamped = updateModifierNumberInCompositions(
  configured,
  { kind: "layer", id: layer.id },
  "wiggle",
  "amount",
  -10
);
assert.equal(clamped[0]?.layers[0]?.modifiers[0]?.amount, 0);

const removed = removeModifierFromCompositions(
  configured,
  { kind: "layer", id: layer.id },
  "wiggle"
);
assert.deepEqual(removed[0]?.layers[0]?.modifiers, []);

assert.deepEqual(
  applyPositionModifiers({ x: 10, y: 20 }, "layer", [defaultWiggle], 12, 30),
  { x: 10, y: 20 }
);
assert.deepEqual(
  applyPositionModifiers(
    { x: 10, y: 20 },
    "layer",
    [{ ...defaultWiggle, frequency: 0, amount: 20 }],
    12,
    30
  ),
  { x: 10, y: 20 }
);
assert.deepEqual(
  applyPositionModifiers(
    { x: 10, y: 20 },
    "layer",
    [{ ...defaultWiggle, frequency: 2, amount: 0 }],
    12,
    30
  ),
  { x: 10, y: 20 }
);

const activeWiggle = { ...defaultWiggle, frequency: 2, amount: 15 };
const offsetA = evaluateWiggleOffset(activeWiggle, "layer", 10, 30);
const offsetARepeat = evaluateWiggleOffset(activeWiggle, "layer", 10, 30);
const offsetB = evaluateWiggleOffset(activeWiggle, "layer", 20, 30);
assert.deepEqual(offsetA, offsetARepeat);
assert.notDeepEqual(offsetA, offsetB);
assert.notEqual(offsetA.x, offsetA.y);

const configuredLayer = configured[0]!.layers[0]!;
const sourceBeforeEvaluation = structuredClone(configuredLayer);
const baseAtFrame = evaluatePositionKeyframes(
  configuredLayer.position,
  configuredLayer.positionKeyframes,
  10
);
const finalAtFrame = evaluateLayerPosition(configuredLayer, 10, 30);
assert.deepEqual(evaluateLayerBasePosition(configuredLayer, 10), baseAtFrame);
assert.deepEqual(finalAtFrame, {
  x: baseAtFrame.x + offsetA.x,
  y: baseAtFrame.y + offsetA.y,
});
assert.deepEqual(configuredLayer, sourceBeforeEvaluation);

const configuredComposition = {
  ...composition,
  modifiers: [{ ...defaultWiggle, id: "comp:wiggle", frequency: 1, amount: 8 }],
};
assert.deepEqual(
  evaluateCompositionBasePosition(configuredComposition, 12),
  configuredComposition.position
);
assert.deepEqual(
  evaluateCompositionPosition(configuredComposition, 12, 30),
  applyPositionModifiers(
    configuredComposition.position,
    configuredComposition.id,
    configuredComposition.modifiers,
    12,
    30
  )
);

console.log("Modifier registry, mutation, normalization, and evaluation verification passed");
