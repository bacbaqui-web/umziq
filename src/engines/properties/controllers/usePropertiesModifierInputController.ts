import { useCallback, useRef } from "react";
import type { TransformTargetSelection } from "@/engines/animation";
import {
  findModifier,
  normalizeModifierInstances,
  normalizeModifierNumber,
} from "@/engines/animation";
import { parsePropertiesNumericDraft } from "@/engines/properties/helpers/propertiesNumericHelpers";
import { getModifierInputDescriptor } from "@/engines/properties/helpers/propertiesModifierHelpers";
import type { PropertiesModifierInputId } from "@/engines/properties/models/propertiesEngineModel";
import type {
  PropertiesAnimationCommandPort,
  PropertiesDraftControllerPort,
} from "@/engines/properties/models/propertiesInternalModel";

type Options = {
  target: TransformTargetSelection;
  masterCompId: string;
  draft: PropertiesDraftControllerPort;
  animation: PropertiesAnimationCommandPort;
};

export function usePropertiesModifierInputController(options: Options) {
  const activeInputRef = useRef<PropertiesModifierInputId | null>(null);

  const currentModifier = useCallback((inputId: PropertiesModifierInputId) => {
    if (!options.target) return null;
    if (
      options.target.kind === "composition"
      && options.target.composition.id === options.masterCompId
    ) return null;
    const target = options.target.kind === "layer"
      ? options.target.layer
      : options.target.composition;
    const { type } = getModifierInputDescriptor(inputId);
    return findModifier(normalizeModifierInstances(target.modifiers, target.id), type);
  }, [options.masterCompId, options.target]);

  const clearInput = useCallback((inputId: PropertiesModifierInputId) => {
    activeInputRef.current = null;
    options.draft.clearNumericDraft(inputId);
    options.draft.clearNumericFocus();
  }, [options.draft]);

  const cancelInput = useCallback((inputId: PropertiesModifierInputId) => {
    if (activeInputRef.current !== inputId) return;
    clearInput(inputId);
    options.animation.cancelHistory();
  }, [clearInput, options.animation]);

  const commitInput = useCallback((inputId: PropertiesModifierInputId) => {
    if (activeInputRef.current !== inputId) return;
    const modifier = currentModifier(inputId);
    const rawValue = options.draft.getNumericDraft(inputId);
    const parsed = rawValue === undefined
      ? { kind: "invalid" as const }
      : parsePropertiesNumericDraft(rawValue);
    const { type, field } = getModifierInputDescriptor(inputId);

    if (!modifier || parsed.kind !== "number") {
      clearInput(inputId);
      options.animation.cancelHistory();
      return;
    }

    const value = normalizeModifierNumber(parsed.value);
    const currentValue = field === "frequency"
      ? modifier.frequency
      : modifier.amount;
    if (Object.is(currentValue, value)) {
      clearInput(inputId);
      options.animation.cancelHistory();
      return;
    }

    options.animation.updateModifierNumber(type, field, value);
    options.animation.markHistoryDirty();
    options.animation.commitHistory();
    clearInput(inputId);
  }, [clearInput, currentModifier, options.animation, options.draft]);

  const focusModifierInput = useCallback((inputId: PropertiesModifierInputId) => {
    if (!currentModifier(inputId)) return;
    activeInputRef.current = inputId;
    options.draft.focusNumericDraft(inputId);
    options.animation.beginHistory();
  }, [currentModifier, options.animation, options.draft]);

  const changeModifierInput = useCallback((
    inputId: PropertiesModifierInputId,
    value: string
  ) => {
    if (!currentModifier(inputId)) return;
    if (parsePropertiesNumericDraft(value).kind === "invalid") return;
    options.draft.setNumericDraft(inputId, value);
  }, [currentModifier, options.draft]);

  const blurModifierInput = useCallback((inputId: PropertiesModifierInputId) => {
    commitInput(inputId);
  }, [commitInput]);

  const keyDownModifierInput = useCallback((
    inputId: PropertiesModifierInputId,
    key: string
  ) => {
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
    focusModifierInput,
    changeModifierInput,
    blurModifierInput,
    keyDownModifierInput,
  };
}
