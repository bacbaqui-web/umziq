import { useEffect } from "react";
import { advancePlaybackFrame } from "@/engines/playback-render/helpers/playbackFrameHelpers";
import type {
  PlaybackProjectReadPort,
  PlaybackRange,
  PlaybackSessionPort,
  PlaybackStatePort,
} from "@/engines/playback-render/models/playbackModel";

type UsePlaybackLoopControllerOptions = {
  state: PlaybackStatePort;
  project: PlaybackProjectReadPort;
  session: PlaybackSessionPort;
  playbackRange: PlaybackRange;
};

export function usePlaybackLoopController({
  state,
  project,
  session,
  playbackRange,
}: UsePlaybackLoopControllerOptions) {
  const { isPlaying, setCurrentFrame, setIsPlaying } = state;
  const { durationFrames, frameRate, selectedCompId } = project;
  const { clearTransformDrafts } = session;

  useEffect(() => {
    if (!isPlaying || !selectedCompId || durationFrames <= 0) {
      return;
    }

    const intervalId = window.setInterval(() => {
      clearTransformDrafts();
      setCurrentFrame((current) => {
        const next = advancePlaybackFrame(
          current,
          durationFrames,
          playbackRange.startFrame,
          playbackRange.endFrame
        );

        if (next.shouldStop) {
          window.clearInterval(intervalId);
          setIsPlaying(false);
        }

        return next.frame;
      });
    }, 1000 / frameRate);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    clearTransformDrafts,
    durationFrames,
    frameRate,
    isPlaying,
    playbackRange.endFrame,
    playbackRange.startFrame,
    selectedCompId,
    setCurrentFrame,
    setIsPlaying,
  ]);
}
