import type { Dispatch, SetStateAction } from "react";

export type PlaybackRange = {
  startFrame: number;
  endFrame: number;
};

export type PlaybackReadModel = {
  currentFrame: number;
  playheadFrame: number;
  isPlaying: boolean;
  playbackRange: PlaybackRange;
};

export type PlaybackSeekOptions = {
  clearTransformDrafts?: boolean;
};

export type PlaybackCommands = {
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seek: (frame: number, options?: PlaybackSeekOptions) => void;
  stepBackward: () => void;
  stepForward: () => void;
  reset: () => void;
  setPlaybackRange: (startFrame: number, endFrame: number) => void;
  setPlaybackIn: (startFrame: number) => void;
  setPlaybackOut: (endFrame: number) => void;
  normalizeForDuration: (durationFrames: number) => void;
};

export type PlaybackProjectReadPort = {
  selectedCompId: string | null;
  durationFrames: number;
  frameRate: number;
};

export type PlaybackStatePort = {
  playbackRangeByCompId: Record<string, PlaybackRange>;
  setPlaybackRangeByCompId: Dispatch<
    SetStateAction<Record<string, PlaybackRange>>
  >;
  currentFrame: number;
  setCurrentFrame: Dispatch<SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
};

export type PlaybackSessionPort = {
  clearTransformDrafts: () => void;
};
