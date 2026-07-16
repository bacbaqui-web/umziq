import { useCallback } from "react";
import { clampPlaybackFrame } from "@/engines/playback-render/helpers/playbackFrameHelpers";
import {
  normalizePlaybackDuration,
  normalizePlaybackRange,
} from "@/engines/playback-render/helpers/playbackRangeHelpers";
import type {
  PlaybackProjectReadPort,
  PlaybackRange,
  PlaybackStatePort,
} from "@/engines/playback-render/models/playbackModel";

type UsePlaybackRangeControllerOptions = {
  state: PlaybackStatePort;
  project: PlaybackProjectReadPort;
  playbackRange: PlaybackRange;
};

export function usePlaybackRangeController({
  state,
  project,
  playbackRange,
}: UsePlaybackRangeControllerOptions) {
  const { selectedCompId, durationFrames } = project;
  const { setCurrentFrame, setPlaybackRangeByCompId } = state;

  const setPlaybackRange = useCallback(
    (startFrame: number, endFrame: number) => {
      if (!selectedCompId || durationFrames <= 0) {
        return;
      }

      const nextRange = normalizePlaybackRange(
        { startFrame, endFrame },
        durationFrames
      );
      setPlaybackRangeByCompId((current) => ({
        ...current,
        [selectedCompId]: nextRange,
      }));
    },
    [durationFrames, selectedCompId, setPlaybackRangeByCompId]
  );

  const setPlaybackIn = useCallback(
    (startFrame: number) => {
      setPlaybackRange(startFrame, playbackRange.endFrame);
    },
    [playbackRange.endFrame, setPlaybackRange]
  );

  const setPlaybackOut = useCallback(
    (endFrame: number) => {
      setPlaybackRange(playbackRange.startFrame, endFrame);
    },
    [playbackRange.startFrame, setPlaybackRange]
  );

  const normalizeForDuration = useCallback(
    (nextDurationFrames: number) => {
      if (!selectedCompId) {
        return;
      }

      const safeDurationFrames = normalizePlaybackDuration(nextDurationFrames);
      setPlaybackRangeByCompId((current) => {
        const storedRange = current[selectedCompId];

        if (!storedRange) {
          return current;
        }

        const nextRange = normalizePlaybackRange(storedRange, safeDurationFrames);

        if (
          nextRange.startFrame === storedRange.startFrame &&
          nextRange.endFrame === storedRange.endFrame
        ) {
          return current;
        }

        return { ...current, [selectedCompId]: nextRange };
      });
      setCurrentFrame((current) =>
        clampPlaybackFrame(current, safeDurationFrames)
      );
    },
    [selectedCompId, setCurrentFrame, setPlaybackRangeByCompId]
  );

  return {
    setPlaybackRange,
    setPlaybackIn,
    setPlaybackOut,
    normalizeForDuration,
  };
}
