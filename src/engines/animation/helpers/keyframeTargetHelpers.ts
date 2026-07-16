import type {
  AnimatableProperty,
  Composition,
  Layer,
  OpacityKeyframe,
  PositionKeyframe,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/models";

export type AnimationTarget = Layer | Composition;
export type KeyframeProperty = AnimatableProperty;
export type SupportedKeyframeList =
  | PositionKeyframe[]
  | OpacityKeyframe[]
  | ScaleKeyframe[]
  | RotationKeyframe[];

export function getTargetKeyframes(
  target: AnimationTarget,
  property: KeyframeProperty
): SupportedKeyframeList {
  if (property === "position") return target.positionKeyframes;
  if (property === "opacity") return target.opacityKeyframes;
  if (property === "rotation") return target.rotationKeyframes;
  return target.scaleKeyframes;
}

export function replaceTargetKeyframes<T extends AnimationTarget>(
  target: T,
  property: KeyframeProperty,
  keyframes: SupportedKeyframeList
): T {
  if (property === "position") {
    return { ...target, positionKeyframes: keyframes as PositionKeyframe[] };
  }

  if (property === "opacity") {
    return { ...target, opacityKeyframes: keyframes as OpacityKeyframe[] };
  }

  if (property === "rotation") {
    return { ...target, rotationKeyframes: keyframes as RotationKeyframe[] };
  }

  return { ...target, scaleKeyframes: keyframes as ScaleKeyframe[] };
}

export function updateTargetKeyframes<T extends AnimationTarget>(
  target: T,
  property: KeyframeProperty,
  updateKeyframes: (keyframes: SupportedKeyframeList) => SupportedKeyframeList
) {
  return replaceTargetKeyframes(target, property, updateKeyframes(getTargetKeyframes(target, property)));
}

export function isTargetPropertyAnimated(target: AnimationTarget, property: AnimatableProperty) {
  return target.enabledProperties[property];
}
