export type TimelineKeyframeProperty = "position" | "opacity" | "scale" | "rotation";

export type TimelineInteraction =
  | {
      type: "move-item";
      itemId: string;
      startClientX: number;
      initialStartFrame: number;
    }
  | {
      type: "resize-start";
      itemId: string;
      startClientX: number;
      initialStartFrame: number;
      initialDurationFrames: number;
    }
  | {
      type: "resize-end";
      itemId: string;
      startClientX: number;
      initialDurationFrames: number;
    }
  | {
      type: "move-keyframe";
      targetKind: "layer" | "composition";
      targetId: string;
      originalFrame: number;
      frame: number;
      property: TimelineKeyframeProperty;
      startClientX: number;
    };
