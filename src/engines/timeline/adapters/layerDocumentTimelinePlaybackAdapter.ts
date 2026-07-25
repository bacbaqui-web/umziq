import type {
  LayerDocumentTimelineOwnerPort,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import {
  advancePlaybackFrame,
  clampPlaybackFrame,
  getPlaybackResetFrame,
  normalizePlaybackRange,
  stepPlaybackFrame,
} from "@/engines/playback-render";
import type {
  LayerDocumentTimelinePlaybackPort,
  LayerDocumentTimelinePlaybackScheduler,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";

export const WINDOW_TIMELINE_PLAYBACK_SCHEDULER:
LayerDocumentTimelinePlaybackScheduler = {
  setRepeating: (callback, intervalMs) =>
    window.setInterval(callback, intervalMs),
  clearRepeating: (handle) =>
    window.clearInterval(handle as number),
};

/**
 * External Timeline playback Runtime. It owns the clock and isPlaying only;
 * currentFrame/range always read and write the LayerDocument owner session.
 */
export function createLayerDocumentTimelinePlaybackRuntime(
  options: {
    assembly: LayerDocumentTimelineOwnerPort;
    scheduler:
      LayerDocumentTimelinePlaybackScheduler;
    clearDraft?: () => void;
  }
): LayerDocumentTimelinePlaybackPort & {
  readonly dispose: () => void;
  readonly synchronizeClock: () => void;
} {
  let isPlaying = false;
  let clockHandle: unknown = null;
  let scheduledFrameRate: number | null = null;
  const listeners = new Set<() => void>();
  const notify = () => {
    listeners.forEach((listener) => listener());
  };
  const metadata = () => {
    const scope = options.assembly.scope.read();
    return scope.ok
      ? {
          durationFrames:
            scope.model.activeGroup.data.durationFrames,
          frameRate:
            scope.model.activeGroup.data.frameRate,
        }
      : { durationFrames: 1, frameRate: 1 };
  };
  const publishPlayback = (
    currentFrame: number,
    range =
      options.assembly.playback.read().range
  ) => {
    options.assembly.playback.set({
      currentFrame,
      range,
    });
    notify();
  };
  const stopClock = () => {
    if (clockHandle !== null) {
      options.scheduler.clearRepeating(
        clockHandle
      );
      clockHandle = null;
      scheduledFrameRate = null;
    }
  };
  const pause = () => {
    stopClock();
    if (!isPlaying) return;
    isPlaying = false;
    notify();
  };
  const tick = () => {
    if (!isPlaying) return;
    options.clearDraft?.();
    const playback =
      options.assembly.playback.read();
    const { durationFrames } = metadata();
    const next = advancePlaybackFrame(
      playback.currentFrame,
      durationFrames,
      playback.range.startFrame,
      playback.range.endFrame
    );
    publishPlayback(next.frame, playback.range);
    if (next.shouldStop) pause();
  };
  const play = () => {
    const { durationFrames, frameRate } =
      metadata();
    if (durationFrames <= 0 || isPlaying) {
      return;
    }
    options.clearDraft?.();
    const playback =
      options.assembly.playback.read();
    if (
      playback.currentFrame <
        playback.range.startFrame ||
      playback.currentFrame >=
        playback.range.endFrame
    ) {
      publishPlayback(
        playback.range.startFrame,
        playback.range
      );
    }
    isPlaying = true;
    scheduledFrameRate = frameRate;
    clockHandle =
      options.scheduler.setRepeating(
        tick,
        1000 / Math.max(1, frameRate)
      );
    notify();
  };
  const synchronizeClock = () => {
    if (!isPlaying) return;
    const { frameRate } = metadata();
    if (scheduledFrameRate === frameRate) {
      return;
    }
    stopClock();
    scheduledFrameRate = frameRate;
    clockHandle =
      options.scheduler.setRepeating(
        tick,
        1000 / Math.max(1, frameRate)
      );
  };
  const port: LayerDocumentTimelinePlaybackPort & {
    readonly dispose: () => void;
    readonly synchronizeClock: () => void;
  } = {
    read: () => {
      const playback =
        options.assembly.playback.read();
      return {
        currentFrame: playback.currentFrame,
        range: playback.range,
        isPlaying,
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    commands: {
      play,
      pause,
      togglePlayback: () => {
        if (isPlaying) pause();
        else play();
      },
      seek: (frame) => {
        options.clearDraft?.();
        const { durationFrames } = metadata();
        publishPlayback(
          clampPlaybackFrame(
            frame,
            durationFrames
          )
        );
      },
      stepBackward: () => {
        pause();
        options.clearDraft?.();
        const playback =
          options.assembly.playback.read();
        publishPlayback(
          stepPlaybackFrame(
            playback.currentFrame,
            -1,
            metadata().durationFrames
          )
        );
      },
      stepForward: () => {
        pause();
        options.clearDraft?.();
        const playback =
          options.assembly.playback.read();
        publishPlayback(
          stepPlaybackFrame(
            playback.currentFrame,
            1,
            metadata().durationFrames
          )
        );
      },
      reset: () => {
        pause();
        options.clearDraft?.();
        publishPlayback(
          getPlaybackResetFrame()
        );
      },
      setRange: (startFrame, endFrame) => {
        const playback =
          options.assembly.playback.read();
        publishPlayback(
          playback.currentFrame,
          normalizePlaybackRange(
            { startFrame, endFrame },
            metadata().durationFrames
          )
        );
      },
    },
    dispose: () => {
      stopClock();
      isPlaying = false;
      listeners.clear();
    },
    synchronizeClock,
  };
  return port;
}
