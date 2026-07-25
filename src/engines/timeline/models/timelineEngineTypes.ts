import type { RefObject } from "react";
import type { AnimatableProperty } from "@/models";
import type { SourceRegistryRefreshStatus } from "@/models";
import type { TimelineReadModel } from "@/engines/timeline/models/timelineViewModel";

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
  beginScrub: (clientX: number) => void;
  beginRangeResize: (clientX: number, handle: "start" | "end") => void;
  moveRangeResize: (clientX: number) => void;
  endRangeResize: () => void;
  commitRangeDuration: (seconds: string, frames: string) => void;
  commitTimelineDuration: (seconds: string, frames: string) => void;
};

export type TimelineInteractionCommands = {
  duplicateSelectedTimelineItem: () => void;
  duplicateTimelineItem: (itemId: string) => void;
  splitSelectedTimelineItem: () => void;
  selectTimelineItem: (itemId: string) => void;
  activateTimelineItem: (
    itemId: string,
    status: SourceRegistryRefreshStatus
  ) => void;
  resolveTimelineSourceDelete: (itemId: string, decision: "delete" | "keep") => void;
  deleteTimelineItem: (itemId: string) => void;
  reorderTimelineItem: (targetItemId: string) => void;
  setDraggedTimelineItemId: (itemId: string | null) => void;
  beginMoveTimelineItem: (clientX: number, itemId: string) => void;
  beginResizeTimelineItemStart: (clientX: number, itemId: string) => void;
  beginResizeTimelineItemEnd: (clientX: number, itemId: string) => void;
  beginRenameTimelineItem: (itemId: string) => void;
  changeTimelineItemName: (name: string) => void;
  commitTimelineItemName: () => void;
  cancelTimelineItemName: () => void;
  handleTimelineItemNameKey: (key: string) => void;
  selectKeyframe: (itemId: string, frame: number, property: AnimatableProperty) => void;
  beginMoveKeyframe: (clientX: number, itemId: string, frame: number, property: AnimatableProperty) => void;
  deleteKeyframe: (itemId: string, frame: number, property: AnimatableProperty) => void;
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
