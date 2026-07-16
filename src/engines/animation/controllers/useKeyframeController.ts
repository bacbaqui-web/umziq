import { useCallback } from "react";
import type { AnimatableProperty, Layer, Position, Scale } from "@/models";
import type {
  AnimationHistoryPort,
  AnimationProjectPort,
  AnimationSessionPort,
  AnimationTargetDescriptor,
  MasterAnimationPort,
} from "@/engines/animation/models/animationCommandModel";
import type { SelectedKeyframe } from "@/engines/animation/models/animationSessionModel";
import { createSelectedPropertyKeyframe } from "@/engines/animation/helpers/animationSelectionHelpers";
import {
  moveKeyframeValue,
  removeKeyframeValue,
  upsertKeyframeValue,
} from "@/engines/animation/helpers/keyframeTrackHelpers";
import {
  applyOpacityToCompositions,
  applyPositionToCompositions,
  applyRotationToCompositions,
  applyScaleToCompositions,
  movePropertyKeyframeInCompositions,
  removePropertyKeyframeFromCompositions,
} from "@/engines/animation/actions/animationProjectMutations";

type Options = {
  masterCompId: string;
  selectedLayer: Layer | null;
  selectedKeyframe: SelectedKeyframe;
  localFrame: number;
  resolvedPosition: Position;
  project: AnimationProjectPort;
  master: MasterAnimationPort;
  session: AnimationSessionPort;
  history: AnimationHistoryPort;
};

type UpsertCommand = {
  target: AnimationTargetDescriptor;
  property: AnimatableProperty;
  frame: number;
  value: Position | Scale | number;
};

export function useKeyframeController(options: Options) {
  const selectPropertyKeyframe = useCallback((target: AnimationTargetDescriptor, property: AnimatableProperty, frame: number) => {
    options.session.setSelectedKeyframe(createSelectedPropertyKeyframe(target.kind, target.id, property, frame));
  }, [options.session]);

  const upsertPropertyKeyframe = useCallback((command: UpsertCommand) => {
    if (command.target.kind === "composition" && command.target.id === options.masterCompId) {
      if (command.property === "scale") {
        const value = command.value as Scale;
        options.master.setScale(value);
        options.master.setScaleKeyframes((current) => upsertKeyframeValue(current, command.frame, value));
      } else if (command.property === "rotation") {
        const value = command.value as number;
        options.master.setRotation(value);
        options.master.setRotationKeyframes((current) => upsertKeyframeValue(current, command.frame, value));
      } else if (command.property === "opacity") {
        const value = command.value as number;
        options.master.setOpacity(value);
        options.master.setOpacityKeyframes((current) => upsertKeyframeValue(current, command.frame, value));
      }
    } else {
      options.project.updateCompositions((current) => {
        if (command.property === "position") return applyPositionToCompositions(current, command.target, command.value as Position, command.frame, true);
        if (command.property === "scale") return applyScaleToCompositions(current, command.target, command.value as Scale, command.frame, true);
        if (command.property === "rotation") return applyRotationToCompositions(current, command.target, command.value as number, command.frame, true);
        return applyOpacityToCompositions(current, command.target, command.value as number, command.frame, true);
      });
    }
    selectPropertyKeyframe(command.target, command.property, command.frame);
  }, [options, selectPropertyKeyframe]);

  const movePropertyKeyframe = useCallback((target: AnimationTargetDescriptor, property: AnimatableProperty, fromFrame: number, toFrame: number) => {
    if (target.kind === "composition" && target.id === options.masterCompId) {
      if (property === "scale") options.master.setScaleKeyframes((current) => moveKeyframeValue(current, fromFrame, toFrame));
      else if (property === "rotation") options.master.setRotationKeyframes((current) => moveKeyframeValue(current, fromFrame, toFrame));
      else if (property === "opacity") options.master.setOpacityKeyframes((current) => moveKeyframeValue(current, fromFrame, toFrame));
      return;
    }
    options.project.updateCompositions((current) =>
      movePropertyKeyframeInCompositions(current, { target, property, frame: fromFrame, toFrame })
    );
  }, [options]);

  const removePropertyKeyframe = useCallback((target: AnimationTargetDescriptor, property: AnimatableProperty, frame: number) => {
    if (target.kind === "composition" && target.id === options.masterCompId) {
      if (property === "scale") options.master.setScaleKeyframes((current) => removeKeyframeValue(current, frame));
      else if (property === "rotation") options.master.setRotationKeyframes((current) => removeKeyframeValue(current, frame));
      else if (property === "opacity") options.master.setOpacityKeyframes((current) => removeKeyframeValue(current, frame));
      return;
    }
    options.project.updateCompositions((current) =>
      removePropertyKeyframeFromCompositions(current, { target, property, frame })
    );
  }, [options]);

  const removeSelectedKeyframe = useCallback(() => {
    const selected = options.selectedKeyframe;
    if (!selected) return;
    options.history.push();
    removePropertyKeyframe({ kind: selected.targetKind, id: selected.targetId }, selected.property, selected.frame);
    options.session.setSelectedKeyframe(null);
    options.session.setScaleDraft(null);
    options.session.setRotationDraft(null);
    options.session.setOpacityDraft(null);
  }, [options, removePropertyKeyframe]);

  const savePositionKeyframe = useCallback(() => {
    if (!options.selectedLayer) return;
    options.history.push();
    upsertPropertyKeyframe({
      target: { kind: "layer", id: options.selectedLayer.id },
      property: "position",
      frame: options.localFrame,
      value: options.resolvedPosition,
    });
  }, [options, upsertPropertyKeyframe]);

  return {
    upsertPropertyKeyframe,
    selectPropertyKeyframe,
    movePropertyKeyframe,
    removePropertyKeyframe,
    removeSelectedKeyframe,
    savePositionKeyframe,
    handleSavePositionKeyframe: savePositionKeyframe,
    handleDeleteSelectedKeyframe: removeSelectedKeyframe,
  };
}
