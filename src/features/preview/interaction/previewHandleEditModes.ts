import { getTransformEditMode } from "@/editor/types/transformActionTypes";
import type { PropertyTrackState } from "@/editor/types/types";

export function getPreviewHandleEditModes(selectedPropertyState: PropertyTrackState) {
  return {
    position: getTransformEditMode(selectedPropertyState.position),
    scale: getTransformEditMode(selectedPropertyState.scale),
    rotation: getTransformEditMode(selectedPropertyState.rotation),
    opacity: getTransformEditMode(selectedPropertyState.opacity),
  };
}
