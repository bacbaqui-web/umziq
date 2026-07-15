import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Composition, Position, Scale } from "@/editor/types/types";
import {
  isAnimatedTransformEdit,
  type TransformEditMode,
  type TransformTargetSelection,
} from "@/editor/types/transformActionTypes";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";
import { useAnimatedTransformValueActions } from "@/editor/actions/useAnimatedTransformValueActions";
import { useStaticTransformValueActions } from "@/editor/actions/useStaticTransformValueActions";

type UseTransformValueActionsOptions = {
  masterCompId: string;
  selectedTransformTarget: TransformTargetSelection;
  selectedTransformLocalFrame: number;
  playheadFrame: number;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMasterScale: Dispatch<SetStateAction<Scale>>;
  setMasterScaleKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: Scale }>>>;
  setMasterRotation: Dispatch<SetStateAction<number>>;
  setMasterRotationKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setMasterOpacity: Dispatch<SetStateAction<number>>;
  setMasterOpacityKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
};

export function useTransformValueActions({
  masterCompId,
  selectedTransformTarget,
  selectedTransformLocalFrame,
  playheadFrame,
  setComps,
  setMasterScale,
  setMasterScaleKeyframes,
  setMasterRotation,
  setMasterRotationKeyframes,
  setMasterOpacity,
  setMasterOpacityKeyframes,
  setSelectedKeyframe,
}: UseTransformValueActionsOptions) {
  const staticActions = useStaticTransformValueActions({
    masterCompId,
    selectedTransformTarget,
    selectedTransformLocalFrame,
    playheadFrame,
    setComps,
    setMasterScale,
    setMasterRotation,
    setMasterOpacity,
  });

  const animatedActions = useAnimatedTransformValueActions({
    masterCompId,
    selectedTransformTarget,
    selectedTransformLocalFrame,
    setComps,
    setMasterScale,
    setMasterScaleKeyframes,
    setMasterRotation,
    setMasterRotationKeyframes,
    setMasterOpacity,
    setMasterOpacityKeyframes,
    setSelectedKeyframe,
  });

  const applyScaleValue = useCallback(
    (nextScale: Scale, editMode: TransformEditMode) => {
      if (isAnimatedTransformEdit(editMode)) {
        animatedActions.applyScaleAnimatedValue(nextScale);
        return;
      }

      staticActions.applyScaleStaticValue(nextScale);
    },
    [animatedActions, staticActions]
  );

  const applyRotationValue = useCallback(
    (nextRotation: number, editMode: TransformEditMode) => {
      if (isAnimatedTransformEdit(editMode)) {
        animatedActions.applyRotationAnimatedValue(nextRotation);
        return;
      }

      staticActions.applyRotationStaticValue(nextRotation);
    },
    [animatedActions, staticActions]
  );

  const applyPositionValue = useCallback(
    (nextPosition: Position, editMode: TransformEditMode) => {
      if (isAnimatedTransformEdit(editMode)) {
        animatedActions.applyPositionAnimatedValue(nextPosition);
        return;
      }

      staticActions.applyPositionStaticValue(nextPosition);
    },
    [animatedActions, staticActions]
  );

  const applyOpacityValue = useCallback(
    (nextOpacity: number, editMode: TransformEditMode) => {
      if (isAnimatedTransformEdit(editMode)) {
        animatedActions.applyOpacityAnimatedValue(nextOpacity);
        return;
      }

      staticActions.applyOpacityStaticValue(nextOpacity);
    },
    [animatedActions, staticActions]
  );

  return {
    applyScaleValue,
    applyRotationValue,
    applyPositionValue,
    applyOpacityValue,
  };
}
