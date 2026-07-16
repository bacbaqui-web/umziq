import type { Position } from "@/models";

export type PreviewOverlayCorners = {
  nw: Position;
  ne: Position;
  se: Position;
  sw: Position;
};

export type PreviewMotionPathPoint = {
  frame: number;
  x: number;
  y: number;
  isKeyframe: boolean;
  isCurrent: boolean;
};

export type PreviewOverlay =
  | {
      targetKind: "layer";
      targetId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      centerX: number;
      centerY: number;
      corners: PreviewOverlayCorners;
      anchorX: number;
      anchorY: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
      sourceWidth: number;
      sourceHeight: number;
      canvasWidth: number;
      canvasHeight: number;
    }
  | {
      targetKind: "composition";
      targetId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      centerX: number;
      centerY: number;
      corners: PreviewOverlayCorners;
      anchorX: number;
      anchorY: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
      sourceWidth: number;
      sourceHeight: number;
      canvasWidth: number;
      canvasHeight: number;
    }
  | null;

export type ScaleHandleDirection = "x" | "y" | "xy";
