import { useCallback, useRef } from "react";
import { getTransformEditMode } from "@/engines/animation";
import type { PropertyTrackState } from "@/models";
import {
  applyLinkedScaleInput,
  applyPositionInput,
  clampPropertiesNumericValue,
  getPropertiesNumericInputDescriptor,
  parsePropertiesNumericDraft,
} from "@/engines/properties/helpers/propertiesNumericHelpers";
import type {
  PropertiesNumericInputId,
  PropertiesResolvedValues,
} from "@/engines/properties/models/propertiesEngineModel";
import type {
  PropertiesAnimationCommandPort,
  PropertiesDraftControllerPort,
} from "@/engines/properties/models/propertiesInternalModel";

type Options = {
  editableProperties: PropertyTrackState;
  propertyState: PropertyTrackState;
  scaleLinked: boolean;
  values: PropertiesResolvedValues;
  draft: PropertiesDraftControllerPort;
  animation: PropertiesAnimationCommandPort;
};

export function usePropertiesNumericInputController(options: Options) {
  const activeInputRef = useRef<PropertiesNumericInputId | null>(null);

  const cancelInput = useCallback((inputId: PropertiesNumericInputId) => {
    if (activeInputRef.current !== inputId) return;
    activeInputRef.current = null;
    options.draft.clearNumericDraft(inputId);
    options.draft.clearNumericFocus();
    options.animation.cancelHistory();
  }, [options.animation, options.draft]);

  const commitInput = useCallback((inputId: PropertiesNumericInputId) => {
    if (activeInputRef.current !== inputId) return;
    activeInputRef.current = null;

    if (options.draft.focusedInputId !== inputId || !options.draft.hasNumericDraft(inputId)) {
      options.draft.clearNumericFocus();
      options.animation.cancelHistory();
      return;
    }

    const rawValue = options.draft.getNumericDraft(inputId) ?? "";
    const parsed = parsePropertiesNumericDraft(rawValue);
    const { property, axis } = getPropertiesNumericInputDescriptor(inputId);

    if (parsed.kind !== "number" || !options.editableProperties[property]) {
      options.draft.clearNumericDraft(inputId);
      options.draft.clearNumericFocus();
      options.animation.cancelHistory();
      return;
    }

    const value = clampPropertiesNumericValue(property, parsed.value);
    const mode = getTransformEditMode(options.propertyState[property]);

    if (property === "position" && axis !== "value") {
      const next = applyPositionInput(options.values.position, axis, value);
      options.draft.setPositionDraft(next);
      options.animation.applyPosition(next, mode);
    } else if (property === "scale" && axis !== "value") {
      const next = applyLinkedScaleInput(options.values.scale, axis, value, options.scaleLinked);
      options.draft.setScaleDraft(next);
      options.animation.applyScale(next, mode);
    } else if (property === "rotation") {
      options.draft.setRotationDraft(value);
      options.animation.applyRotation(value, mode);
    } else if (property === "opacity") {
      options.draft.setOpacityDraft(value);
      options.animation.applyOpacity(value, mode);
    }

    options.animation.markHistoryDirty();
    options.animation.commitHistory();
    options.draft.clearNumericDraft(inputId);
    options.draft.clearNumericFocus();
  }, [options]);

  const focusNumericInput = useCallback((inputId: PropertiesNumericInputId) => {
    const { property } = getPropertiesNumericInputDescriptor(inputId);
    if (!options.editableProperties[property]) return;
    activeInputRef.current = inputId;
    options.draft.focusNumericDraft(inputId);
    options.animation.beginHistory();
  }, [options.animation, options.draft, options.editableProperties]);

  const changeNumericInput = useCallback((inputId: PropertiesNumericInputId, value: string) => {
    const { property } = getPropertiesNumericInputDescriptor(inputId);
    if (!options.editableProperties[property]) return;
    if (parsePropertiesNumericDraft(value).kind === "invalid") return;
    options.draft.setNumericDraft(inputId, value);
  }, [options.draft, options.editableProperties]);

  const blurNumericInput = useCallback((inputId: PropertiesNumericInputId) => {
    commitInput(inputId);
  }, [commitInput]);

  const keyDownNumericInput = useCallback((inputId: PropertiesNumericInputId, key: string) => {
    if (key === "Enter") {
      commitInput(inputId);
      return "blur" as const;
    }
    if (key === "Escape") {
      cancelInput(inputId);
      return "blur" as const;
    }
    return null;
  }, [cancelInput, commitInput]);

  return {
    focusNumericInput,
    changeNumericInput,
    blurNumericInput,
    keyDownNumericInput,
  };
}
