import type { AnimatableProperty } from "@/editor/types/types";

export const PREVIEW_MIN_WORKSPACE_WIDTH = 360;
export const PREVIEW_MIN_WORKSPACE_HEIGHT = 320;
export const TIMELINE_NAME_COL_WIDTH = 112;
export const TIMELINE_PX_PER_FRAME = 6;
export const DEFAULT_FRAME_RATE = 30;
export const MASTER_COMP_ID = "master-composition";
export const MASTER_DEFAULT_WIDTH = 1080;
export const MASTER_DEFAULT_HEIGHT = 1920;
export const SHORTFORM_FRAME_WIDTH = 1080;
export const SHORTFORM_FRAME_HEIGHT = 1920;

export const ANIMATABLE_PROPERTIES: AnimatableProperty[] = [
  "position",
  "scale",
  "rotation",
  "opacity",
];

export const PROPERTY_LABELS: Record<AnimatableProperty, string> = {
  position: "위치",
  scale: "스케일",
  rotation: "회전",
  opacity: "불투명도",
};
