import type { PlaybackRange } from "@/engines/playback-render/models/playbackModel";

export function normalizePlaybackDuration(durationFrames: number) {
  return Math.max(1, Math.floor(durationFrames));
}

export function createDefaultPlaybackRange(
  durationFrames: number,
  frameRate: number
): PlaybackRange {
  const safeDurationFrames = normalizePlaybackDuration(durationFrames);

  return {
    startFrame: 0,
    endFrame: Math.min(
      safeDurationFrames,
      Math.max(Math.floor(frameRate) * 4, 1)
    ),
  };
}

export function normalizePlaybackRange(
  range: PlaybackRange,
  durationFrames: number
): PlaybackRange {
  const safeDurationFrames = normalizePlaybackDuration(durationFrames);
  const startFrame = Math.min(
    Math.max(Math.floor(range.startFrame), 0),
    safeDurationFrames - 1
  );
  const endFrame = Math.min(
    Math.max(Math.floor(range.endFrame), startFrame + 1),
    safeDurationFrames
  );

  return { startFrame, endFrame };
}

export function resolvePlaybackRange(
  storedRange: PlaybackRange | undefined,
  durationFrames: number,
  frameRate: number
) {
  return normalizePlaybackRange(
    storedRange ?? createDefaultPlaybackRange(durationFrames, frameRate),
    durationFrames
  );
}

export function isFrameInPlaybackRange(frame: number, range: PlaybackRange) {
  return frame >= range.startFrame && frame < range.endFrame;
}
