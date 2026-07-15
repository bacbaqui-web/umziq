import type {
  Composition,
  OpacityKeyframe,
  PositionKeyframe,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/editor/types/types";
import {
  updateCompositionNodeRecursively,
  updateLayerRecursively,
} from "@/editor/actions/compositionActions";

export type KeyframeProperty = "position" | "opacity" | "scale" | "rotation";
export type SupportedKeyframeList =
  | PositionKeyframe[]
  | OpacityKeyframe[]
  | ScaleKeyframe[]
  | RotationKeyframe[];

export function withLayerKeyframes(
  composition: Composition,
  targetId: string,
  property: KeyframeProperty,
  updateKeyframes: (keyframes: SupportedKeyframeList) => SupportedKeyframeList
) {
  return updateLayerRecursively(composition, targetId, (layer) => {
    if (property === "position") {
      return {
        ...layer,
        positionKeyframes: updateKeyframes(layer.positionKeyframes) as PositionKeyframe[],
      };
    }

    if (property === "opacity") {
      return {
        ...layer,
        opacityKeyframes: updateKeyframes(layer.opacityKeyframes) as OpacityKeyframe[],
      };
    }

    if (property === "rotation") {
      return {
        ...layer,
        rotationKeyframes: updateKeyframes(layer.rotationKeyframes) as RotationKeyframe[],
      };
    }

    return {
      ...layer,
      scaleKeyframes: updateKeyframes(layer.scaleKeyframes) as ScaleKeyframe[],
    };
  });
}

export function withCompositionKeyframes(
  composition: Composition,
  targetId: string,
  property: KeyframeProperty,
  updateKeyframes: (keyframes: SupportedKeyframeList) => SupportedKeyframeList
) {
  return updateCompositionNodeRecursively(composition, targetId, (target) => {
    if (property === "position") {
      return {
        ...target,
        positionKeyframes: updateKeyframes(target.positionKeyframes) as PositionKeyframe[],
      };
    }

    if (property === "opacity") {
      return {
        ...target,
        opacityKeyframes: updateKeyframes(target.opacityKeyframes) as OpacityKeyframe[],
      };
    }

    if (property === "rotation") {
      return {
        ...target,
        rotationKeyframes: updateKeyframes(target.rotationKeyframes) as RotationKeyframe[],
      };
    }

    return {
      ...target,
      scaleKeyframes: updateKeyframes(target.scaleKeyframes) as ScaleKeyframe[],
    };
  });
}
