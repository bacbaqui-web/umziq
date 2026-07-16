import type { ScaleHandleDirection } from "@/engines/canvas";
export { GIZMO_HANDLE_SIZE } from "@/engines/canvas";

export type PreviewPoint = {
  x: number;
  y: number;
};

export type PreviewLineHandle = {
  point: PreviewPoint;
  lineStart: PreviewPoint;
};

export type PreviewScaleHandle = PreviewLineHandle & {
  key: ScaleHandleDirection;
  borderColor: string;
  label: string;
};

export type HoveredGizmoHandle =
  | ScaleHandleDirection
  | "rotation"
  | "opacity"
  | "move"
  | null;
