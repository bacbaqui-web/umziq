import { useCallback, type Dispatch, type SetStateAction } from "react";
import type {
  AnimatableProperty,
  Composition,
  Layer,
  Position,
  PropertyTrackState,
  Scale,
} from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";
import {
  setScaleLinkedOnTarget,
  togglePropertyTrackOnTarget,
  updateCompositionNodeRecursively,
} from "@/editor/actions/editorActions";
import {
  upsertOpacityKeyframe,
  upsertRotationKeyframe,
  upsertScaleKeyframe,
} from "@/editor/actions/keyframeActions";
import {
  createSelectedPropertyKeyframe,
  matchesSelectedPropertyKeyframe,
} from "@/editor/actions/transformPropertyActionHelpers";

type UseTransformPropertyToggleActionsOptions = {
  masterCompId: string;
  selectedComp: Composition;
  selectedLayer: Layer | null;
  selectedTimelineComp: Composition | null;
  selectedScaleTarget: Layer | Composition | null;
  selectedKeyframe: SelectedKeyframe;
  selectedTransformLocalFrame: number;
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
};

export function useTransformPropertyToggleActions({
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
}: UseTransformPropertyToggleActionsOptions) {
  const setScaleLinkState = useCallback(
    (linked: boolean) => {
      if (!selectedScaleTarget) {
        return;
      }

      if ("type" in selectedScaleTarget && selectedScaleTarget.id === masterCompId) {
        setMasterScaleLinked(linked);
        return;
      }

      if ("visible" in selectedScaleTarget) {
        setComps((prev) =>
          setScaleLinkedOnTarget(prev, "layer", selectedScaleTarget.id, linked)
        );
        return;
      }

      setComps((prev) =>
        setScaleLinkedOnTarget(prev, "composition", selectedScaleTarget.id, linked)
      );
    },
    [masterCompId, selectedScaleTarget, setComps, setMasterScaleLinked]
  );

  const handleTogglePropertyTrack = useCallback(
    (property: AnimatableProperty, enabled: boolean) => {
      if (selectedLayer) {
        setComps((prev) =>
          togglePropertyTrackOnTarget(
            prev,
            "layer",
            selectedLayer.id,
            property,
            enabled,
            {
              position: resolvedPositionDraft,
              scale: resolvedScaleDraft,
              rotation: resolvedRotationDraft,
              opacity: Math.min(100, Math.max(0, resolvedOpacityDraft)),
            },
            {
              position: selectedTransformLocalFrame,
              scale: selectedTransformLocalFrame,
              rotation: selectedTransformLocalFrame,
              opacity: selectedTransformLocalFrame,
            }
          )
        );

        if (
          enabled &&
          (property === "position" ||
            property === "opacity" ||
            property === "scale" ||
            property === "rotation")
        ) {
          setSelectedKeyframe(
            createSelectedPropertyKeyframe(
              "layer",
              selectedLayer.id,
              property,
              selectedTransformLocalFrame
            )
          );
        } else if (
          !enabled &&
          matchesSelectedPropertyKeyframe(selectedKeyframe, "layer", selectedLayer.id, property)
        ) {
          setSelectedKeyframe(null);
        }

        return;
      }

      if (selectedTimelineComp) {
        if (selectedTimelineComp.id === masterCompId) {
          setMasterEnabledProperties((prev) => ({
            ...prev,
            [property]: enabled,
          }));

          if (enabled && property === "scale") {
            setMasterScaleKeyframes((prev) =>
              upsertScaleKeyframe(prev, selectedTransformLocalFrame, resolvedScaleDraft)
            );
            setSelectedKeyframe(
              createSelectedPropertyKeyframe(
                "composition",
                masterCompId,
                "scale",
                selectedTransformLocalFrame
              )
            );
          } else if (enabled && property === "rotation") {
            setMasterRotationKeyframes((prev) =>
              upsertRotationKeyframe(prev, selectedTransformLocalFrame, resolvedRotationDraft)
            );
            setSelectedKeyframe(
              createSelectedPropertyKeyframe(
                "composition",
                masterCompId,
                "rotation",
                selectedTransformLocalFrame
              )
            );
          } else if (enabled && property === "opacity") {
            setMasterOpacityKeyframes((prev) =>
              upsertOpacityKeyframe(prev, selectedTransformLocalFrame, resolvedOpacityDraft)
            );
            setSelectedKeyframe(
              createSelectedPropertyKeyframe(
                "composition",
                masterCompId,
                "opacity",
                selectedTransformLocalFrame
              )
            );
          }
          return;
        }

        setComps((prev) =>
          togglePropertyTrackOnTarget(
            prev,
            "composition",
            selectedTimelineComp.id,
            property,
            enabled,
            {
              position: resolvedPositionDraft,
              scale: resolvedScaleDraft,
              rotation: resolvedRotationDraft,
              opacity: resolvedOpacityDraft,
            },
            {
              position: selectedTransformLocalFrame,
              scale: selectedTransformLocalFrame,
              rotation: selectedTransformLocalFrame,
              opacity: selectedTransformLocalFrame,
            }
          )
        );

        if (
          enabled &&
          (property === "position" ||
            property === "scale" ||
            property === "rotation" ||
            property === "opacity")
        ) {
          setSelectedKeyframe(
            createSelectedPropertyKeyframe(
              "composition",
              selectedTimelineComp.id,
              property,
              selectedTransformLocalFrame
            )
          );
        } else if (
          !enabled &&
          matchesSelectedPropertyKeyframe(
            selectedKeyframe,
            "composition",
            selectedTimelineComp.id,
            property
          )
        ) {
          setSelectedKeyframe(null);
        }
        return;
      }

      if (selectedComp.id === masterCompId) {
        setMasterEnabledProperties((prev) => ({
          ...prev,
          [property]: enabled,
        }));
        return;
      }

      setComps((prev) =>
        prev.map((comp) =>
          updateCompositionNodeRecursively(comp, selectedComp.id, (target) => ({
            ...target,
            enabledProperties: {
              ...target.enabledProperties,
              [property]: enabled,
            },
          }))
        )
      );
    },
    [
      masterCompId,
      resolvedOpacityDraft,
      resolvedPositionDraft,
      resolvedRotationDraft,
      resolvedScaleDraft,
      selectedComp,
      selectedKeyframe,
      selectedLayer,
      selectedTimelineComp,
      selectedTransformLocalFrame,
      setComps,
      setMasterEnabledProperties,
      setMasterOpacityKeyframes,
      setMasterRotationKeyframes,
      setMasterScaleKeyframes,
      setSelectedKeyframe,
    ]
  );

  return {
    setScaleLinkState,
    handleTogglePropertyTrack,
  };
}
