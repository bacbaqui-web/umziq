import { useCallback, useEffect, useEffectEvent, useRef } from "react";
import { getTransformEditMode, type ApplyAnchorCommand } from "@/engines/animation";
import type { Position, PropertyTrackState } from "@/models";
import {
  applyLinkedScaleInput,
  applyPositionInput,
  clampPropertiesNumericValue,
  getPropertiesNumericInputDescriptor,
  hasPropertiesAnchorSemanticChange,
  parsePropertiesNumericDraft,
} from "@/engines/properties/helpers/propertiesNumericHelpers";
import type {
  PropertiesNumericInputId,
  PropertiesResolvedValues,
} from "@/engines/properties/models/propertiesEngineModel";
import type {
  PropertiesAnimationCommandPort,
  PropertiesDraftControllerPort,
  PropertiesTransformDraftCommandPort,
} from "@/engines/properties/models/propertiesInternalModel";

type Options = {
  editableProperties: PropertyTrackState;
  anchorEditable: boolean;
  propertyState: PropertyTrackState;
  scaleLinked: boolean;
  values: PropertiesResolvedValues;
  draft: PropertiesDraftControllerPort;
  animation: PropertiesAnimationCommandPort;
  transformDraft: PropertiesTransformDraftCommandPort;
};

export function usePropertiesNumericInputController(options: Options) {
  const activeInputRef = useRef<PropertiesNumericInputId | null>(null);
  const initialAnchorRef = useRef<Position | null>(null);
  const latestAnchorCommandRef = useRef<ApplyAnchorCommand | null>(null);
  const clearAnchorEditRefs = useCallback(() => {
    initialAnchorRef.current = null;
    latestAnchorCommandRef.current = null;
  }, []);
  const cancelAnchorInputForScopeChange = useEffectEvent(() => {
    const inputId = activeInputRef.current;
    if (!inputId) return;
    if (getPropertiesNumericInputDescriptor(inputId).property !== "anchor") return;
    activeInputRef.current = null;
    clearAnchorEditRefs();
    options.transformDraft.reset();
    options.draft.clearNumericDraft(inputId);
    options.draft.clearNumericFocus();
    options.animation.cancelHistory();
  });
  useEffect(() => {
    cancelAnchorInputForScopeChange();
  }, [options.draft.scope]);
  const clearAnchorInputForExternalReset = useEffectEvent(() => {
    const inputId = activeInputRef.current;
    if (!inputId || options.draft.focusedInputId !== null) return;
    if (getPropertiesNumericInputDescriptor(inputId).property !== "anchor") return;
    activeInputRef.current = null;
    clearAnchorEditRefs();
    options.transformDraft.reset();
  });
  useEffect(() => {
    clearAnchorInputForExternalReset();
  }, [options.draft.focusedInputId]);
  const isEditable = useCallback((inputId: PropertiesNumericInputId) => {
    const { property } = getPropertiesNumericInputDescriptor(inputId);
    return property === "anchor"
      ? options.anchorEditable
      : options.editableProperties[property];
  }, [options.anchorEditable, options.editableProperties]);

  const cancelInput = useCallback((inputId: PropertiesNumericInputId) => {
    if (activeInputRef.current !== inputId) return;
    activeInputRef.current = null;
    if (getPropertiesNumericInputDescriptor(inputId).property === "anchor") {
      clearAnchorEditRefs();
      options.transformDraft.reset();
    }
    options.draft.clearNumericDraft(inputId);
    options.draft.clearNumericFocus();
    options.animation.cancelHistory();
  }, [clearAnchorEditRefs, options.animation, options.draft, options.transformDraft]);

  const commitInput = useCallback((inputId: PropertiesNumericInputId) => {
    if (activeInputRef.current !== inputId) return;
    activeInputRef.current = null;
    const { property, axis } = getPropertiesNumericInputDescriptor(inputId);

    if (options.draft.focusedInputId !== inputId || !options.draft.hasNumericDraft(inputId)) {
      if (property === "anchor") {
        clearAnchorEditRefs();
        options.transformDraft.reset();
      }
      options.draft.clearNumericFocus();
      options.animation.cancelHistory();
      return;
    }

    const rawValue = options.draft.getNumericDraft(inputId) ?? "";
    const parsed = parsePropertiesNumericDraft(rawValue);

    if (parsed.kind !== "number" || !isEditable(inputId)) {
      if (property === "anchor") {
        clearAnchorEditRefs();
        options.transformDraft.reset();
      }
      options.draft.clearNumericDraft(inputId);
      options.draft.clearNumericFocus();
      options.animation.cancelHistory();
      return;
    }

    const value = clampPropertiesNumericValue(property, parsed.value);
    if (property === "anchor") {
      latestAnchorCommandRef.current = axis === "value"
        ? null
        : options.transformDraft.updateAnchor({
          ...options.values.anchor,
          [axis]: parsed.value,
        });
      const command = latestAnchorCommandRef.current;
      const hasSemanticChange = hasPropertiesAnchorSemanticChange(
        initialAnchorRef.current,
        command
      );
      if (!command || !hasSemanticChange) {
        clearAnchorEditRefs();
        options.transformDraft.reset();
        options.draft.clearNumericDraft(inputId);
        options.draft.clearNumericFocus();
        options.animation.cancelHistory();
        return;
      }
      options.animation.applyAnchor(command);
      options.animation.markHistoryDirty();
      clearAnchorEditRefs();
      options.transformDraft.reset();
      options.animation.commitHistory();
      options.draft.clearNumericDraft(inputId);
      options.draft.clearNumericFocus();
      return;
    }
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
  }, [clearAnchorEditRefs, isEditable, options]);

  const focusNumericInput = useCallback((inputId: PropertiesNumericInputId) => {
    if (!isEditable(inputId)) return;
    if (getPropertiesNumericInputDescriptor(inputId).property === "anchor") {
      initialAnchorRef.current = { ...options.values.anchor };
      latestAnchorCommandRef.current = null;
    }
    activeInputRef.current = inputId;
    options.draft.focusNumericDraft(inputId);
    options.animation.beginHistory();
  }, [isEditable, options.animation, options.draft, options.values.anchor]);

  const changeNumericInput = useCallback((inputId: PropertiesNumericInputId, value: string) => {
    if (!isEditable(inputId)) return;
    const parsed = parsePropertiesNumericDraft(value);
    if (parsed.kind === "invalid") return;
    options.draft.setNumericDraft(inputId, value);
    const { property, axis } = getPropertiesNumericInputDescriptor(inputId);
    if (property !== "anchor" || axis === "value" || parsed.kind !== "number") return;
    latestAnchorCommandRef.current = options.transformDraft.updateAnchor({
      ...options.values.anchor,
      [axis]: parsed.value,
    });
  }, [isEditable, options.draft, options.transformDraft, options.values.anchor]);

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
