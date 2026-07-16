import { useCallback } from "react";
import {
  clampPlaybackFrame,
  getPlaybackResetFrame,
  stepPlaybackFrame,
} from "@/engines/playback-render/helpers/playbackFrameHelpers";
import type {
  PlaybackProjectReadPort,
  PlaybackRange,
  PlaybackSeekOptions,
  PlaybackSessionPort,
  PlaybackStatePort,
} from "@/engines/playback-render/models/playbackModel";

type UsePlaybackControllerOptions = {
  state: PlaybackStatePort;
  project: PlaybackProjectReadPort;
  session: PlaybackSessionPort;
  playbackRange: PlaybackRange;
};

export function usePlaybackController({
  state,
  project,
  session,
  playbackRange,
}: UsePlaybackControllerOptions) {
  const { currentFrame, isPlaying, setCurrentFrame, setIsPlaying } = state;
  const { durationFrames } = project;
  const { clearTransformDrafts } = session;

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, [setIsPlaying]);

  const play = useCallback(() => {
    if (durationFrames <= 0) {
      return;
    }

    clearTransformDrafts();

    if (
      currentFrame < playbackRange.startFrame ||
      currentFrame >= playbackRange.endFrame
    ) {
      setCurrentFrame(playbackRange.startFrame);
    }

    setIsPlaying(true);
  }, [
    clearTransformDrafts,
    currentFrame,
    durationFrames,
    playbackRange.endFrame,
    playbackRange.startFrame,
    setCurrentFrame,
    setIsPlaying,
  ]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause();
      return;
    }

    play();
  }, [isPlaying, pause, play]);

  const seek = useCallback(
    (frame: number, options?: PlaybackSeekOptions) => {
      if (options?.clearTransformDrafts !== false) {
        clearTransformDrafts();
      }
      setCurrentFrame(clampPlaybackFrame(frame, durationFrames));
    },
    [clearTransformDrafts, durationFrames, setCurrentFrame]
  );

  const step = useCallback(
    (direction: -1 | 1) => {
      if (durationFrames <= 0) {
        return;
      }

      setIsPlaying(false);
      clearTransformDrafts();
      setCurrentFrame(stepPlaybackFrame(currentFrame, direction, durationFrames));
    },
    [clearTransformDrafts, currentFrame, durationFrames, setCurrentFrame, setIsPlaying]
  );

  const stepBackward = useCallback(() => step(-1), [step]);
  const stepForward = useCallback(() => step(1), [step]);

  const reset = useCallback(() => {
    setCurrentFrame(getPlaybackResetFrame());
    setIsPlaying(false);
    clearTransformDrafts();
  }, [clearTransformDrafts, setCurrentFrame, setIsPlaying]);

  return { play, pause, togglePlayback, seek, stepBackward, stepForward, reset };
}
