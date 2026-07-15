import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { CompositionMeta, Position, Scale } from "@/editor/types/types";
import { buildRulerFrames, clampFrame } from "@/editor/preview/previewEngine";

type UseTimelinePlaybackOptions = {
  timelinePxPerFrame: number;
  selectedMeta: CompositionMeta | null;
  playbackRangeStartFrame: number;
  playbackRangeEndFrame: number;
  currentFrame: number;
  hoveredFrame: number | null;
  setCurrentFrame: Dispatch<SetStateAction<number>>;
  setIsScrubbingTimeline: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
};

type TimelineMetrics = {
  durationFrames: number;
  timelineWidth: number;
};

function clearTransformDrafts(
  setPositionDraft: Dispatch<SetStateAction<Position | null>>,
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>,
  setRotationDraft: Dispatch<SetStateAction<number | null>>,
  setOpacityDraft: Dispatch<SetStateAction<number | null>>
) {
  setPositionDraft(null);
  setScaleDraft(null);
  setRotationDraft(null);
  setOpacityDraft(null);
}

function setTimelineFrame(
  nextFrame: number,
  durationFrames: number,
  setCurrentFrame: Dispatch<SetStateAction<number>>,
  setPositionDraft: Dispatch<SetStateAction<Position | null>>,
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>,
  setRotationDraft: Dispatch<SetStateAction<number | null>>,
  setOpacityDraft: Dispatch<SetStateAction<number | null>>
) {
  clearTransformDrafts(
    setPositionDraft,
    setScaleDraft,
    setRotationDraft,
    setOpacityDraft
  );
  setCurrentFrame(clampFrame(nextFrame, durationFrames));
}

export function useTimelinePlayback({
  timelinePxPerFrame,
  selectedMeta,
  playbackRangeStartFrame,
  playbackRangeEndFrame,
  currentFrame,
  hoveredFrame,
  setCurrentFrame,
  setIsScrubbingTimeline,
  setIsPlaying,
  setPositionDraft,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
}: UseTimelinePlaybackOptions) {
  const timelineRulerRef = useRef<HTMLDivElement | null>(null);
  const [availableTimelineWidth, setAvailableTimelineWidth] = useState(0);
  const timelineMetricsRef = useRef<TimelineMetrics>({
    durationFrames: 0,
    timelineWidth: 0,
  });
  const scrubbingRef = useRef(false);

  const rulerDurationFrames = selectedMeta?.durationFrames ?? 0;
  const resolvedTimelinePxPerFrame =
    selectedMeta && rulerDurationFrames > 0
      ? Math.max(
          (availableTimelineWidth > 0
            ? availableTimelineWidth
            : rulerDurationFrames * timelinePxPerFrame) / rulerDurationFrames,
          0.001
        )
      : timelinePxPerFrame;
  const playheadFrame = selectedMeta
    ? clampFrame(currentFrame, selectedMeta.durationFrames)
    : 0;
  const timelineFrames = selectedMeta
    ? buildRulerFrames(rulerDurationFrames, selectedMeta.frameRate)
    : [];
  const timelineContentWidth = selectedMeta
    ? availableTimelineWidth > 0
      ? availableTimelineWidth
      : rulerDurationFrames * resolvedTimelinePxPerFrame
    : 0;
  const timelinePlayheadLeft = playheadFrame * resolvedTimelinePxPerFrame;
  const hoveredPlayheadLeft =
    hoveredFrame !== null ? hoveredFrame * resolvedTimelinePxPerFrame : null;

  useLayoutEffect(() => {
    const target = timelineRulerRef.current;

    if (!target) {
      return;
    }

    const updateWidth = () => {
      setAvailableTimelineWidth(target.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => {
        window.removeEventListener("resize", updateWidth);
      };
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, []);

  const updateFrameFromPointer = useCallback(
    (clientX: number) => {
      if (!timelineRulerRef.current) {
        return;
      }

      const { durationFrames, timelineWidth } = timelineMetricsRef.current;

      if (durationFrames <= 0) {
        return;
      }

      const bounds = timelineRulerRef.current.getBoundingClientRect();
      const relativeX = Math.min(Math.max(clientX - bounds.left, 0), timelineWidth);
      const nextFrame = clampFrame(
        Math.round(relativeX / resolvedTimelinePxPerFrame),
        // Use the resolved scale so drag/scrub math matches the rendered width.
        durationFrames
      );

      clearTransformDrafts(
        setPositionDraft,
        setScaleDraft,
        setRotationDraft,
        setOpacityDraft
      );
      setCurrentFrame(nextFrame);
    },
    [
      setCurrentFrame,
      setOpacityDraft,
      setPositionDraft,
      setRotationDraft,
      setScaleDraft,
      resolvedTimelinePxPerFrame,
    ]
  );

  const getFrameFromPointer = useCallback(
    (clientX: number) => {
      if (!timelineRulerRef.current) {
        return null;
      }

      const { durationFrames, timelineWidth } = timelineMetricsRef.current;

      if (durationFrames <= 0) {
        return null;
      }

      const bounds = timelineRulerRef.current.getBoundingClientRect();
      const relativeX = Math.min(Math.max(clientX - bounds.left, 0), timelineWidth);

      return clampFrame(Math.round(relativeX / resolvedTimelinePxPerFrame), durationFrames);
    },
    [resolvedTimelinePxPerFrame]
  );

  const handleSetScrubbing = useCallback(
    (scrubbing: boolean) => {
      scrubbingRef.current = scrubbing;
      setIsScrubbingTimeline(scrubbing);
    },
    [setIsScrubbingTimeline]
  );

  const handleResetToStart = useCallback(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
    clearTransformDrafts(
      setPositionDraft,
      setScaleDraft,
      setRotationDraft,
      setOpacityDraft
    );
  }, [
    setCurrentFrame,
    setIsPlaying,
    setOpacityDraft,
    setPositionDraft,
    setRotationDraft,
    setScaleDraft,
  ]);

  const handlePlay = useCallback(() => {
    const durationFrames = selectedMeta?.durationFrames ?? 0;

    if (durationFrames <= 0) {
      return;
    }

    const clampedStartFrame = Math.min(
      Math.max(playbackRangeStartFrame, 0),
      Math.max(durationFrames - 1, 0)
    );
    const clampedEndFrame = Math.min(
      Math.max(playbackRangeEndFrame, clampedStartFrame + 1),
      durationFrames
    );

    clearTransformDrafts(
      setPositionDraft,
      setScaleDraft,
      setRotationDraft,
      setOpacityDraft
    );

    if (currentFrame < clampedStartFrame || currentFrame >= clampedEndFrame) {
      setCurrentFrame(clampedStartFrame);
    }

    setIsPlaying(true);
  }, [
    currentFrame,
    playbackRangeEndFrame,
    playbackRangeStartFrame,
    selectedMeta?.durationFrames,
    setCurrentFrame,
    setIsPlaying,
    setOpacityDraft,
    setPositionDraft,
    setRotationDraft,
    setScaleDraft,
  ]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, [setIsPlaying]);

  const handleStepFrame = useCallback(
    (direction: -1 | 1) => {
      const durationFrames = selectedMeta?.durationFrames ?? 0;

      if (durationFrames <= 0) {
        return;
      }

      setIsPlaying(false);
      setTimelineFrame(
        currentFrame + direction,
        durationFrames,
        setCurrentFrame,
        setPositionDraft,
        setScaleDraft,
        setRotationDraft,
        setOpacityDraft
      );
    },
    [
      currentFrame,
      selectedMeta?.durationFrames,
      setCurrentFrame,
      setIsPlaying,
      setOpacityDraft,
      setPositionDraft,
      setRotationDraft,
      setScaleDraft,
    ]
  );

  const handleStepBackward = useCallback(() => {
    handleStepFrame(-1);
  }, [handleStepFrame]);

  const handleStepForward = useCallback(() => {
    handleStepFrame(1);
  }, [handleStepFrame]);

  useEffect(() => {
    timelineMetricsRef.current = {
      durationFrames: selectedMeta?.durationFrames ?? 0,
      timelineWidth: timelineContentWidth,
    };
  }, [selectedMeta, timelineContentWidth]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (scrubbingRef.current) {
        updateFrameFromPointer(event.clientX);
      }
    };

    const handleMouseUp = () => {
      if (!scrubbingRef.current) {
        return;
      }

      scrubbingRef.current = false;
      setIsScrubbingTimeline(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [setIsScrubbingTimeline, updateFrameFromPointer]);

  return {
    timelineRulerRef,
    playheadFrame,
    timelineFrames,
    timelineContentWidth,
    timelinePxPerFrame: resolvedTimelinePxPerFrame,
    timelinePlayheadLeft,
    hoveredPlayheadLeft,
    getFrameFromPointer,
    updateFrameFromPointer,
    handleSetScrubbing,
    handleResetToStart,
    handlePlay,
    handlePause,
    handleStepBackward,
    handleStepForward,
  };
}
