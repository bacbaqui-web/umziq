import type { Dispatch, SetStateAction } from "react";
import type {
  Composition,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
} from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";
import type { TransformTargetSelection } from "@/editor/types/transformActionTypes";
import { useTransformCommitActions } from "@/editor/actions/useTransformCommitActions";
import { useTransformPropertyActions } from "@/editor/actions/useTransformPropertyActions";

type UseTransformActionsOptions = {
  masterCompId: string;
  selectedComp: Composition;
  selectedLayer: Layer | null;
  selectedTimelineComp: Composition | null;
  selectedTransformTarget: TransformTargetSelection;
  selectedScaleTarget: Layer | Composition | null;
  selectedScaleLinked: boolean;
  selectedPropertyState: PropertyTrackState;
  selectedTransformLocalFrame: number;
  playheadFrame: number;
  resolvedPositionDraft: Position;
  resolvedScaleDraft: Scale;
  resolvedRotationDraft: number;
  resolvedOpacityDraft: number;
  selectedKeyframe: SelectedKeyframe;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMasterScale: Dispatch<SetStateAction<Scale>>;
  setMasterScaleKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: Scale }>>>;
  setMasterScaleLinked: Dispatch<SetStateAction<boolean>>;
  setMasterRotation: Dispatch<SetStateAction<number>>;
  setMasterRotationKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setMasterOpacity: Dispatch<SetStateAction<number>>;
  setMasterOpacityKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setMasterEnabledProperties: Dispatch<SetStateAction<PropertyTrackState>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
};

export function useTransformActions({
  masterCompId,
  selectedComp,
  selectedLayer,
  selectedTimelineComp,
  selectedTransformTarget,
  selectedScaleTarget,
  selectedScaleLinked,
  selectedPropertyState,
  selectedTransformLocalFrame,
  playheadFrame,
  resolvedPositionDraft,
  resolvedScaleDraft,
  resolvedRotationDraft,
  resolvedOpacityDraft,
  selectedKeyframe,
  setComps,
  setMasterScale,
  setMasterScaleKeyframes,
  setMasterScaleLinked,
  setMasterRotation,
  setMasterRotationKeyframes,
  setMasterOpacity,
  setMasterOpacityKeyframes,
  setMasterEnabledProperties,
  setSelectedKeyframe,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
}: UseTransformActionsOptions) {
  const transformCommitActions = useTransformCommitActions({
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
  });

  const transformPropertyActions = useTransformPropertyActions({
    masterCompId,
    selectedComp,
    selectedLayer,
    selectedTimelineComp,
    selectedScaleTarget,
    selectedKeyframe,
    selectedTransformLocalFrame,
    playheadFrame,
    resolvedPositionDraft,
    resolvedScaleDraft,
    resolvedRotationDraft,
    resolvedOpacityDraft,
    setComps,
    setMasterScaleKeyframes,
    setMasterScaleLinked,
    setMasterRotationKeyframes,
    setMasterOpacityKeyframes,
    setMasterEnabledProperties,
    setSelectedKeyframe,
    setScaleDraft,
    setRotationDraft,
    setOpacityDraft,
  });

  return {
    ...transformCommitActions,
    ...transformPropertyActions,
  };
}
