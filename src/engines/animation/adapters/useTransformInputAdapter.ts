import { useCallback } from "react";
import type { PropertyTrackState, Scale } from "@/models";
import type { AnimationSessionPort } from "@/engines/animation/models/animationCommandModel";
import { getTransformEditMode } from "@/engines/animation/models/animationSessionModel";
import { clampOpacity, normalizeRotationDegrees } from "@/engines/animation/helpers/transformValueHelpers";

type ScaleHandleDirection = "xy" | "x" | "y";

type Options = {
  selectedScaleLinked: boolean;
  selectedPropertyState: PropertyTrackState;
  resolvedScale: Scale;
  session: AnimationSessionPort;
  applyScale: (value: Scale, mode: "static" | "animated") => void;
  applyRotation: (value: number, mode: "static" | "animated") => void;
  applyOpacity: (value: number, mode: "static" | "animated") => void;
};

export function useTransformInputAdapter(options: Options) {
  const applyRotationInputValue = useCallback((value: number) => {
    options.session.setRotationDraft(value);
    options.applyRotation(value, getTransformEditMode(options.selectedPropertyState.rotation));
  }, [options]);

  const commitPreviewScaleInput = useCallback((handle: ScaleHandleDirection, value: number) => {
    const base = options.resolvedScale;
    let next = { ...base };
    if (handle === "xy") next = { x: value, y: value };
    else if (handle === "x") {
      next.x = value;
      if (options.selectedScaleLinked) next.y = base.y * (value / (Math.abs(base.x) < 0.0001 ? 1 : base.x));
    } else {
      next.y = value;
      if (options.selectedScaleLinked) next.x = base.x * (value / (Math.abs(base.y) < 0.0001 ? 1 : base.y));
    }
    options.session.setScaleDraft(next);
    options.applyScale(next, getTransformEditMode(options.selectedPropertyState.scale));
  }, [options]);

  const commitPreviewRotationInput = useCallback((value: number) => {
    const next = normalizeRotationDegrees(value);
    options.session.setRotationDraft(next);
    options.applyRotation(next, getTransformEditMode(options.selectedPropertyState.rotation));
  }, [options]);

  const commitPreviewOpacityInput = useCallback((value: number) => {
    const next = clampOpacity(value);
    options.session.setOpacityDraft(next);
    options.applyOpacity(next, getTransformEditMode(options.selectedPropertyState.opacity));
  }, [options]);

  return { applyRotationInputValue, commitPreviewScaleInput, commitPreviewRotationInput, commitPreviewOpacityInput };
}
