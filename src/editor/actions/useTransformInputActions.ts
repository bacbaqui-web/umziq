import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { PropertyTrackState, Scale } from "@/editor/types/types";
import type { ScaleHandleDirection } from "@/editor/types/editorViewTypes";
import { normalizeDegrees } from "@/editor/preview/previewCoordinateMath";
import { getTransformEditMode, type TransformEditMode } from "@/editor/types/transformActionTypes";

type UseTransformInputActionsOptions = {
  selectedScaleLinked: boolean;
  selectedPropertyState: PropertyTrackState;
  resolvedScaleDraft: Scale;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  applyScaleValue: (nextScale: Scale, editMode: TransformEditMode) => void;
  applyRotationValue: (nextRotation: number, editMode: TransformEditMode) => void;
  applyOpacityValue: (nextOpacity: number, editMode: TransformEditMode) => void;
};

export function useTransformInputActions({
  selectedScaleLinked,
  selectedPropertyState,
  resolvedScaleDraft,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
  applyScaleValue,
  applyRotationValue,
  applyOpacityValue,
}: UseTransformInputActionsOptions) {
  const applyRotationInputValue = useCallback(
    (nextRotation: number) => {
      setRotationDraft(nextRotation);
      applyRotationValue(nextRotation, getTransformEditMode(selectedPropertyState.rotation));
    },
    [applyRotationValue, selectedPropertyState.rotation, setRotationDraft]
  );

  const commitPreviewScaleInput = useCallback(
    (handle: ScaleHandleDirection, value: number) => {
      const baseScale = resolvedScaleDraft;
      let nextScale = { ...baseScale };

      if (handle === "xy") {
        nextScale = { x: value, y: value };
      } else if (handle === "x") {
        nextScale.x = value;

        if (selectedScaleLinked) {
          const currentAxisValue = Math.abs(baseScale.x) < 0.0001 ? 1 : baseScale.x;
          const factor = value / currentAxisValue;
          nextScale.y = baseScale.y * factor;
        }
      } else {
        nextScale.y = value;

        if (selectedScaleLinked) {
          const currentAxisValue = Math.abs(baseScale.y) < 0.0001 ? 1 : baseScale.y;
          const factor = value / currentAxisValue;
          nextScale.x = baseScale.x * factor;
        }
      }

      setScaleDraft(nextScale);
      applyScaleValue(nextScale, getTransformEditMode(selectedPropertyState.scale));
    },
    [
      applyScaleValue,
      resolvedScaleDraft,
      selectedPropertyState.scale,
      selectedScaleLinked,
      setScaleDraft,
    ]
  );

  const commitPreviewRotationInput = useCallback(
    (value: number) => {
      const nextRotation = normalizeDegrees(value);
      setRotationDraft(nextRotation);
      applyRotationValue(nextRotation, getTransformEditMode(selectedPropertyState.rotation));
    },
    [applyRotationValue, selectedPropertyState.rotation, setRotationDraft]
  );

  const commitPreviewOpacityInput = useCallback(
    (value: number) => {
      const nextOpacity = Math.min(100, Math.max(0, value));
      setOpacityDraft(nextOpacity);
      applyOpacityValue(nextOpacity, getTransformEditMode(selectedPropertyState.opacity));
    },
    [applyOpacityValue, selectedPropertyState.opacity, setOpacityDraft]
  );

  return {
    applyRotationInputValue,
    commitPreviewScaleInput,
    commitPreviewRotationInput,
    commitPreviewOpacityInput,
  };
}
