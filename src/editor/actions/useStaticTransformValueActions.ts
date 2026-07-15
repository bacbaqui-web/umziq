import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Composition, Position, Scale } from "@/editor/types/types";
import {
  applyOpacityValueToComps,
  applyPositionValueToComps,
  applyRotationValueToComps,
  applyScaleValueToComps,
} from "@/editor/actions/editorActions";
import type { TransformTargetSelection } from "@/editor/types/transformActionTypes";

type UseStaticTransformValueActionsOptions = {
  masterCompId: string;
  selectedTransformTarget: TransformTargetSelection;
  selectedTransformLocalFrame: number;
  playheadFrame: number;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMasterScale: Dispatch<SetStateAction<Scale>>;
  setMasterRotation: Dispatch<SetStateAction<number>>;
  setMasterOpacity: Dispatch<SetStateAction<number>>;
};

export function useStaticTransformValueActions({
  masterCompId,
  selectedTransformTarget,
  selectedTransformLocalFrame,
  playheadFrame,
  setComps,
  setMasterScale,
  setMasterRotation,
  setMasterOpacity,
}: UseStaticTransformValueActionsOptions) {
  const applyScaleStaticValue = useCallback(
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
            false
          )
        );
      } else if (selectedTransformTarget.composition.id === masterCompId) {
        setMasterScale(nextScale);
      } else {
        setComps((prev) =>
          applyScaleValueToComps(
            prev,
            "composition",
            selectedTransformTarget.composition.id,
            nextScale,
            selectedTransformLocalFrame,
            false
          )
        );
      }
    },
    [
      masterCompId,
      selectedTransformLocalFrame,
      selectedTransformTarget,
      setComps,
      setMasterScale,
    ]
  );

  const applyRotationStaticValue = useCallback(
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
            false
          )
        );
      } else if (selectedTransformTarget.composition.id === masterCompId) {
        setMasterRotation(nextRotation);
      } else {
        setComps((prev) =>
          applyRotationValueToComps(
            prev,
            "composition",
            selectedTransformTarget.composition.id,
            nextRotation,
            selectedTransformLocalFrame,
            false
          )
        );
      }
    },
    [
      masterCompId,
      selectedTransformLocalFrame,
      selectedTransformTarget,
      setComps,
      setMasterRotation,
    ]
  );

  const applyPositionStaticValue = useCallback(
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
            playheadFrame,
            false
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
            false
          )
        );
      }
    },
    [
      masterCompId,
      playheadFrame,
      selectedTransformLocalFrame,
      selectedTransformTarget,
      setComps,
    ]
  );

  const applyOpacityStaticValue = useCallback(
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
            playheadFrame,
            false
          )
        );
      } else if (selectedTransformTarget.composition.id === masterCompId) {
        setMasterOpacity(clampedOpacity);
      } else {
        setComps((prev) =>
          applyOpacityValueToComps(
            prev,
            "composition",
            selectedTransformTarget.composition.id,
            clampedOpacity,
            selectedTransformLocalFrame,
            false
          )
        );
      }
    },
    [
      masterCompId,
      playheadFrame,
      selectedTransformLocalFrame,
      selectedTransformTarget,
      setComps,
      setMasterOpacity,
    ]
  );

  return {
    applyScaleStaticValue,
    applyRotationStaticValue,
    applyPositionStaticValue,
    applyOpacityStaticValue,
  };
}
