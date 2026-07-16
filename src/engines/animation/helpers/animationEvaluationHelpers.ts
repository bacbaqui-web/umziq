import type {
  Composition,
  Layer,
  OpacityKeyframe,
  Position,
  PositionKeyframe,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
} from "@/models";
import { clampOpacity } from "@/engines/animation/helpers/transformValueHelpers";

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

export function evaluateLayerPosition(layer: Layer, currentFrame: number): Position {
  return layer.enabledProperties.position
    ? evaluatePositionKeyframes(layer.position, layer.positionKeyframes, currentFrame)
    : layer.position;
}

export function evaluateLayerScale(layer: Layer, currentFrame: number) {
  return layer.enabledProperties.scale
    ? evaluateScaleKeyframes(layer.scale, layer.scaleKeyframes, currentFrame)
    : layer.scale;
}

export function evaluateLayerRotation(layer: Layer, currentFrame: number) {
  return layer.enabledProperties.rotation
    ? evaluateScalarKeyframes(layer.rotation, layer.rotationKeyframes, currentFrame)
    : layer.rotation;
}

export function evaluateLayerOpacity(layer: Layer, currentFrame: number) {
  const value = layer.enabledProperties.opacity
    ? evaluateScalarKeyframes(layer.opacity, layer.opacityKeyframes, currentFrame)
    : layer.opacity;
  return clampOpacity(value);
}

export function evaluateCompositionPosition(composition: Composition, currentFrame: number) {
  return composition.enabledProperties.position
    ? evaluatePositionKeyframes(composition.position, composition.positionKeyframes, currentFrame)
    : composition.position;
}

export function evaluateCompositionScale(composition: Composition, currentFrame: number) {
  return composition.enabledProperties.scale
    ? evaluateScaleKeyframes(composition.scale, composition.scaleKeyframes, currentFrame)
    : composition.scale;
}

export function evaluateCompositionRotation(composition: Composition, currentFrame: number) {
  return composition.enabledProperties.rotation
    ? evaluateScalarKeyframes(composition.rotation, composition.rotationKeyframes, currentFrame)
    : composition.rotation;
}

export function evaluateCompositionOpacity(composition: Composition, currentFrame: number) {
  const value = composition.enabledProperties.opacity
    ? evaluateScalarKeyframes(composition.opacity, composition.opacityKeyframes, currentFrame)
    : composition.opacity;
  return clampOpacity(value);
}
