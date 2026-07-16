import assert from "node:assert/strict";
import {
  findKeyframeAtFrame,
  moveKeyframeValue,
  removeKeyframeValue,
  upsertKeyframeValue,
} from "../src/engines/animation/helpers/keyframeTrackHelpers";
import {
  evaluateCompositionOpacity,
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerOpacity,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
  evaluatePositionKeyframes,
  evaluateScalarKeyframes,
  evaluateScaleKeyframes,
} from "../src/engines/animation/helpers/animationEvaluationHelpers";
import {
  getKeyframeGlobalFrame,
  globalFrameToLocalFrame,
  resolveSelectedTransformLocalFrame,
} from "../src/engines/animation/helpers/animationFrameHelpers";
import { buildPositionMotionPathSamples } from "../src/engines/animation/helpers/motionPathSamplingHelpers";
import {
  getTargetKeyframes,
  replaceTargetKeyframes,
} from "../src/engines/animation/helpers/keyframeTargetHelpers";
import {
  createSelectedPropertyKeyframe,
  matchesSelectedPropertyKeyframe,
} from "../src/engines/animation/helpers/animationSelectionHelpers";
import {
  clampOpacity,
  normalizeRotationDegrees,
} from "../src/engines/animation/helpers/transformValueHelpers";
import { updateTargetPropertyTrack } from "../src/engines/animation/helpers/propertyTrackHelpers";
import {
  createPropertyTrackState,
  type Composition,
  type Layer,
  type TimelineItem,
} from "../src/models";

const emptyUpsert = upsertKeyframeValue([], 4, 40);
assert.deepEqual(emptyUpsert, [{ frame: 4, value: 40 }]);

const original = [{ frame: 0, value: 0 }, { frame: 10, value: 100 }];
assert.deepEqual(upsertKeyframeValue(original, 10, 80), [
  { frame: 0, value: 0 },
  { frame: 10, value: 80 },
]);
assert.deepEqual(upsertKeyframeValue(original, 5, 50), [
  { frame: 0, value: 0 },
  { frame: 5, value: 50 },
  { frame: 10, value: 100 },
]);
assert.deepEqual(original, [{ frame: 0, value: 0 }, { frame: 10, value: 100 }]);
assert.equal(findKeyframeAtFrame(original, 10)?.value, 100);

const three = [{ frame: 0, value: 0 }, { frame: 5, value: 50 }, { frame: 10, value: 100 }];
assert.deepEqual(removeKeyframeValue(three, 0).map(({ frame }) => frame), [5, 10]);
assert.deepEqual(removeKeyframeValue(three, 5).map(({ frame }) => frame), [0, 10]);
assert.deepEqual(removeKeyframeValue(three, 10).map(({ frame }) => frame), [0, 5]);
assert.deepEqual(moveKeyframeValue(three, 5, 8), [
  { frame: 0, value: 0 },
  { frame: 8, value: 50 },
  { frame: 10, value: 100 },
]);
assert.deepEqual(moveKeyframeValue(three, 0, 10), [
  { frame: 5, value: 50 },
  { frame: 10, value: 0 },
]);
assert.equal(moveKeyframeValue(three, 99, 3), three);

const positionFrames = [
  { frame: 0, value: { x: 0, y: 20 } },
  { frame: 10, value: { x: 100, y: 40 } },
];
assert.deepEqual(evaluatePositionKeyframes({ x: 3, y: 4 }, [], 5), { x: 3, y: 4 });
assert.deepEqual(evaluatePositionKeyframes({ x: 3, y: 4 }, positionFrames, -1), { x: 0, y: 20 });
assert.deepEqual(evaluatePositionKeyframes({ x: 3, y: 4 }, positionFrames, 0), { x: 0, y: 20 });
assert.deepEqual(evaluatePositionKeyframes({ x: 3, y: 4 }, positionFrames, 5), { x: 50, y: 30 });
assert.deepEqual(evaluatePositionKeyframes({ x: 3, y: 4 }, positionFrames, 11), { x: 100, y: 40 });
assert.deepEqual(
  evaluateScaleKeyframes({ x: 100, y: 100 }, [
    { frame: 0, value: { x: 100, y: 50 } },
    { frame: 10, value: { x: 200, y: 150 } },
  ], 5),
  { x: 150, y: 100 }
);
assert.equal(evaluateScalarKeyframes(3, [], 5), 3);
assert.equal(evaluateScalarKeyframes(0, [{ frame: 0, value: 10 }, { frame: 10, value: 30 }], 5), 20);
assert.equal(evaluateScalarKeyframes(0, [{ frame: 0, value: 0 }, { frame: 10, value: 100 }], 5), 50);

const disabledLayer: Layer = {
  id: "layer",
  name: "layer",
  visible: true,
  position: { x: 1, y: 2 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  positionKeyframes: positionFrames,
  scale: { x: 100, y: 100 },
  scaleKeyframes: [],
  scaleLinked: true,
  rotation: 0,
  rotationKeyframes: [],
  opacity: 120,
  opacityKeyframes: [{ frame: 0, value: 0 }],
  enabledProperties: createPropertyTrackState(),
};
assert.equal(evaluateLayerOpacity(disabledLayer, 0), 100);
assert.deepEqual(evaluateLayerPosition(disabledLayer, 5), { x: 1, y: 2 });
assert.deepEqual(evaluateLayerScale(disabledLayer, 5), { x: 100, y: 100 });
assert.equal(evaluateLayerRotation(disabledLayer, 5), 0);

const animatedComposition: Composition = {
  id: "composition",
  name: "composition",
  type: "sub",
  children: [],
  layers: [],
  position: { x: 1, y: 2 },
  positionKeyframes: positionFrames,
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  scaleKeyframes: [
    { frame: 0, value: { x: 100, y: 50 } },
    { frame: 10, value: { x: 200, y: 150 } },
  ],
  scaleLinked: false,
  rotation: 3,
  rotationKeyframes: [{ frame: 0, value: 10 }, { frame: 10, value: 30 }],
  opacity: 90,
  opacityKeyframes: [{ frame: 0, value: -20 }, { frame: 10, value: 120 }],
  enabledProperties: createPropertyTrackState({
    position: true,
    scale: true,
    rotation: true,
    opacity: true,
  }),
};
assert.deepEqual(evaluateCompositionPosition(animatedComposition, 5), { x: 50, y: 30 });
assert.deepEqual(evaluateCompositionScale(animatedComposition, 5), { x: 150, y: 100 });
assert.equal(evaluateCompositionRotation(animatedComposition, 5), 20);
assert.equal(evaluateCompositionOpacity(animatedComposition, 5), 50);
assert.equal(getTargetKeyframes(disabledLayer, "position"), positionFrames);
const replacedLayer = replaceTargetKeyframes(disabledLayer, "opacity", [{ frame: 2, value: 30 }]);
assert.deepEqual(replacedLayer.opacityKeyframes, [{ frame: 2, value: 30 }]);
assert.deepEqual(disabledLayer.opacityKeyframes, [{ frame: 0, value: 0 }]);
const enabledLayer = updateTargetPropertyTrack(
  disabledLayer,
  "position",
  true,
  { position: { x: 9, y: 8 }, scale: { x: 100, y: 100 }, rotation: 0, opacity: 100 },
  { position: 5, scale: 5, rotation: 5, opacity: 5 }
);
assert.equal(enabledLayer.enabledProperties.position, true);
assert.deepEqual(enabledLayer.positionKeyframes, [
  { frame: 0, value: { x: 0, y: 20 } },
  { frame: 5, value: { x: 9, y: 8 } },
  { frame: 10, value: { x: 100, y: 40 } },
]);
const disabledAgain = updateTargetPropertyTrack(
  enabledLayer,
  "position",
  false,
  { position: { x: 0, y: 0 }, scale: { x: 0, y: 0 }, rotation: 0, opacity: 0 },
  { position: 99, scale: 99, rotation: 99, opacity: 99 }
);
assert.equal(disabledAgain.enabledProperties.position, false);
assert.equal(disabledAgain.position, enabledLayer.position);
assert.equal(disabledAgain.positionKeyframes, enabledLayer.positionKeyframes);

const item: TimelineItem = {
  id: "item",
  name: "item",
  kind: "layer",
  visible: true,
  compId: "comp",
  sourceId: "layer",
  startFrame: 10,
  durationFrames: 5,
};
assert.equal(globalFrameToLocalFrame(3, 0), 3);
assert.equal(globalFrameToLocalFrame(9, 10), -1);
assert.equal(globalFrameToLocalFrame(10, 10), 0);
assert.equal(globalFrameToLocalFrame(13, 10), 3);
assert.equal(resolveSelectedTransformLocalFrame(9, item), 9);
assert.equal(resolveSelectedTransformLocalFrame(10, item), 0);
assert.equal(resolveSelectedTransformLocalFrame(15, item), 15);
assert.equal(getKeyframeGlobalFrame(3, item), 13);

const noKeyframes = buildPositionMotionPathSamples({
  basePosition: { x: 5, y: 7 },
  positionKeyframes: [],
  positionTrackEnabled: true,
  startFrame: 2,
  durationFrames: 3,
  compositionDurationFrames: 8,
});
assert.deepEqual(noKeyframes.map(({ frame }) => frame), [2, 3, 4]);
assert.ok(noKeyframes.every(({ position, isKeyframe }) => position.x === 5 && !isKeyframe));

const oneKeyframe = buildPositionMotionPathSamples({
  basePosition: { x: 0, y: 0 },
  positionKeyframes: [{ frame: 1, value: { x: 10, y: 20 } }],
  positionTrackEnabled: true,
  startFrame: 2,
  durationFrames: 3,
  compositionDurationFrames: 8,
});
assert.deepEqual(oneKeyframe.map(({ position }) => position), [
  { x: 10, y: 20 },
  { x: 10, y: 20 },
  { x: 10, y: 20 },
]);
assert.deepEqual(oneKeyframe.filter(({ isKeyframe }) => isKeyframe).map(({ frame }) => frame), [3]);

const multipleKeyframes = buildPositionMotionPathSamples({
  basePosition: { x: 0, y: 0 },
  positionKeyframes: positionFrames,
  positionTrackEnabled: true,
  startFrame: 4,
  durationFrames: 11,
  compositionDurationFrames: 20,
});
assert.deepEqual(multipleKeyframes.filter(({ isKeyframe }) => isKeyframe).map(({ frame }) => frame), [4, 14]);
assert.deepEqual(multipleKeyframes[5].position, { x: 50, y: 30 });

const selected = createSelectedPropertyKeyframe("layer", "layer", "position", 5);
assert.equal(matchesSelectedPropertyKeyframe(selected, "layer", "layer", "position"), true);
assert.equal(matchesSelectedPropertyKeyframe(selected, "layer", "layer", "position", 6), false);
assert.equal(clampOpacity(-1), 0);
assert.equal(clampOpacity(101), 100);
assert.equal(normalizeRotationDegrees(540), 180);

console.log("Animation helper verification passed");
