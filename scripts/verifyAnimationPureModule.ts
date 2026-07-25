import assert from "node:assert/strict";
import {
  applyPositionModifiers,
  buildPositionMotionPathSamples,
  evaluatePositionKeyframes,
  evaluateScalarKeyframes,
  evaluateWiggleOffset,
  globalFrameToLocalFrame,
  localFrameToGlobalFrame,
  moveKeyframeValue,
  normalizeModifierInstances,
  removeKeyframeValue,
  sortKeyframesByFrame,
  upsertKeyframeValue,
} from "@/animation";
import type {
  PositionKeyframe,
  WiggleModifierInstance,
} from "@/models";

const positionKeyframes: PositionKeyframe[] = [
  { frame: 10, value: { x: 20, y: 30 } },
  { frame: 0, value: { x: 0, y: 10 } },
];

assert.deepEqual(
  evaluatePositionKeyframes(
    { x: 100, y: 100 },
    positionKeyframes,
    5
  ),
  { x: 10, y: 20 }
);
assert.deepEqual(
  evaluatePositionKeyframes(
    { x: 100, y: 100 },
    [],
    5
  ),
  { x: 100, y: 100 }
);
assert.equal(
  evaluateScalarKeyframes(
    100,
    [
      { frame: 0, value: 0 },
      { frame: 10, value: 100 },
    ],
    5
  ),
  50
);

assert.equal(globalFrameToLocalFrame(12, 10, 3), 5);
assert.equal(localFrameToGlobalFrame(5, 10, 3), 12);

const sourceKeyframes: PositionKeyframe[] = [
  { frame: 8, value: { x: 8, y: 8 } },
  { frame: 2, value: { x: 2, y: 2 } },
];
const sortedKeyframes = sortKeyframesByFrame(sourceKeyframes);
assert.deepEqual(
  sortedKeyframes.map(({ frame }) => frame),
  [2, 8]
);
assert.deepEqual(
  sourceKeyframes.map(({ frame }) => frame),
  [8, 2],
  "순수 helper는 입력 배열을 변경하지 않아야 합니다."
);
assert.deepEqual(
  upsertKeyframeValue(sourceKeyframes, 4, { x: 4, y: 4 }).map(
    ({ frame }) => frame
  ),
  [2, 4, 8]
);
assert.deepEqual(
  moveKeyframeValue(sourceKeyframes, 2, 6).map(({ frame }) => frame),
  [6, 8]
);
assert.deepEqual(
  removeKeyframeValue(sourceKeyframes, 2).map(({ frame }) => frame),
  [8]
);

const wiggle: WiggleModifierInstance = {
  id: "layer-1:wiggle",
  type: "wiggle",
  frequency: 2,
  amount: 10,
};
const wiggleOffset = evaluateWiggleOffset(
  wiggle,
  "layer-1",
  7,
  30
);
assert.deepEqual(
  evaluateWiggleOffset(wiggle, "layer-1", 7, 30),
  wiggleOffset,
  "Modifier 계산은 같은 입력에 대해 결정적이어야 합니다."
);
assert.deepEqual(
  applyPositionModifiers(
    { x: 3, y: 4 },
    "layer-1",
    [{ ...wiggle, amount: 0 }],
    7,
    30
  ),
  { x: 3, y: 4 }
);
assert.deepEqual(
  normalizeModifierInstances(
    [
      {
        id: "",
        type: "wiggle",
        frequency: -2,
        amount: "5",
      },
    ],
    "layer-1"
  ),
  [
    {
      id: "layer-1:wiggle",
      type: "wiggle",
      frequency: 0,
      amount: 5,
    },
  ]
);

const motionPath = buildPositionMotionPathSamples({
  basePosition: { x: 0, y: 0 },
  positionKeyframes: [
    { frame: 0, value: { x: 0, y: 0 } },
    { frame: 2, value: { x: 20, y: 10 } },
  ],
  positionTrackEnabled: true,
  startFrame: 2,
  durationFrames: 4,
  compositionDurationFrames: 8,
});
assert.deepEqual(
  motionPath.map(({ frame, position, isKeyframe }) => ({
    frame,
    position,
    isKeyframe,
  })),
  [
    {
      frame: 2,
      position: { x: 0, y: 0 },
      isKeyframe: true,
    },
    {
      frame: 3,
      position: { x: 10, y: 5 },
      isKeyframe: false,
    },
    {
      frame: 4,
      position: { x: 20, y: 10 },
      isKeyframe: true,
    },
    {
      frame: 5,
      position: { x: 20, y: 10 },
      isKeyframe: false,
    },
  ]
);

console.log("Animation pure module verification passed");
