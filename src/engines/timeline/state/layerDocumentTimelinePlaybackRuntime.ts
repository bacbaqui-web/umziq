import {
  advancePlaybackFrame,
  clampPlaybackFrame,
  getPlaybackResetFrame,
  stepPlaybackFrame,
} from "@/engines/timeline/helpers/timelinePlaybackFrameHelpers";
import {
  normalizePlaybackRange,
} from "@/engines/timeline/helpers/timelinePlaybackRangeHelpers";
import type {
  LayerDocumentTimelineNexusPort,
  LayerDocumentTimelinePlaybackPort,
  LayerDocumentTimelinePlaybackScheduler,
  LayerDocumentTimelineRuntimePort,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";

export const WINDOW_TIMELINE_PLAYBACK_SCHEDULER:
LayerDocumentTimelinePlaybackScheduler = {
  setRepeating: (callback, intervalMs) =>
    window.setInterval(callback, intervalMs),
  clearRepeating: (handle) =>
    window.clearInterval(handle as number),
};

/**
 * Timeline Engine Runtime is the only current-frame, range, transport and
 * clock authority. Project Nexus and the Editor root only expose project
 * scope and wire this port to consumers.
 */
export function createLayerDocumentTimelinePlaybackRuntime(
  options: {
    scope: LayerDocumentTimelineNexusPort["scope"];
    scheduler:
      LayerDocumentTimelinePlaybackScheduler;
    clearDraft?: () => void;
  }
): LayerDocumentTimelineRuntimePort {
  const metadata = () => {
    const scope = options.scope.read();
    return scope.ok
      ? {
          durationFrames:
            scope.model.activeGroup.data
              .durationFrames,
          frameRate:
            scope.model.activeGroup.data.frameRate,
        }
      : { durationFrames: 1, frameRate: 1 };
  };
  const initialMetadata = metadata();
  let currentFrame = 0;
  let range = normalizePlaybackRange(
    {
      startFrame: 0,
      endFrame: Math.max(
        initialMetadata.durationFrames - 1,
        1
      ),
    },
    initialMetadata.durationFrames
  );
  let isPlaying = false;
  let loop = false;
  let clockHandle: unknown = null;
  let scheduledFrameRate: number | null = null;
  const listeners = new Set<() => void>();
  let snapshot = {
    currentFrame,
    range,
    isPlaying,
    loop,
  };
  const refreshSnapshot = () => {
    snapshot = {
      currentFrame,
      range,
      isPlaying,
      loop,
    };
  };
  const read: LayerDocumentTimelinePlaybackPort["read"] =
    () => snapshot;
  const notify = () => {
    listeners.forEach((listener) => listener());
  };
  const publish = (
    nextFrame: number,
    nextRange = range
  ) => {
    const changed =
      currentFrame !== nextFrame ||
      range.startFrame !== nextRange.startFrame ||
      range.endFrame !== nextRange.endFrame;
    currentFrame = nextFrame;
    range = nextRange;
    if (changed) {
      refreshSnapshot();
      notify();
    }
  };
  const stopClock = () => {
    if (clockHandle === null) return;
    options.scheduler.clearRepeating(clockHandle);
    clockHandle = null;
    scheduledFrameRate = null;
  };
  const pause = () => {
    stopClock();
    if (!isPlaying) return;
    isPlaying = false;
    refreshSnapshot();
    notify();
  };
  const tick = () => {
    if (!isPlaying) return;
    options.clearDraft?.();
    const next = advancePlaybackFrame(
      currentFrame,
      metadata().durationFrames,
      range.startFrame,
      range.endFrame
    );
    publish(next.shouldStop && loop ? range.startFrame : next.frame);
    if (next.shouldStop && !loop) pause();
  };
  const play = () => {
    const { durationFrames, frameRate } =
      metadata();
    if (durationFrames <= 0 || isPlaying) {
      return;
    }
    options.clearDraft?.();
    if (
      currentFrame < range.startFrame ||
      currentFrame >= range.endFrame
    ) {
      publish(range.startFrame);
    }
    isPlaying = true;
    refreshSnapshot();
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
  const reconcile = () => {
    const { durationFrames } = metadata();
    const nextRange = normalizePlaybackRange(
      range,
      durationFrames
    );
    const nextFrame = clampPlaybackFrame(
      currentFrame,
      durationFrames
    );
    publish(nextFrame, nextRange);
    synchronizeClock();
  };
  return {
    read,
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
        publish(
          clampPlaybackFrame(
            frame,
            metadata().durationFrames
          )
        );
      },
      stepBackward: () => {
        pause();
        options.clearDraft?.();
        publish(
          stepPlaybackFrame(
            currentFrame,
            -1,
            metadata().durationFrames
          )
        );
      },
      stepForward: () => {
        pause();
        options.clearDraft?.();
        publish(
          stepPlaybackFrame(
            currentFrame,
            1,
            metadata().durationFrames
          )
        );
      },
      reset: () => {
        pause();
        options.clearDraft?.();
        publish(getPlaybackResetFrame());
      },
      setRange: (startFrame, endFrame) => {
        publish(
          currentFrame,
          normalizePlaybackRange(
            { startFrame, endFrame },
            metadata().durationFrames
          )
        );
      },
      setLoop: (nextLoop) => {
        if (loop === nextLoop) return;
        loop = nextLoop;
        refreshSnapshot();
        notify();
      },
    },
    validity: { reconcile },
    dispose: () => {
      stopClock();
      isPlaying = false;
      refreshSnapshot();
      listeners.clear();
    },
    synchronizeClock,
  };
}
