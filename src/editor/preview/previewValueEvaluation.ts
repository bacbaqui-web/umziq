import type {
  Composition,
  Layer,
  OpacityKeyframe,
  Position,
  RotationKeyframe,
  Scale,
  ScaleKeyframe,
} from "@/editor/types/types";

function evaluatePositionKeyframes(
  baseValue: Position,
  keyframes: Array<{ frame: number; value: Position }>,
  currentFrame: number
): Position {
  const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

  if (sortedKeyframes.length === 0) {
    return baseValue;
  }

  const exactKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame === currentFrame);

  if (exactKeyframe) {
    return exactKeyframe.value;
  }

  const previousKeyframe = [...sortedKeyframes]
    .reverse()
    .find((keyframe) => keyframe.frame < currentFrame);
  const nextKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame > currentFrame);

  if (!previousKeyframe) {
    return sortedKeyframes[0].value;
  }

  if (!nextKeyframe) {
    return sortedKeyframes[sortedKeyframes.length - 1].value;
  }

  const progress =
    (currentFrame - previousKeyframe.frame) /
    (nextKeyframe.frame - previousKeyframe.frame);

  return {
    x: previousKeyframe.value.x + (nextKeyframe.value.x - previousKeyframe.value.x) * progress,
    y: previousKeyframe.value.y + (nextKeyframe.value.y - previousKeyframe.value.y) * progress,
  };
}

function evaluateScaleKeyframes(
  baseValue: Scale,
  keyframes: ScaleKeyframe[],
  currentFrame: number
): Scale {
  const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

  if (sortedKeyframes.length === 0) {
    return baseValue;
  }

  const exactKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame === currentFrame);

  if (exactKeyframe) {
    return exactKeyframe.value;
  }

  const previousKeyframe = [...sortedKeyframes]
    .reverse()
    .find((keyframe) => keyframe.frame < currentFrame);
  const nextKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame > currentFrame);

  if (!previousKeyframe) {
    return sortedKeyframes[0].value;
  }

  if (!nextKeyframe) {
    return sortedKeyframes[sortedKeyframes.length - 1].value;
  }

  const progress =
    (currentFrame - previousKeyframe.frame) /
    (nextKeyframe.frame - previousKeyframe.frame);

  return {
    x: previousKeyframe.value.x + (nextKeyframe.value.x - previousKeyframe.value.x) * progress,
    y: previousKeyframe.value.y + (nextKeyframe.value.y - previousKeyframe.value.y) * progress,
  };
}

function evaluateScalarKeyframes(
  baseValue: number,
  keyframes: Array<OpacityKeyframe | RotationKeyframe>,
  currentFrame: number
) {
  const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

  if (sortedKeyframes.length === 0) {
    return baseValue;
  }

  const exactKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame === currentFrame);

  if (exactKeyframe) {
    return exactKeyframe.value;
  }

  const previousKeyframe = [...sortedKeyframes]
    .reverse()
    .find((keyframe) => keyframe.frame < currentFrame);
  const nextKeyframe = sortedKeyframes.find((keyframe) => keyframe.frame > currentFrame);

  if (!previousKeyframe) {
    return sortedKeyframes[0].value;
  }

  if (!nextKeyframe) {
    return sortedKeyframes[sortedKeyframes.length - 1].value;
  }

  const progress =
    (currentFrame - previousKeyframe.frame) /
    (nextKeyframe.frame - previousKeyframe.frame);

  return previousKeyframe.value + (nextKeyframe.value - previousKeyframe.value) * progress;
}

export function evaluateLayerPosition(layer: Layer, currentFrame: number): Position {
  if (!layer.enabledProperties.position) {
    return layer.position;
  }

  return evaluatePositionKeyframes(layer.position, layer.positionKeyframes, currentFrame);
}

export function evaluateLayerOpacity(layer: Layer, currentFrame: number) {
  if (!layer.enabledProperties.opacity) {
    return Math.min(100, Math.max(0, layer.opacity));
  }

  return Math.min(
    100,
    Math.max(0, evaluateScalarKeyframes(layer.opacity, layer.opacityKeyframes, currentFrame))
  );
}

export function evaluateLayerScale(layer: Layer, currentFrame: number) {
  if (!layer.enabledProperties.scale) {
    return layer.scale;
  }

  return evaluateScaleKeyframes(layer.scale, layer.scaleKeyframes, currentFrame);
}

export function evaluateCompositionScale(composition: Composition, currentFrame: number) {
  if (!composition.enabledProperties.scale) {
    return composition.scale;
  }

  return evaluateScaleKeyframes(composition.scale, composition.scaleKeyframes, currentFrame);
}

export function evaluateCompositionOpacity(composition: Composition, currentFrame: number) {
  if (!composition.enabledProperties.opacity) {
    return Math.min(100, Math.max(0, composition.opacity));
  }

  return Math.min(
    100,
    Math.max(
      0,
      evaluateScalarKeyframes(composition.opacity, composition.opacityKeyframes, currentFrame)
    )
  );
}

export function evaluateCompositionPosition(
  composition: Composition,
  currentFrame: number
): Position {
  if (!composition.enabledProperties.position) {
    return composition.position;
  }

  return evaluatePositionKeyframes(composition.position, composition.positionKeyframes, currentFrame);
}

export function evaluateLayerRotation(layer: Layer, currentFrame: number) {
  if (!layer.enabledProperties.rotation) {
    return layer.rotation;
  }

  return evaluateScalarKeyframes(layer.rotation, layer.rotationKeyframes, currentFrame);
}

export function evaluateCompositionRotation(
  composition: Composition,
  currentFrame: number
) {
  if (!composition.enabledProperties.rotation) {
    return composition.rotation;
  }

  return evaluateScalarKeyframes(
    composition.rotation,
    composition.rotationKeyframes,
    currentFrame
  );
}
