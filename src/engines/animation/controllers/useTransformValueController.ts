import { useCallback } from "react";
import type { Position, Scale } from "@/models";
import type {
  AnimationProjectPort,
  AnimationSessionPort,
  ApplyAnchorCommand,
  MasterAnimationPort,
} from "@/engines/animation/models/animationCommandModel";
import type {
  TransformEditMode,
  TransformTargetSelection,
} from "@/engines/animation/models/animationSessionModel";
import { isAnimatedTransformEdit } from "@/engines/animation/models/animationSessionModel";
import { createSelectedKeyframeForTarget } from "@/engines/animation/helpers/animationSelectionHelpers";
import { clampOpacity } from "@/engines/animation/helpers/transformValueHelpers";
import { upsertKeyframeValue } from "@/engines/animation/helpers/keyframeTrackHelpers";
import {
  applyAnchorToCompositions,
  applyOpacityToCompositions,
  applyPositionToCompositions,
  applyRotationToCompositions,
  applyScaleToCompositions,
} from "@/engines/animation/actions/animationProjectMutations";

type Options = {
  masterCompId: string;
  selectedTarget: TransformTargetSelection;
  localFrame: number;
  playheadFrame: number;
  project: AnimationProjectPort;
  master: MasterAnimationPort;
  session: AnimationSessionPort;
};

export function useTransformValueController({
  masterCompId,
  selectedTarget,
  localFrame,
  playheadFrame,
  project,
  master,
  session,
}: Options) {
  const applyScale = useCallback((value: Scale, mode: TransformEditMode) => {
    if (!selectedTarget) return;
    const animated = isAnimatedTransformEdit(mode);

    if (selectedTarget.kind === "composition" && selectedTarget.composition.id === masterCompId) {
      master.setScale(value);
      if (animated) {
        master.setScaleKeyframes((current) => upsertKeyframeValue(current, localFrame, value));
      }
    } else {
      project.updateCompositions((current) =>
        applyScaleToCompositions(
          current,
          { kind: selectedTarget.kind, id: selectedTarget.kind === "layer" ? selectedTarget.layer.id : selectedTarget.composition.id },
          value,
          localFrame,
          animated
        )
      );
    }

    if (animated) session.setSelectedKeyframe(createSelectedKeyframeForTarget(selectedTarget, "scale", localFrame));
  }, [localFrame, master, masterCompId, project, selectedTarget, session]);

  const applyRotation = useCallback((value: number, mode: TransformEditMode) => {
    if (!selectedTarget) return;
    const animated = isAnimatedTransformEdit(mode);

    if (selectedTarget.kind === "composition" && selectedTarget.composition.id === masterCompId) {
      master.setRotation(value);
      if (animated) {
        master.setRotationKeyframes((current) => upsertKeyframeValue(current, localFrame, value));
      }
    } else {
      project.updateCompositions((current) =>
        applyRotationToCompositions(
          current,
          { kind: selectedTarget.kind, id: selectedTarget.kind === "layer" ? selectedTarget.layer.id : selectedTarget.composition.id },
          value,
          localFrame,
          animated
        )
      );
    }

    if (animated) session.setSelectedKeyframe(createSelectedKeyframeForTarget(selectedTarget, "rotation", localFrame));
  }, [localFrame, master, masterCompId, project, selectedTarget, session]);

  const applyPosition = useCallback((value: Position, mode: TransformEditMode) => {
    if (!selectedTarget) return;
    const animated = isAnimatedTransformEdit(mode);

    if (!(selectedTarget.kind === "composition" && selectedTarget.composition.id === masterCompId)) {
      const frame = animated || selectedTarget.kind === "composition" ? localFrame : playheadFrame;
      project.updateCompositions((current) =>
        applyPositionToCompositions(
          current,
          { kind: selectedTarget.kind, id: selectedTarget.kind === "layer" ? selectedTarget.layer.id : selectedTarget.composition.id },
          value,
          frame,
          animated
        )
      );
    }

    if (animated) session.setSelectedKeyframe(createSelectedKeyframeForTarget(selectedTarget, "position", localFrame));
  }, [localFrame, masterCompId, playheadFrame, project, selectedTarget, session]);

  const applyOpacity = useCallback((nextValue: number, mode: TransformEditMode) => {
    if (!selectedTarget) return;
    const value = clampOpacity(nextValue);
    const animated = isAnimatedTransformEdit(mode);

    if (selectedTarget.kind === "composition" && selectedTarget.composition.id === masterCompId) {
      master.setOpacity(value);
      if (animated) {
        master.setOpacityKeyframes((current) => upsertKeyframeValue(current, localFrame, value));
      }
    } else {
      const frame = animated || selectedTarget.kind === "composition" ? localFrame : playheadFrame;
      project.updateCompositions((current) =>
        applyOpacityToCompositions(
          current,
          { kind: selectedTarget.kind, id: selectedTarget.kind === "layer" ? selectedTarget.layer.id : selectedTarget.composition.id },
          value,
          frame,
          animated
        )
      );
    }

    if (animated) session.setSelectedKeyframe(createSelectedKeyframeForTarget(selectedTarget, "opacity", localFrame));
  }, [localFrame, master, masterCompId, playheadFrame, project, selectedTarget, session]);

  const applyAnchor = useCallback((command: ApplyAnchorCommand) => {
    if (command.target.kind === "composition" && command.target.id === masterCompId) return;
    project.updateCompositions((current) =>
      applyAnchorToCompositions(current, command.target, command.anchor, command.transformOffset)
    );
  }, [masterCompId, project]);

  return { applyPosition, applyScale, applyRotation, applyOpacity, applyAnchor };
}
