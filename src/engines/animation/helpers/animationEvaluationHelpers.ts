import type {
  OpacityKeyframe,
  Position,
  PositionKeyframe,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
} from "@/models";

export function evaluatePositionKeyframes(
  baseValue: Position,
  keyframes: readonly PositionKeyframe[],
  currentFrame: number
): Position {
  const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

  if (sortedKeyframes.length === 0) return baseValue;

  const exactKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame === currentFrame);
  if (exactKeyframe) return exactKeyframe.value;

  const previousKeyframe = [...sortedKeyframes]
    .reverse()
    .find((keyframe) => keyframe.frame < currentFrame);
  const nextKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame > currentFrame);

  if (!previousKeyframe) return sortedKeyframes[0].value;
  if (!nextKeyframe) return sortedKeyframes[sortedKeyframes.length - 1].value;

  const progress =
    (currentFrame - previousKeyframe.frame) /
    (nextKeyframe.frame - previousKeyframe.frame);

  return {
    x: previousKeyframe.value.x + (nextKeyframe.value.x - previousKeyframe.value.x) * progress,
    y: previousKeyframe.value.y + (nextKeyframe.value.y - previousKeyframe.value.y) * progress,
  };
}

export function evaluateScaleKeyframes(
  baseValue: Scale,
  keyframes: readonly ScaleKeyframe[],
  currentFrame: number
): Scale {
  return evaluatePositionKeyframes(baseValue, keyframes, currentFrame);
}

export function evaluateScalarKeyframes(
  baseValue: number,
  keyframes: readonly (OpacityKeyframe | RotationKeyframe)[],
  currentFrame: number
) {
  const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

  if (sortedKeyframes.length === 0) return baseValue;

  const exactKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame === currentFrame);
  if (exactKeyframe) return exactKeyframe.value;

  const previousKeyframe = [...sortedKeyframes]
    .reverse()
    .find((keyframe) => keyframe.frame < currentFrame);
  const nextKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame > currentFrame);

  if (!previousKeyframe) return sortedKeyframes[0].value;
  if (!nextKeyframe) return sortedKeyframes[sortedKeyframes.length - 1].value;

  const progress =
    (currentFrame - previousKeyframe.frame) /
    (nextKeyframe.frame - previousKeyframe.frame);
  return previousKeyframe.value + (nextKeyframe.value - previousKeyframe.value) * progress;
}
