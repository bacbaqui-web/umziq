import { useCallback } from "react";
import { usePlaybackController } from "@/engines/playback-render/controllers/usePlaybackController";
import { usePlaybackLoopController } from "@/engines/playback-render/controllers/usePlaybackLoopController";
import { usePlaybackRangeController } from "@/engines/playback-render/controllers/usePlaybackRangeController";
import { clampPlaybackFrame } from "@/engines/playback-render/helpers/playbackFrameHelpers";
import { resolvePlaybackRange } from "@/engines/playback-render/helpers/playbackRangeHelpers";
import type {
  PlaybackCommands,
  PlaybackProjectReadPort,
  PlaybackReadModel,
  PlaybackStatePort,
} from "@/engines/playback-render/models/playbackModel";

type UsePlaybackEngineOptions = {
  state: PlaybackStatePort;
  project: PlaybackProjectReadPort;
  session: {
    setPositionDraft: (value: null) => void;
    setScaleDraft: (value: null) => void;
    setRotationDraft: (value: null) => void;
    setOpacityDraft: (value: null) => void;
  };
};

export function usePlaybackEngine({ state, project, session }: UsePlaybackEngineOptions) {
  const {
    setPositionDraft,
    setScaleDraft,
    setRotationDraft,
    setOpacityDraft,
  } = session;
  const clearTransformDrafts = useCallback(() => {
    setPositionDraft(null);
    setScaleDraft(null);
    setRotationDraft(null);
    setOpacityDraft(null);
  }, [setOpacityDraft, setPositionDraft, setRotationDraft, setScaleDraft]);

  const playbackRange = resolvePlaybackRange(
    project.selectedCompId
      ? state.playbackRangeByCompId[project.selectedCompId]
      : undefined,
    project.durationFrames,
    project.frameRate
  );
  const sessionPort = { clearTransformDrafts };

  const playback = usePlaybackController({
    state,
    project,
    session: sessionPort,
    playbackRange,
  });
  const range = usePlaybackRangeController({ state, project, playbackRange });
  usePlaybackLoopController({ state, project, session: sessionPort, playbackRange });

  const commands: PlaybackCommands = { ...playback, ...range };
  const read: PlaybackReadModel = {
    currentFrame: state.currentFrame,
    playheadFrame: clampPlaybackFrame(state.currentFrame, project.durationFrames),
    isPlaying: state.isPlaying,
    playbackRange,
  };

  return { ...read, commands, ...commands };
}
