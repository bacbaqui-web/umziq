import type { AnimatableProperty } from "@/models";

export type TimelineItemMoveSession = {
  type: "move-item";
  itemId: string;
  compId: string;
  startClientX: number;
  initialStartFrame: number;
};

export type TimelineItemResizeSession = {
  type: "resize-start" | "resize-end";
  itemId: string;
  compId: string;
  startClientX: number;
  initialStartFrame: number;
  initialDurationFrames: number;
};

export type TimelineKeyframeMoveSession = {
  type: "move-keyframe";
  compId: string;
  targetKind: "layer" | "composition";
  targetId: string;
  originalFrame: number;
  frame: number;
  property: AnimatableProperty;
  startClientX: number;
};

export type TimelinePointerSession =
  | TimelineItemMoveSession
  | TimelineItemResizeSession
  | TimelineKeyframeMoveSession;

export type TimelineKeyframeProperty = AnimatableProperty;
