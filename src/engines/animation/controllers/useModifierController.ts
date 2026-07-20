import { useCallback } from "react";
import type { ModifierInstance, ModifierNumberField, ModifierType } from "@/models";
import type {
  AnimationHistoryPort,
  AnimationProjectPort,
  AnimationTargetDescriptor,
} from "@/engines/animation/models/animationCommandModel";
import type { TransformTargetSelection } from "@/engines/animation/models/animationSessionModel";
import {
  addModifierToCompositions,
  removeModifierFromCompositions,
  updateModifierNumberInCompositions,
} from "@/engines/animation/actions/animationProjectMutations";
import { findModifier } from "@/engines/animation/modifiers/modifierRegistry";

type Options = {
  masterCompId: string;
  selectedTarget: TransformTargetSelection;
  project: AnimationProjectPort;
  history: AnimationHistoryPort;
};

function getEditableTarget(
  selectedTarget: TransformTargetSelection,
  masterCompId: string
): {
  descriptor: AnimationTargetDescriptor;
  modifiers: readonly ModifierInstance[] | undefined;
} | null {
  if (!selectedTarget) return null;
  if (selectedTarget.kind === "composition" && selectedTarget.composition.id === masterCompId) {
    return null;
  }

  const target = selectedTarget.kind === "layer"
    ? selectedTarget.layer
    : selectedTarget.composition;
  return {
    descriptor: { kind: selectedTarget.kind, id: target.id },
    modifiers: target.modifiers,
  };
}

export function useModifierController(options: Options) {
  const addModifier = useCallback((type: ModifierType) => {
    const target = getEditableTarget(options.selectedTarget, options.masterCompId);
    if (!target || findModifier(target.modifiers, type)) return;
    options.history.push();
    options.project.updateCompositions((current) =>
      addModifierToCompositions(current, target.descriptor, type)
    );
  }, [options]);

  const removeModifier = useCallback((type: ModifierType) => {
    const target = getEditableTarget(options.selectedTarget, options.masterCompId);
    if (!target || !findModifier(target.modifiers, type)) return;
    options.history.push();
    options.project.updateCompositions((current) =>
      removeModifierFromCompositions(current, target.descriptor, type)
    );
  }, [options]);

  const toggleModifier = useCallback((type: ModifierType) => {
    const target = getEditableTarget(options.selectedTarget, options.masterCompId);
    if (!target) return;
    if (findModifier(target.modifiers, type)) removeModifier(type);
    else addModifier(type);
  }, [addModifier, options.masterCompId, options.selectedTarget, removeModifier]);

  const updateModifierNumber = useCallback((
    type: ModifierType,
    field: ModifierNumberField,
    value: number
  ) => {
    const target = getEditableTarget(options.selectedTarget, options.masterCompId);
    if (!target || !findModifier(target.modifiers, type)) return;
    options.project.updateCompositions((current) =>
      updateModifierNumberInCompositions(
        current,
        target.descriptor,
        type,
        field,
        value
      )
    );
  }, [options]);

  return { addModifier, removeModifier, toggleModifier, updateModifierNumber };
}
