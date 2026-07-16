import assert from "node:assert/strict";
import {
  advancePlaybackFrame,
  clampPlaybackFrame,
  getPlaybackResetFrame,
  stepPlaybackFrame,
} from "@/engines/playback-render/helpers/playbackFrameHelpers";
import {
  createDefaultPlaybackRange,
  isFrameInPlaybackRange,
  normalizePlaybackRange,
  resolvePlaybackRange,
} from "@/engines/playback-render/helpers/playbackRangeHelpers";

assert.equal(clampPlaybackFrame(0, 1), 0);
assert.equal(clampPlaybackFrame(-10, 10), 0);
assert.equal(clampPlaybackFrame(12, 10), 9);
assert.equal(clampPlaybackFrame(4, 10), 4);
assert.equal(stepPlaybackFrame(0, -1, 10), 0);
assert.equal(stepPlaybackFrame(9, 1, 10), 9);
assert.equal(stepPlaybackFrame(4, -1, 10), 3);
assert.equal(stepPlaybackFrame(4, 1, 10), 5);
assert.equal(getPlaybackResetFrame(), 0);

assert.deepEqual(createDefaultPlaybackRange(300, 30), {
  startFrame: 0,
  endFrame: 120,
});
assert.deepEqual(createDefaultPlaybackRange(60, 30), {
  startFrame: 0,
  endFrame: 60,
});
assert.deepEqual(resolvePlaybackRange(undefined, 60, 30), {
  startFrame: 0,
  endFrame: 60,
});
assert.deepEqual(normalizePlaybackRange({ startFrame: 2, endFrame: 8 }, 10), {
  startFrame: 2,
  endFrame: 8,
});
assert.deepEqual(normalizePlaybackRange({ startFrame: 8, endFrame: 3 }, 10), {
  startFrame: 8,
  endFrame: 9,
});
assert.deepEqual(normalizePlaybackRange({ startFrame: -3, endFrame: 50 }, 10), {
  startFrame: 0,
  endFrame: 10,
});
assert.deepEqual(normalizePlaybackRange({ startFrame: 5, endFrame: 9 }, 4), {
  startFrame: 3,
  endFrame: 4,
});
assert.equal(clampPlaybackFrame(7, 4), 3);
assert.equal(isFrameInPlaybackRange(2, { startFrame: 2, endFrame: 5 }), true);
assert.equal(isFrameInPlaybackRange(4, { startFrame: 2, endFrame: 5 }), true);
assert.equal(isFrameInPlaybackRange(5, { startFrame: 2, endFrame: 5 }), false);

assert.deepEqual(advancePlaybackFrame(3, 10, 2, 5), {
  frame: 4,
  shouldStop: false,
});
assert.deepEqual(advancePlaybackFrame(4, 10, 2, 5), {
  frame: 4,
  shouldStop: true,
});
assert.deepEqual(advancePlaybackFrame(9, 10, 0, 10), {
  frame: 9,
  shouldStop: true,
});
assert.deepEqual(advancePlaybackFrame(0, 10, 2, 5), {
  frame: 2,
  shouldStop: false,
});

console.log("Playback helper verification passed");
