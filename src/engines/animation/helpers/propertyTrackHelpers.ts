import type {
  AnimatableProperty,
  OpacityKeyframe,
  Position,
  PositionKeyframe,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
} from "@/models";
import type { AnimationTarget } from "@/engines/animation/helpers/keyframeTargetHelpers";
import { updateTargetKeyframes } from "@/engines/animation/helpers/keyframeTargetHelpers";
import { upsertKeyframeValue } from "@/engines/animation/helpers/keyframeTrackHelpers";

export type PropertyTrackValues = {
  position: Position;
  scale: Scale;
  rotation: number;
  opacity: number;
};

export type PropertyTrackFrames = Record<AnimatableProperty, number>;

export function setTargetPropertyTrackEnabled<T extends AnimationTarget>(
  target: T,
  property: AnimatableProperty,
  enabled: boolean
): T {
  return {
    ...target,
    enabledProperties: {
      ...target.enabledProperties,
      [property]: enabled,
    },
  };
}

export function updateTargetPropertyTrack<T extends AnimationTarget>(
  target: T,
  property: AnimatableProperty,
  enabled: boolean,
  values: PropertyTrackValues,
  frames: PropertyTrackFrames
): T {
  const nextTarget = setTargetPropertyTrackEnabled(target, property, enabled);

  if (!enabled) return nextTarget;

  return updateTargetKeyframes(nextTarget, property, (keyframes) => {
    if (property === "position") {
      return upsertKeyframeValue(
        keyframes as PositionKeyframe[],
        frames.position,
        values.position
      );
    }

    if (property === "scale") {
      return upsertKeyframeValue(keyframes as ScaleKeyframe[], frames.scale, values.scale);
    }

    if (property === "rotation") {
      return upsertKeyframeValue(
        keyframes as RotationKeyframe[],
        frames.rotation,
        values.rotation
      );
    }

    return upsertKeyframeValue(
      keyframes as OpacityKeyframe[],
      frames.opacity,
      values.opacity
    );
  });
}
