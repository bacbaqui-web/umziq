export function clampPlaybackFrame(frame: number, durationFrames: number) {
  return Math.min(Math.max(frame, 0), Math.max(durationFrames - 1, 0));
}

export function stepPlaybackFrame(
  currentFrame: number,
  direction: -1 | 1,
  durationFrames: number
) {
  return clampPlaybackFrame(currentFrame + direction, durationFrames);
}

export function getPlaybackResetFrame() {
  return 0;
}

export type PlaybackAdvanceResult = {
  frame: number;
  shouldStop: boolean;
};

export function advancePlaybackFrame(
  currentFrame: number,
  durationFrames: number,
  rangeStartFrame: number,
  rangeEndFrame: number
): PlaybackAdvanceResult {
  if (currentFrame < rangeStartFrame || currentFrame >= rangeEndFrame) {
    return { frame: rangeStartFrame, shouldStop: false };
  }

  const nextFrame = currentFrame + 1;

  if (nextFrame >= durationFrames || nextFrame >= rangeEndFrame) {
    return {
      frame: Math.max(
        rangeStartFrame,
        Math.min(rangeEndFrame - 1, durationFrames - 1)
      ),
      shouldStop: true,
    };
  }

  return { frame: nextFrame, shouldStop: false };
}
