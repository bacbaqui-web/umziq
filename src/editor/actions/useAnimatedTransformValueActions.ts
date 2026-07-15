import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Composition, Position, Scale } from "@/editor/types/types";
import type { SelectedKeyframe } from "@/editor/types/editorViewTypes";
import {
  applyOpacityValueToComps,
  applyPositionValueToComps,
  applyRotationValueToComps,
  applyScaleValueToComps,
  upsertOpacityKeyframe,
  upsertRotationKeyframe,
  upsertScaleKeyframe,
} from "@/editor/actions/editorActions";
import type { TransformTargetSelection } from "@/editor/types/transformActionTypes";

type UseAnimatedTransformValueActionsOptions = {
  masterCompId: string;
  selectedTransformTarget: TransformTargetSelection;
  selectedTransformLocalFrame: number;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMasterScale: Dispatch<SetStateAction<Scale>>;
  setMasterScaleKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: Scale }>>>;
  setMasterRotation: Dispatch<SetStateAction<number>>;
  setMasterRotationKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setMasterOpacity: Dispatch<SetStateAction<number>>;
  setMasterOpacityKeyframes: Dispatch<SetStateAction<Array<{ frame: number; value: number }>>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
};

function buildSelectedKeyframe(
  selection: NonNullable<TransformTargetSelection>,
  property: "position" | "scale" | "rotation" | "opacity",
  frame: number
): SelectedKeyframe {
  return {
    targetKind: selection.kind,
    targetId:
      selection.kind === "layer"
        ? selection.layer.id
        : selection.composition.id,
    frame,
    property,
  };
}

export function useAnimatedTransformValueActions({
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
}: UseAnimatedTransformValueActionsOptions) {
  const applyScaleAnimatedValue = useCallback(
    (nextScale: Scale) => {
      if (!selectedTransformTarget) {
        return;
      }

      if (selectedTransformTarget.kind === "layer") {
        setComps((prev) =>
          applyScaleValueToComps(
            prev,
            "layer",
            selectedTransformTarget.layer.id,
            nextScale,
            selectedTransformLocalFrame,
            true
          )
        );
      } else if (selectedTransformTarget.composition.id === masterCompId) {
        setMasterScale(nextScale);
        setMasterScaleKeyframes((prev) =>
          upsertScaleKeyframe(prev, selectedTransformLocalFrame, nextScale)
        );
      } else {
        setComps((prev) =>
          applyScaleValueToComps(
            prev,
            "composition",
            selectedTransformTarget.composition.id,
            nextScale,
            selectedTransformLocalFrame,
            true
          )
        );
      }

      setSelectedKeyframe(
        buildSelectedKeyframe(selectedTransformTarget, "scale", selectedTransformLocalFrame)
      );
    },
    [
      masterCompId,
      selectedTransformLocalFrame,
      selectedTransformTarget,
      setComps,
      setMasterScale,
      setMasterScaleKeyframes,
      setSelectedKeyframe,
    ]
  );

  const applyRotationAnimatedValue = useCallback(
    (nextRotation: number) => {
      if (!selectedTransformTarget) {
        return;
      }

      if (selectedTransformTarget.kind === "layer") {
        setComps((prev) =>
          applyRotationValueToComps(
            prev,
            "layer",
            selectedTransformTarget.layer.id,
            nextRotation,
            selectedTransformLocalFrame,
            true
          )
        );
      } else if (selectedTransformTarget.composition.id === masterCompId) {
        setMasterRotation(nextRotation);
        setMasterRotationKeyframes((prev) =>
          upsertRotationKeyframe(prev, selectedTransformLocalFrame, nextRotation)
        );
      } else {
        setComps((prev) =>
          applyRotationValueToComps(
            prev,
            "composition",
            selectedTransformTarget.composition.id,
            nextRotation,
            selectedTransformLocalFrame,
            true
          )
        );
      }

      setSelectedKeyframe(
        buildSelectedKeyframe(selectedTransformTarget, "rotation", selectedTransformLocalFrame)
      );
    },
    [
      masterCompId,
      selectedTransformLocalFrame,
      selectedTransformTarget,
      setComps,
      setMasterRotation,
      setMasterRotationKeyframes,
      setSelectedKeyframe,
    ]
  );

  const applyPositionAnimatedValue = useCallback(
    (nextPosition: Position) => {
      if (!selectedTransformTarget) {
        return;
      }

      if (selectedTransformTarget.kind === "layer") {
        setComps((prev) =>
          applyPositionValueToComps(
            prev,
            "layer",
            selectedTransformTarget.layer.id,
            nextPosition,
            selectedTransformLocalFrame,
            true
          )
        );
      } else if (selectedTransformTarget.composition.id !== masterCompId) {
        setComps((prev) =>
          applyPositionValueToComps(
            prev,
            "composition",
            selectedTransformTarget.composition.id,
            nextPosition,
            selectedTransformLocalFrame,
            true
          )
        );
      }

      setSelectedKeyframe(
        buildSelectedKeyframe(
          selectedTransformTarget,
          "position",
          selectedTransformLocalFrame
        )
      );
    },
    [
      masterCompId,
      selectedTransformLocalFrame,
      selectedTransformTarget,
      setComps,
      setSelectedKeyframe,
    ]
  );

  const applyOpacityAnimatedValue = useCallback(
    (nextOpacity: number) => {
      if (!selectedTransformTarget) {
        return;
      }

      const clampedOpacity = Math.min(100, Math.max(0, nextOpacity));

      if (selectedTransformTarget.kind === "layer") {
        setComps((prev) =>
          applyOpacityValueToComps(
            prev,
            "layer",
            selectedTransformTarget.layer.id,
            clampedOpacity,
            selectedTransformLocalFrame,
            true
          )
        );
      } else if (selectedTransformTarget.composition.id === masterCompId) {
        setMasterOpacity(clampedOpacity);
        setMasterOpacityKeyframes((prev) =>
          upsertOpacityKeyframe(prev, selectedTransformLocalFrame, clampedOpacity)
        );
      } else {
        setComps((prev) =>
          applyOpacityValueToComps(
            prev,
            "composition",
            selectedTransformTarget.composition.id,
            clampedOpacity,
            selectedTransformLocalFrame,
            true
          )
        );
      }

      setSelectedKeyframe(
        buildSelectedKeyframe(
          selectedTransformTarget,
          "opacity",
          selectedTransformLocalFrame
        )
      );
    },
    [
      masterCompId,
      selectedTransformLocalFrame,
      selectedTransformTarget,
      setComps,
      setMasterOpacity,
      setMasterOpacityKeyframes,
      setSelectedKeyframe,
    ]
  );

  return {
    applyScaleAnimatedValue,
    applyRotationAnimatedValue,
    applyPositionAnimatedValue,
    applyOpacityAnimatedValue,
  };
}
