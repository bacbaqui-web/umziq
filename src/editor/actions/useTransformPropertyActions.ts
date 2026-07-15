import type { Dispatch, SetStateAction } from "react";
import type {
  Composition,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
} from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";
import { useTransformPropertyKeyframeActions } from "@/editor/actions/useTransformPropertyKeyframeActions";
import { useTransformPropertyToggleActions } from "@/editor/actions/useTransformPropertyToggleActions";

type UseTransformPropertyActionsOptions = {
  masterCompId: string;
  selectedComp: Composition;
  selectedLayer: Layer | null;
  selectedTimelineComp: Composition | null;
  selectedScaleTarget: Layer | Composition | null;
  selectedKeyframe: SelectedKeyframe;
  selectedTransformLocalFrame: number;
  playheadFrame: number;
  resolvedPositionDraft: Position;
  resolvedScaleDraft: Scale;
  resolvedRotationDraft: number;
  resolvedOpacityDraft: number;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMasterScaleKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: Scale }>>>;
  setMasterScaleLinked: Dispatch<SetStateAction<boolean>>;
  setMasterRotationKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setMasterOpacityKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setMasterEnabledProperties: Dispatch<SetStateAction<PropertyTrackState>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
};

export function useTransformPropertyActions({
  masterCompId,
  selectedComp,
  selectedLayer,
  selectedTimelineComp,
  selectedScaleTarget,
  selectedKeyframe,
  selectedTransformLocalFrame,
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
}: UseTransformPropertyActionsOptions) {
  const toggleActions = useTransformPropertyToggleActions({
    masterCompId,
    selectedComp,
    selectedLayer,
    selectedTimelineComp,
    selectedScaleTarget,
    selectedKeyframe,
    selectedTransformLocalFrame,
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
  });

  const keyframeActions = useTransformPropertyKeyframeActions({
    masterCompId,
    selectedLayer,
    selectedKeyframe,
    selectedTransformLocalFrame,
    resolvedPositionDraft,
    setComps,
    setMasterScaleKeyframes,
    setMasterRotationKeyframes,
    setMasterOpacityKeyframes,
    setSelectedKeyframe,
    setScaleDraft,
    setRotationDraft,
    setOpacityDraft,
  });

  return {
    ...toggleActions,
    ...keyframeActions,
  };
}
