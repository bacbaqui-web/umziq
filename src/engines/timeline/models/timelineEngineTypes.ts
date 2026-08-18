import type { RefObject } from "react";
import type { AccelerationCurve, AnimatableProperty } from "@/models";
import type { TimelineReadModel } from "@/engines/timeline/models/timelineViewModel";
import type { TimelineSourceStatusViewModel } from "@/engines/timeline/models/timelineViewModel";
import type { TimelinePointerDragBeginInput } from "@/engines/timeline/models/timelinePointerDragSessionModel";

export type TimelinePointerDragStart =
  TimelinePointerDragBeginInput & {
    readonly clientX: number;
  };

export type TimelineCommands = {
  toggleCompositionSwitcher: () => void;
  selectComposition: (compId: string) => void;
  reset: () => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  stepBackward: () => void;
  stepForward: () => void;
  setHoveredFrameFromPointer: (clientX: number) => void;
  leaveRuler: () => void;
  beginScrub: (start: TimelinePointerDragStart) => void;
  beginRangeResize: (start: TimelinePointerDragStart, handle: "start" | "end") => void;
  moveRangeResize: (clientX: number) => void;
  endRangeResize: () => void;
  commitRangeDuration: (seconds: string, frames: string) => void;
  commitTimelineDuration: (seconds: string, frames: string) => void;
  setNameColumnWidth: (width: number) => void;
};

export type TimelineInteractionCommands = {
  duplicateSelectedTimelineItem: () => void;
  duplicateTimelineItem: (itemId: string) => void;
  splitSelectedTimelineItem: () => void;
  selectTimelineItem: (itemId: string) => void;
  toggleTimelineItemExpanded: (itemId: string) => void;
  activateTimelineItem: (
    itemId: string,
    status: TimelineSourceStatusViewModel["status"]
  ) => void;
  resolveTimelineSourceDelete: (itemId: string, decision: "delete" | "keep") => void;
  deleteTimelineItem: (itemId: string) => void;
  reorderTimelineItem: (targetItemId: string) => void;
  setDraggedTimelineItemId: (itemId: string | null) => void;
  beginMoveTimelineItem: (start: TimelinePointerDragStart, itemId: string) => void;
  beginResizeTimelineItemStart: (start: TimelinePointerDragStart, itemId: string) => void;
  beginResizeTimelineItemEnd: (start: TimelinePointerDragStart, itemId: string) => void;
  beginRenameTimelineItem: (itemId: string) => void;
  changeTimelineItemName: (name: string) => void;
  commitTimelineItemName: () => void;
  cancelTimelineItemName: () => void;
  handleTimelineItemNameKey: (key: string) => void;
  selectKeyframe: (itemId: string, frame: number, property: AnimatableProperty) => void;
  beginMoveKeyframe: (start: TimelinePointerDragStart, itemId: string, frame: number, property: AnimatableProperty) => void;
  deleteKeyframe: (itemId: string, frame: number, property: AnimatableProperty) => void;
  setMouthBasicClip: (itemId: string, clip: {
    startFrame: number;
    durationFrames: number;
    transitionFrames: number[];
  }) => void;
  setAccelerationClip: (itemId: string, clip: {
    startFrame: number;
    durationFrames: number;
    curve?: AccelerationCurve;
  }) => void;
  deleteCanonicalTimelineItem: (itemId: string) => void;
  setCanonicalTimelineItemVisibility: (
    itemId: string,
    visible: boolean
  ) => void;
  setCanonicalTimelineItemAlias: (
    itemId: string,
    alias: string | null
  ) => void;
};

export type TimelineEngineViewProps = {
  readModel: TimelineReadModel;
  commands: TimelineCommands;
  interactions: TimelineInteractionCommands;
  rulerRef: RefObject<HTMLDivElement | null>;
  switcherRef: RefObject<HTMLDivElement | null>;
  switcherTriggerRef: RefObject<HTMLButtonElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
};
