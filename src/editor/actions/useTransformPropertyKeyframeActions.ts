import { useCallback, type Dispatch, type SetStateAction } from "react";
import type {
  Composition,
  Layer,
  Position,
  Scale,
} from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";
import {
  removeSelectedKeyframeFromComps,
  upsertPositionKeyframe,
} from "@/editor/actions/keyframeActions";
import {
  clearTransformDraftState,
  createSelectedPropertyKeyframe,
} from "@/editor/actions/transformPropertyActionHelpers";
import { updateLayerRecursively } from "@/editor/actions/editorActions";

type UseTransformPropertyKeyframeActionsOptions = {
  masterCompId: string;
  selectedLayer: Layer | null;
  selectedKeyframe: SelectedKeyframe;
  selectedTransformLocalFrame: number;
  resolvedPositionDraft: Position;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMasterScaleKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: Scale }>>>;
  setMasterRotationKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setMasterOpacityKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
};

export function useTransformPropertyKeyframeActions({
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
}: UseTransformPropertyKeyframeActionsOptions) {
  const handleSavePositionKeyframe = useCallback(() => {
    if (!selectedLayer) {
      return;
    }

    setComps((prev) =>
      prev.map((comp) =>
        updateLayerRecursively(comp, selectedLayer.id, (layer) => ({
          ...layer,
          position: resolvedPositionDraft,
          positionKeyframes: upsertPositionKeyframe(
            layer.positionKeyframes,
            selectedTransformLocalFrame,
            resolvedPositionDraft
          ),
        }))
      )
    );
    setSelectedKeyframe(
      createSelectedPropertyKeyframe(
        "layer",
        selectedLayer.id,
        "position",
        selectedTransformLocalFrame
      )
    );
  }, [
    resolvedPositionDraft,
    selectedLayer,
    selectedTransformLocalFrame,
    setComps,
    setSelectedKeyframe,
  ]);

  const handleDeleteSelectedKeyframe = useCallback(() => {
    if (!selectedKeyframe) {
      return;
    }

    if (selectedKeyframe.targetKind === "layer") {
      setComps((prev) => removeSelectedKeyframeFromComps(prev, selectedKeyframe));
    } else if (selectedKeyframe.targetId === masterCompId) {
      if (selectedKeyframe.property === "rotation") {
        setMasterRotationKeyframes((prev) =>
          prev.filter((keyframe) => keyframe.frame !== selectedKeyframe.frame)
        );
      } else if (selectedKeyframe.property === "opacity") {
        setMasterOpacityKeyframes((prev) =>
          prev.filter((keyframe) => keyframe.frame !== selectedKeyframe.frame)
        );
      } else {
        setMasterScaleKeyframes((prev) =>
          prev.filter((keyframe) => keyframe.frame !== selectedKeyframe.frame)
        );
      }
    } else {
      setComps((prev) => removeSelectedKeyframeFromComps(prev, selectedKeyframe));
    }

    clearTransformDraftState(
      setSelectedKeyframe,
      setScaleDraft,
      setRotationDraft,
      setOpacityDraft
    );
  }, [
    masterCompId,
    selectedKeyframe,
    setComps,
    setMasterOpacityKeyframes,
    setMasterRotationKeyframes,
    setMasterScaleKeyframes,
    setOpacityDraft,
    setRotationDraft,
    setScaleDraft,
    setSelectedKeyframe,
  ]);

  return {
    handleSavePositionKeyframe,
    handleDeleteSelectedKeyframe,
  };
}
