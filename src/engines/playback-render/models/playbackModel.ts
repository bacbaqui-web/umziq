import type { Dispatch, SetStateAction } from "react";
import type { RendererMode } from "@/engines/playback-render/models/rendererModeModel";

export type PlaybackRange = {
  startFrame: number;
  endFrame: number;
};

export type PlaybackReadModel = {
  currentFrame: number;
  playheadFrame: number;
  isPlaying: boolean;
  rendererMode: RendererMode;
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
  setRendererMode: (mode: RendererMode) => void;
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
  rendererMode: RendererMode;
  setRendererMode: Dispatch<SetStateAction<RendererMode>>;
};

export type PlaybackSessionPort = {
  clearTransformDrafts: () => void;
};
