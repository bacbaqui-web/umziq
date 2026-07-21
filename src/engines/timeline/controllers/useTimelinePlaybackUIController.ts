import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clampPlaybackFrame, type PlaybackCommands, type PlaybackReadModel } from "@/engines/playback-render";
import type { CompositionMeta } from "@/models";
import {
  buildTimelineRulerFrames,
  parseTimelineDurationParts,
  resolveTimelinePxPerFrame,
} from "@/engines/timeline/helpers/timelineLayoutHelpers";
import { buildTimelineDurationViewModel } from "@/engines/timeline/helpers/timelineViewModelHelpers";
import type { TimelineRulerViewModel } from "@/engines/timeline/models/timelineViewModel";

type RangeHandle = "start" | "end";
type RangeDrag = {
  handle: RangeHandle;
  startClientX: number;
  initialStartFrame: number;
  initialEndFrame: number;
};

type Options = {
  defaultPxPerFrame: number;
  selectedMeta: CompositionMeta | null;
  playback: PlaybackReadModel;
  playbackCommands: PlaybackCommands;
  hoveredFrame: number | null;
  isScrubbing: boolean;
  setHoveredFrame: (frame: number | null) => void;
  setIsScrubbing: (scrubbing: boolean) => void;
  duration: {
    updateDuration: (durationFrames: number) => void;
    beginRangeEdit: () => void;
    markRangeEditDirty: () => void;
    commitRangeEdit: () => void;
  };
  formatTime: (frame: number, frameRate: number) => string;
};

export function useTimelinePlaybackUIController(options: Options) {
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const rangeDragRef = useRef<RangeDrag | null>(null);
  const scrubbingRef = useRef(false);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [activeResizeHandle, setActiveResizeHandle] = useState<RangeHandle | null>(null);
  const [isHoveringRuler, setIsHoveringRuler] = useState(false);
  const durationFrames = options.selectedMeta?.durationFrames ?? 0;
  const pxPerFrame = resolveTimelinePxPerFrame(
    durationFrames,
    availableWidth,
    options.defaultPxPerFrame
  );
  const contentWidth = options.selectedMeta
    ? availableWidth > 0 ? availableWidth : durationFrames * pxPerFrame
    : 0;
  const playheadFrame = options.selectedMeta ? options.playback.playheadFrame : 0;
  const playheadLeft = playheadFrame * pxPerFrame;
  const hoveredPlayheadLeft = options.hoveredFrame !== null
    ? options.hoveredFrame * pxPerFrame
    : null;
  const range = options.playback.playbackRange;
  const rangeLeft = range.startFrame * pxPerFrame;
  const rangeRight = range.endFrame * pxPerFrame;
  const rangeWidth = Math.max((range.endFrame - range.startFrame) * pxPerFrame, 6);
  const scrubFrame = Math.round(playheadLeft / pxPerFrame);
  const activeReadout = useMemo(() => activeResizeHandle
    ? {
        mode: "resize" as const,
        frame: activeResizeHandle === "start" ? range.startFrame : range.endFrame,
        left: activeResizeHandle === "start" ? rangeLeft : rangeRight,
      }
    : options.isScrubbing
      ? { mode: "scrub" as const, frame: scrubFrame, left: playheadLeft }
      : options.hoveredFrame !== null && hoveredPlayheadLeft !== null && isHoveringRuler
        ? { mode: "hover" as const, frame: options.hoveredFrame, left: hoveredPlayheadLeft }
        : null, [activeResizeHandle, hoveredPlayheadLeft, isHoveringRuler, options.hoveredFrame, options.isScrubbing, playheadLeft, range.endFrame, range.startFrame, rangeLeft, rangeRight, scrubFrame]);
  const indicator = useMemo(() => activeReadout
    ? {
        left: activeReadout.left,
        width: activeReadout.mode === "hover" ? 1 : 2,
        background: activeReadout.mode === "hover"
          ? "rgba(173, 216, 255, 0.75)"
          : activeReadout.mode === "scrub"
            ? "rgba(245,165,36,0.95)"
            : "rgba(213, 219, 227, 0.82)",
        zIndex: activeReadout.mode === "hover" ? 4 : 8,
        boxShadow: activeReadout.mode === "scrub"
          ? "0 0 0 1px rgba(245,165,36,0.18)"
          : activeReadout.mode === "resize"
            ? "0 0 0 1px rgba(213, 219, 227, 0.18)"
            : undefined,
      }
    : {
        left: Math.round(playheadLeft) - 1,
        width: 2,
        background: "rgba(223, 82, 70, 0.95)",
        zIndex: 8,
        boxShadow: "0 0 0 1px rgba(223, 82, 70, 0.18)",
      }, [activeReadout, playheadLeft]);
  const ruler: TimelineRulerViewModel = useMemo(() => ({
    contentWidth,
    pxPerFrame,
    frames: options.selectedMeta
      ? buildTimelineRulerFrames(durationFrames, options.selectedMeta.frameRate)
      : [],
    playheadLeft,
    hoveredPlayheadLeft,
    hoveredFrame: options.hoveredFrame,
    isScrubbing: options.isScrubbing,
    playbackRangeStartFrame: range.startFrame,
    playbackRangeEndFrame: range.endFrame,
    playbackRangeLeft: rangeLeft,
    playbackRangeWidth: rangeWidth,
    playbackRangeRight: rangeRight,
    activeResizeHandle,
    activeReadout: activeReadout && options.selectedMeta
      ? { ...activeReadout, text: options.formatTime(activeReadout.frame, options.selectedMeta.frameRate) }
      : null,
    indicator,
    hideCursor: !!activeReadout,
    showInteractionShield: options.isScrubbing || !!activeResizeHandle,
    rangeDuration: buildTimelineDurationViewModel(
      Math.max(range.endFrame - range.startFrame, 1),
      options.selectedMeta?.frameRate ?? 1,
      "range"
    ),
    timelineDuration: buildTimelineDurationViewModel(
      Math.max(durationFrames, 1),
      options.selectedMeta?.frameRate ?? 1,
      "timeline"
    ),
  }), [
    activeReadout,
    activeResizeHandle,
    contentWidth,
    durationFrames,
    hoveredPlayheadLeft,
    indicator,
    options,
    playheadLeft,
    pxPerFrame,
    range.endFrame,
    range.startFrame,
    rangeLeft,
    rangeRight,
    rangeWidth,
  ]);

  useLayoutEffect(() => {
    const target = rulerRef.current;
    if (!target) return;
    const updateWidth = () => setAvailableWidth(target.clientWidth);
    updateWidth();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }
    const observer = new ResizeObserver(updateWidth);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const getFrameFromPointer = useCallback((clientX: number) => {
    if (!rulerRef.current || durationFrames <= 0) return null;
    const bounds = rulerRef.current.getBoundingClientRect();
    const relativeX = Math.min(Math.max(clientX - bounds.left, 0), contentWidth);
    return clampPlaybackFrame(Math.round(relativeX / pxPerFrame), durationFrames);
  }, [contentWidth, durationFrames, pxPerFrame]);

  const seekFromPointer = useCallback((clientX: number) => {
    const frame = getFrameFromPointer(clientX);
    if (frame !== null) options.playbackCommands.seek(frame);
  }, [getFrameFromPointer, options.playbackCommands]);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (scrubbingRef.current) seekFromPointer(event.clientX);
    };
    const up = () => {
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      options.setIsScrubbing(false);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [options, seekFromPointer]);

  const setHoveredFrameFromPointer = useCallback((clientX: number) => {
    setIsHoveringRuler(true);
    options.setHoveredFrame(getFrameFromPointer(clientX));
  }, [getFrameFromPointer, options]);

  const leaveRuler = useCallback(() => {
    setIsHoveringRuler(false);
    if (!options.isScrubbing && !activeResizeHandle) options.setHoveredFrame(null);
  }, [activeResizeHandle, options]);

  const beginScrub = useCallback((clientX: number) => {
    seekFromPointer(clientX);
    scrubbingRef.current = true;
    options.setIsScrubbing(true);
  }, [options, seekFromPointer]);

  const beginRangeResize = useCallback((clientX: number, handle: RangeHandle) => {
    options.duration.beginRangeEdit();
    setActiveResizeHandle(handle);
    rangeDragRef.current = {
      handle,
      startClientX: clientX,
      initialStartFrame: range.startFrame,
      initialEndFrame: range.endFrame,
    };
  }, [options.duration, range.endFrame, range.startFrame]);

  const moveRangeResize = useCallback((clientX: number) => {
    const drag = rangeDragRef.current;
    if (!drag) return;
    const delta = Math.round((clientX - drag.startClientX) / pxPerFrame);
    const nextStart = drag.handle === "start"
      ? Math.min(Math.max(drag.initialStartFrame + delta, 0), drag.initialEndFrame - 1)
      : drag.initialStartFrame;
    const nextEnd = drag.handle === "end"
      ? Math.max(drag.initialStartFrame + 1, drag.initialEndFrame + delta)
      : drag.initialEndFrame;
    const gridElement = rulerRef.current?.parentElement;
    const scrollContainer = gridElement?.parentElement;
    if (scrollContainer instanceof HTMLDivElement) {
      const bounds = scrollContainer.getBoundingClientRect();
      const edgePadding = 48;
      const overflow = drag.handle === "end"
        ? clientX - (bounds.right - edgePadding)
        : bounds.left + edgePadding - clientX;
      if (overflow >= 0) {
        const step = Math.min(36, Math.max(12, overflow));
        scrollContainer.scrollTo({
          left: scrollContainer.scrollLeft + (drag.handle === "end" ? step : -step),
        });
      }
    }
    if (nextStart === range.startFrame && nextEnd === range.endFrame) return;
    options.playbackCommands.setPlaybackRange(nextStart, nextEnd);
    options.duration.markRangeEditDirty();
  }, [options.duration, options.playbackCommands, pxPerFrame, range.endFrame, range.startFrame]);

  const endRangeResize = useCallback(() => {
    if (!rangeDragRef.current) return;
    rangeDragRef.current = null;
    setActiveResizeHandle(null);
    options.duration.commitRangeEdit();
  }, [options.duration]);

  const commitRangeDuration = useCallback((seconds: string, frames: string) => {
    const parsed = parseTimelineDurationParts(seconds, frames, options.selectedMeta?.frameRate ?? 1);
    if (parsed === null) return;
    const nextEnd = Math.max(range.startFrame + parsed, range.startFrame + 1);
    if (nextEnd === range.endFrame) return;
    options.duration.beginRangeEdit();
    options.duration.markRangeEditDirty();
    options.playbackCommands.setPlaybackRange(range.startFrame, nextEnd);
    options.duration.commitRangeEdit();
  }, [options.duration, options.playbackCommands, options.selectedMeta?.frameRate, range.endFrame, range.startFrame]);

  const commitTimelineDuration = useCallback((seconds: string, frames: string) => {
    const parsed = parseTimelineDurationParts(seconds, frames, options.selectedMeta?.frameRate ?? 1);
    if (parsed !== null) options.duration.updateDuration(parsed);
  }, [options.duration, options.selectedMeta?.frameRate]);

  const commands = useMemo(() => ({
    reset: options.playbackCommands.reset,
    play: options.playbackCommands.play,
    pause: options.playbackCommands.pause,
    togglePlayback: options.playbackCommands.togglePlayback,
    stepBackward: options.playbackCommands.stepBackward,
    stepForward: options.playbackCommands.stepForward,
    setHoveredFrameFromPointer,
    leaveRuler,
    beginScrub,
    beginRangeResize,
    moveRangeResize,
    endRangeResize,
    commitRangeDuration,
    commitTimelineDuration,
  }), [beginRangeResize, beginScrub, commitRangeDuration, commitTimelineDuration, endRangeResize, leaveRuler, moveRangeResize, options.playbackCommands, setHoveredFrameFromPointer]);

  return {
    rulerRef,
    ruler,
    playheadFrame,
    pxPerFrame,
    contentWidth,
    playheadLeft,
    hoveredPlayheadLeft,
    commands,
  };
}
