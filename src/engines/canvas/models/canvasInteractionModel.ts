import type { Dispatch, SetStateAction } from "react";
import type { PreviewMotionPathPoint, ScaleHandleDirection } from "@/engines/canvas/models/canvasViewModel";

export type PreviewOverlayViewModel = {
  previewCorners: { nw: { x: number; y: number }; ne: { x: number; y: number }; se: { x: number; y: number }; sw: { x: number; y: number } } | null;
  previewAnchor: { x: number; y: number } | null;
  previewRotationHandle: { point: { x: number; y: number }; lineStart: { x: number; y: number } } | null;
  previewOpacityHandle: { point: { x: number; y: number }; lineStart: { x: number; y: number } } | null;
  previewMoveHandle: { point: { x: number; y: number }; lineStart: { x: number; y: number } } | null;
  previewScaleHandles: Array<{ key: ScaleHandleDirection; point: { x: number; y: number }; lineStart: { x: number; y: number }; borderColor: string; label: string }>;
  previewMotionPath: Array<PreviewMotionPathPoint & { point: { x: number; y: number } }>;
  protectedControlPoints: Array<{ x: number; y: number }>;
  polygonPoints: string;
  motionPathPolyline: string;
};

export type CanvasMotionPathPointViewModel = PreviewOverlayViewModel["previewMotionPath"][number] & {
  isInteractive: boolean;
  isHovered: boolean;
  isDragging: boolean;
  radius: number;
  hoverRadius: number;
  displayedOpacity: number;
  hitRadius: number;
};

export type CanvasHoveredHandle =
  | ScaleHandleDirection
  | "rotation"
  | "opacity"
  | "move"
  | null;

export type CanvasDirectInputState =
  | { kind: "rotation"; x: number; y: number; value: string }
  | { kind: "opacity"; x: number; y: number; value: string }
  | {
      kind: "scale";
      handle: ScaleHandleDirection;
      x: number;
      y: number;
      value: string;
    }
  | null;

export type CanvasPendingHandleInteraction =
  | {
      kind: "scale";
      handle: ScaleHandleDirection;
      startClientX: number;
      startClientY: number;
    }
  | {
      kind: "rotation" | "opacity" | "move";
      startClientX: number;
      startClientY: number;
    }
  | null;

export type CanvasPendingMotionPathInteraction = {
  frame: number;
  isKeyframe: boolean;
  startClientX: number;
  startClientY: number;
} | null;

export type CanvasInteractionStatePort = {
  isDraggingAnchor: boolean;
  setIsDraggingAnchor: Dispatch<SetStateAction<boolean>>;
  isDraggingPosition: boolean;
  setIsDraggingPosition: Dispatch<SetStateAction<boolean>>;
  isDraggingOpacity: boolean;
  setIsDraggingOpacity: Dispatch<SetStateAction<boolean>>;
  isDraggingRotation: boolean;
  setIsDraggingRotation: Dispatch<SetStateAction<boolean>>;
  isDraggingMotionPathKeyframe: boolean;
  setIsDraggingMotionPathKeyframe: Dispatch<SetStateAction<boolean>>;
  positionHandleReadout: string | null;
  setPositionHandleReadout: Dispatch<SetStateAction<string | null>>;
  opacityHandleReadout: string | null;
  setOpacityHandleReadout: Dispatch<SetStateAction<string | null>>;
  rotationHandleReadout: string | null;
  setRotationHandleReadout: Dispatch<SetStateAction<string | null>>;
  scaleHandleReadout: { handle: ScaleHandleDirection; text: string } | null;
  setScaleHandleReadout: Dispatch<
    SetStateAction<{ handle: ScaleHandleDirection; text: string } | null>
  >;
  motionPathKeyframeReadout: string | null;
  setMotionPathKeyframeReadout: Dispatch<SetStateAction<string | null>>;
  draggingMotionPathFrame: number | null;
  setDraggingMotionPathFrame: Dispatch<SetStateAction<number | null>>;
  hoveredHandle: CanvasHoveredHandle;
  setHoveredHandle: Dispatch<SetStateAction<CanvasHoveredHandle>>;
  hoveredMotionFrame: number | null;
  setHoveredMotionFrame: Dispatch<SetStateAction<number | null>>;
  pendingHandleInteraction: CanvasPendingHandleInteraction;
  setPendingHandleInteraction: Dispatch<SetStateAction<CanvasPendingHandleInteraction>>;
  pendingMotionPathInteraction: CanvasPendingMotionPathInteraction;
  setPendingMotionPathInteraction: Dispatch<
    SetStateAction<CanvasPendingMotionPathInteraction>
  >;
  suppressedMotionPathClickFrame: number | null;
  setSuppressedMotionPathClickFrame: Dispatch<SetStateAction<number | null>>;
  isAnchorHovered: boolean;
  setIsAnchorHovered: Dispatch<SetStateAction<boolean>>;
  directInput: CanvasDirectInputState;
  setDirectInput: Dispatch<SetStateAction<CanvasDirectInputState>>;
};

export type CanvasGizmoViewModel = PreviewOverlayViewModel & {
  isVisible: boolean;
  cursors: {
    move: string;
    rotation: string;
    opacity: string;
    scale: Record<ScaleHandleDirection, string>;
  };
  motionPathPoints: CanvasMotionPathPointViewModel[];
  currentMotionFrame: number | null;
  hoveredHandle: CanvasHoveredHandle;
  hoveredMotionFrame: number | null;
  isDraggingAnchor: boolean;
  isDraggingPosition: boolean;
  isDraggingOpacity: boolean;
  isDraggingRotation: boolean;
  positionReadout: string | null;
  opacityReadout: string | null;
  rotationReadout: string | null;
  scaleReadout: { handle: ScaleHandleDirection; text: string } | null;
  activeScaleHandle: PreviewOverlayViewModel["previewScaleHandles"][number] | null;
  directInput: CanvasDirectInputState;
  anchorOpacity: number;
  isAnchorHovered: boolean;
  motionPathInteractionLocked: boolean;
  draggingMotionPathFrame: number | null;
  motionPathDragReadout: string | null;
};

export type CanvasInteractionCommands = {
  pressMove: (clientX: number, clientY: number) => void;
  pressRotation: (clientX: number, clientY: number) => void;
  pressOpacity: (clientX: number, clientY: number) => void;
  pressScale: (
    handle: ScaleHandleDirection,
    clientX: number,
    clientY: number
  ) => void;
  pressTarget: (clientX: number, clientY: number) => void;
  pressAnchor: () => void;
  hoverHandle: (handle: CanvasHoveredHandle) => void;
  hoverAnchor: (hovered: boolean) => void;
  hoverMotionFrame: (frame: number | null) => void;
  pressMotionPathPoint: (
    frame: number,
    isKeyframe: boolean,
    clientX: number,
    clientY: number
  ) => void;
  selectMotionPathPoint: (frame: number, isKeyframe: boolean) => void;
  openRotationInput: () => void;
  openOpacityInput: () => void;
  openScaleInput: (handle: ScaleHandleDirection, x: number, y: number) => void;
  changeDirectInput: (value: string) => void;
  commitDirectInput: () => void;
  closeDirectInput: () => void;
};

export type CanvasPointerSample = {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
};

export type CanvasPointerSession = {
  onMove: (sample: CanvasPointerSample) => void;
  onCommit: () => void;
  onCancel: () => void;
};

export type CanvasPointerController = {
  start: (session: CanvasPointerSession) => void;
  cancel: () => void;
};
