import type { RefObject } from "react";
import type { AnimatableProperty, TimelineItem } from "@/models";
import type { SelectedKeyframe } from "@/engines/animation";
import type { SourceSyncStatus } from "@/models";
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
  splitSelectedTimelineItem: () => void;
  selectTimelineItem: (item: TimelineItem) => void;
  activateTimelineItem: (item: TimelineItem, status: SourceSyncStatus) => void;
  resolveTimelineSourceDelete: (item: TimelineItem, decision: "delete" | "keep") => void;
  reorderTimelineItem: (targetItemId: string) => void;
  setDraggedTimelineItemId: (itemId: string | null) => void;
  beginMoveTimelineItem: (clientX: number, item: TimelineItem) => void;
  beginResizeTimelineItemStart: (clientX: number, item: TimelineItem) => void;
  beginResizeTimelineItemEnd: (clientX: number, item: TimelineItem) => void;
  beginRenameTimelineItem: (item: TimelineItem) => void;
  changeTimelineItemName: (name: string) => void;
  commitTimelineItemName: () => void;
  cancelTimelineItemName: () => void;
  handleTimelineItemNameKey: (key: string) => void;
  selectKeyframe: (targetKind: "layer" | "composition", targetId: string, frame: number, property: AnimatableProperty) => void;
  beginMoveKeyframe: (clientX: number, targetKind: "layer" | "composition", targetId: string, frame: number, property: AnimatableProperty) => void;
  deleteKeyframe: (keyframe: NonNullable<SelectedKeyframe>) => void;
};

export type TimelineEngineViewProps = {
  readModel: TimelineReadModel;
  commands: TimelineCommands;
  interactions: TimelineInteractionCommands;
  rulerRef: RefObject<HTMLDivElement | null>;
  switcherRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
};
