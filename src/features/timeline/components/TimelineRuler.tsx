import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import TimelineDurationSplitEditor from "@/features/timeline/components/TimelineDurationSplitEditor";
import type { TimelinePanelProps } from "@/features/timeline/types/timelineTypes";

type TimelineRulerProps = Pick<
  TimelinePanelProps,
  | "selectedMeta"
  | "timelineContentWidth"
  | "timelineFrames"
  | "timelinePxPerFrame"
  | "timelinePlayheadLeft"
  | "playbackRangeStartFrame"
  | "playbackRangeEndFrame"
  | "hoveredPlayheadLeft"
  | "hoveredFrame"
  | "isScrubbingTimeline"
  | "timelineRulerRef"
  | "formatCompactTime"
  | "onUpdateCompositionDuration"
  | "onUpdateCompositionPlaybackRange"
  | "onBeginPlaybackRangeEdit"
  | "onMarkPlaybackRangeEditDirty"
  | "onCommitPlaybackRangeEdit"
  | "onSetHoveredFrame"
  | "onGetFrameFromPointer"
  | "onRulerMouseDown"
  | "onSetScrubbing"
>;

type PlaybackRangeDragState = {
  handle: "start" | "end";
  startClientX: number;
  initialStartFrame: number;
  initialEndFrame: number;
};

type TimelineReadoutState =
  | {
      mode: "hover" | "scrub" | "resize";
      frame: number;
      left: number;
    }
  | null;

export default function TimelineRuler({
  selectedMeta,
  timelineContentWidth,
  timelineFrames,
  timelinePxPerFrame,
  timelinePlayheadLeft,
  playbackRangeStartFrame,
  playbackRangeEndFrame,
  hoveredPlayheadLeft,
  hoveredFrame,
  isScrubbingTimeline,
  timelineRulerRef,
  formatCompactTime,
  onUpdateCompositionDuration,
  onUpdateCompositionPlaybackRange,
  onBeginPlaybackRangeEdit,
  onMarkPlaybackRangeEditDirty,
  onCommitPlaybackRangeEdit,
  onSetHoveredFrame,
  onGetFrameFromPointer,
  onRulerMouseDown,
  onSetScrubbing,
}: TimelineRulerProps) {
  const [activeResizeHandle, setActiveResizeHandle] = useState<PlaybackRangeDragState["handle"] | null>(null);
  const [isHoveringRuler, setIsHoveringRuler] = useState(false);
  const playbackRangeDragRef = useRef<PlaybackRangeDragState | null>(null);

  useEffect(() => {
    return () => {
      playbackRangeDragRef.current = null;
    };
  }, []);

  if (!selectedMeta) {
    return null;
  }

  const playbackRangeLeft = playbackRangeStartFrame * timelinePxPerFrame;
  const playbackRangeWidth = Math.max(
    (playbackRangeEndFrame - playbackRangeStartFrame) * timelinePxPerFrame,
    6
  );
  const playbackRangeRight = playbackRangeEndFrame * timelinePxPerFrame;
  const snappedPlayheadLeft = Math.round(timelinePlayheadLeft) - 1;
  const scrubFrame = Math.round(timelinePlayheadLeft / timelinePxPerFrame);
  const activeReadout: TimelineReadoutState = activeResizeHandle
    ? {
        mode: "resize",
        frame:
          activeResizeHandle === "start" ? playbackRangeStartFrame : playbackRangeEndFrame,
        left: activeResizeHandle === "start" ? playbackRangeLeft : playbackRangeRight,
      }
    : isScrubbingTimeline
      ? {
          mode: "scrub",
          frame: scrubFrame,
          left: timelinePlayheadLeft,
        }
      : hoveredFrame !== null && hoveredPlayheadLeft !== null && isHoveringRuler
        ? {
            mode: "hover",
            frame: hoveredFrame,
            left: hoveredPlayheadLeft,
          }
        : null;
  const shouldHideRulerCursor =
    activeReadout?.mode === "hover" || activeReadout?.mode === "scrub" || activeReadout?.mode === "resize";
  const activeIndicator = activeReadout
    ? {
        left: activeReadout.left,
        width: activeReadout.mode === "hover" ? 1 : 2,
        background:
          activeReadout.mode === "hover"
            ? "rgba(173, 216, 255, 0.75)"
            : activeReadout.mode === "scrub"
              ? "rgba(245,165,36,0.95)"
              : "rgba(213, 219, 227, 0.82)",
        zIndex: activeReadout.mode === "hover" ? 4 : 8,
        boxShadow:
          activeReadout.mode === "scrub"
            ? "0 0 0 1px rgba(245,165,36,0.18)"
            : activeReadout.mode === "resize"
              ? "0 0 0 1px rgba(213, 219, 227, 0.18)"
              : undefined,
      }
    : {
        left: snappedPlayheadLeft,
        width: 2,
        background: "rgba(223, 82, 70, 0.95)",
        zIndex: 8,
        boxShadow: "0 0 0 1px rgba(223, 82, 70, 0.18)",
      };

  const getTimelineScrollContainer = () => {
    const gridElement = timelineRulerRef.current?.parentElement;
    const scrollContainer = gridElement?.parentElement;

    return scrollContainer instanceof HTMLDivElement ? scrollContainer : null;
  };

  const maybeAutoScrollTimeline = (
    clientX: number,
    handle: PlaybackRangeDragState["handle"]
  ) => {
    const scrollContainer = getTimelineScrollContainer();

    if (!scrollContainer) {
      return;
    }

    const bounds = scrollContainer.getBoundingClientRect();
    const edgePadding = 48;
    const minStep = 12;
    const maxStep = 36;

    if (handle === "end" && clientX >= bounds.right - edgePadding) {
      const overflow = clientX - (bounds.right - edgePadding);
      const nextStep = Math.min(maxStep, Math.max(minStep, overflow));
      scrollContainer.scrollLeft += nextStep;
      return;
    }

    if (handle === "start" && clientX <= bounds.left + edgePadding) {
      const overflow = bounds.left + edgePadding - clientX;
      const nextStep = Math.min(maxStep, Math.max(minStep, overflow));
      scrollContainer.scrollLeft -= nextStep;
    }
  };

  const beginPlaybackRangeResize = (
    event: ReactMouseEvent<HTMLDivElement>,
    handle: PlaybackRangeDragState["handle"]
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onBeginPlaybackRangeEdit();
    setActiveResizeHandle(handle);
    playbackRangeDragRef.current = {
      handle,
      startClientX: event.clientX,
      initialStartFrame: playbackRangeStartFrame,
      initialEndFrame: playbackRangeEndFrame,
    };
  };

  const applyPlaybackRangeDrag = (clientX: number) => {
    const dragState = playbackRangeDragRef.current;

    if (!dragState) {
      return;
    }

    const deltaFrames = Math.round(
      (clientX - dragState.startClientX) / timelinePxPerFrame
    );

    if (dragState.handle === "start") {
      const nextStartFrame = Math.min(
        Math.max(dragState.initialStartFrame + deltaFrames, 0),
        dragState.initialEndFrame - 1
      );

      if (nextStartFrame === playbackRangeStartFrame) {
        maybeAutoScrollTimeline(clientX, dragState.handle);
        return;
      }

      onUpdateCompositionPlaybackRange(nextStartFrame, dragState.initialEndFrame);
      onMarkPlaybackRangeEditDirty();
      maybeAutoScrollTimeline(clientX, dragState.handle);
      return;
    }

    const nextEndFrame = Math.max(
      dragState.initialStartFrame + 1,
      dragState.initialEndFrame + deltaFrames
    );

    if (nextEndFrame === playbackRangeEndFrame) {
      maybeAutoScrollTimeline(clientX, dragState.handle);
      return;
    }

    onUpdateCompositionPlaybackRange(dragState.initialStartFrame, nextEndFrame);
    onMarkPlaybackRangeEditDirty();
    maybeAutoScrollTimeline(clientX, dragState.handle);
  };

  const endPlaybackRangeResize = () => {
    playbackRangeDragRef.current = null;
    setActiveResizeHandle(null);
    onCommitPlaybackRangeEdit();
  };

  const getTickStyle = (frame: number) => {
    const isSecondTick = frame % selectedMeta.frameRate === 0;
    const isTenFrameTick = frame % 10 === 0;

    if (isSecondTick) {
      return {
        top: 0,
        height: 30,
        width: 1,
        background: "rgba(255,255,255,0.22)",
      };
    }

    if (isTenFrameTick) {
      return {
        top: 8,
        height: 22,
        width: 1,
        background: "rgba(255,255,255,0.12)",
      };
    }

    return {
      top: 14,
      height: 16,
      width: 1,
      background: "rgba(255,255,255,0.06)",
    };
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 8,
        }}
      >
        <TimelineDurationSplitEditor
          valueFrames={Math.max(playbackRangeEndFrame - playbackRangeStartFrame, 1)}
          frameRate={selectedMeta.frameRate}
          accent="range"
          title="클릭해서 playback range 길이 편집"
          onCommit={(nextDurationFrames) => {
            const nextEndFrame = Math.max(
              playbackRangeStartFrame + nextDurationFrames,
              playbackRangeStartFrame + 1
            );

            if (nextEndFrame === playbackRangeEndFrame) {
              return;
            }

            onBeginPlaybackRangeEdit();
            onMarkPlaybackRangeEditDirty();
            onUpdateCompositionPlaybackRange(playbackRangeStartFrame, nextEndFrame);
            onCommitPlaybackRangeEdit();
          }}
        />
        <TimelineDurationSplitEditor
          valueFrames={Math.max(selectedMeta.durationFrames, 1)}
          frameRate={selectedMeta.frameRate}
          accent="timeline"
          title="클릭해서 전체 타임라인 길이 편집"
          onCommit={(nextDurationFrames) => {
            onUpdateCompositionDuration(nextDurationFrames);
          }}
        />
      </div>

      <div
        ref={timelineRulerRef}
        onMouseMove={(event) => {
          setIsHoveringRuler(true);
          onSetHoveredFrame(onGetFrameFromPointer(event.clientX));
        }}
        onMouseLeave={() => {
          setIsHoveringRuler(false);
          if (!isScrubbingTimeline && !activeResizeHandle) {
            onSetHoveredFrame(null);
          }
        }}
        onMouseDown={(event) => {
          onRulerMouseDown(event.clientX);
          onSetScrubbing(true);
        }}
        style={{
          position: "relative",
          height: 30,
          overflow: "hidden",
          border: "1px solid #3a3a3a",
          borderLeft: "none",
          borderRadius: "0 6px 6px 0",
          background: "#202020",
          cursor: shouldHideRulerCursor
            ? "none"
            : "crosshair",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: playbackRangeLeft,
            top: 3,
            height: 24,
            width: playbackRangeWidth,
            borderRadius: 0,
            background: "rgba(245, 165, 36, 0.2)",
            border: "1px solid rgba(245, 165, 36, 0.7)",
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <div
            onMouseDown={(event) => beginPlaybackRangeResize(event, "start")}
            style={{
              position: "absolute",
              left: -4,
              top: -1,
              bottom: -1,
              width: 10,
              background: "transparent",
              cursor: "ew-resize",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 4,
                top: 1,
                bottom: 1,
                width: 2,
                borderRadius: 999,
                background: "rgba(255, 218, 128, 0.95)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.14)",
              }}
            />
          </div>
          <div
            onMouseDown={(event) => beginPlaybackRangeResize(event, "end")}
            style={{
              position: "absolute",
              right: -4,
              top: -1,
              bottom: -1,
              width: 10,
              background: "transparent",
              cursor: "ew-resize",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: 4,
                top: 1,
                bottom: 1,
                width: 2,
                borderRadius: 999,
                background: "rgba(255, 218, 128, 0.95)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.14)",
              }}
            />
          </div>
        </div>

        <div
          style={{
            width: timelineContentWidth,
            height: "100%",
            display: "flex",
          }}
        >
          {timelineFrames.map((frame) => (
            <div
              key={frame.frame}
              style={{
                width: timelinePxPerFrame,
                flex: "0 0 auto",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  ...getTickStyle(frame.frame),
                }}
              />
              {frame.label && (
                <span
                  style={{
                    position: "absolute",
                    left: 4,
                    top: 6,
                    fontSize: 11,
                    color: "#bbb",
                  }}
                >
                  {frame.label}
                </span>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: activeIndicator.left,
            top: 0,
            bottom: 0,
            width: activeIndicator.width,
            background: activeIndicator.background,
            boxShadow: activeIndicator.boxShadow,
            pointerEvents: "none",
            zIndex: activeIndicator.zIndex,
          }}
        />

        {activeReadout && (
          <div
            style={{
              position: "absolute",
              left: Math.max(4, activeReadout.left - 18),
              top: "50%",
              transform: "translateY(-50%)",
              padding: "2px 6px",
              borderRadius: 999,
              background:
                activeReadout.mode === "hover"
                  ? "rgba(18, 22, 28, 0.94)"
                  : "rgba(55, 59, 66, 0.92)",
              border:
                activeReadout.mode === "hover"
                  ? "1px solid #3d4d5c"
                  : "1px solid rgba(132, 138, 150, 0.55)",
              color: activeReadout.mode === "hover" ? "#dbe7f2" : "#eef2f6",
              fontSize: 11,
              lineHeight: 1.2,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            {formatCompactTime(activeReadout.frame, selectedMeta.frameRate)}
          </div>
        )}
      </div>

      {(isScrubbingTimeline || !!activeResizeHandle) && (
        <div
          onMouseMove={(event) => {
            if (activeResizeHandle) {
              applyPlaybackRangeDrag(event.clientX);
            }
          }}
          onMouseUp={() => {
            if (activeResizeHandle) {
              endPlaybackRangeResize();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            cursor: "none",
            background: "transparent",
            zIndex: 999,
          }}
        />
      )}
    </>
  );
}
