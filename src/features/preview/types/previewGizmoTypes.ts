import type { ScaleHandleDirection } from "@/editor/types/editorViewTypes";

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

export const GIZMO_HANDLE_SIZE = 10;
