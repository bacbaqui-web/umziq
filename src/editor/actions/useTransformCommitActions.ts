import type { Dispatch, SetStateAction } from "react";
import type { Composition, PropertyTrackState, Scale } from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";
import type { TransformTargetSelection } from "@/editor/types/transformActionTypes";
import { useTransformInputActions } from "@/editor/actions/useTransformInputActions";
import { useTransformValueActions } from "@/editor/actions/useTransformValueActions";

type UseTransformCommitActionsOptions = {
  masterCompId: string;
  selectedTransformTarget: TransformTargetSelection;
  selectedScaleLinked: boolean;
  selectedPropertyState: PropertyTrackState;
  selectedTransformLocalFrame: number;
  playheadFrame: number;
  resolvedScaleDraft: Scale;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMasterScale: Dispatch<SetStateAction<Scale>>;
  setMasterScaleKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: Scale }>>>;
  setMasterRotation: Dispatch<SetStateAction<number>>;
  setMasterRotationKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setMasterOpacity: Dispatch<SetStateAction<number>>;
  setMasterOpacityKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
};

export function useTransformCommitActions({
  masterCompId,
  selectedTransformTarget,
  selectedScaleLinked,
  selectedPropertyState,
  selectedTransformLocalFrame,
  playheadFrame,
  resolvedScaleDraft,
  setComps,
  setMasterScale,
  setMasterScaleKeyframes,
  setMasterRotation,
  setMasterRotationKeyframes,
  setMasterOpacity,
  setMasterOpacityKeyframes,
  setSelectedKeyframe,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
}: UseTransformCommitActionsOptions) {
  const {
    applyScaleValue,
    applyRotationValue,
    applyPositionValue,
    applyOpacityValue,
  } = useTransformValueActions({
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
  });

  const {
    applyRotationInputValue,
    commitPreviewScaleInput,
    commitPreviewRotationInput,
    commitPreviewOpacityInput,
  } = useTransformInputActions({
    selectedScaleLinked,
    selectedPropertyState,
    resolvedScaleDraft,
    setScaleDraft,
    setRotationDraft,
    setOpacityDraft,
    applyScaleValue,
    applyRotationValue,
    applyOpacityValue,
  });

  return {
    applyScaleValue,
    applyRotationValue,
    applyPositionValue,
    applyOpacityValue,
    applyRotationInputValue,
    commitPreviewScaleInput,
    commitPreviewRotationInput,
    commitPreviewOpacityInput,
  };
}
