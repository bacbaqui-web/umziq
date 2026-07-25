import type {
  OpacityKeyframe,
  PositionKeyframe,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/models";
export {
  upsertKeyframeValue,
} from "@/models/keyframeTrackMutation";

export type SupportedKeyframe =
  | PositionKeyframe
  | OpacityKeyframe
  | ScaleKeyframe
  | RotationKeyframe;

export function findKeyframeAtFrame<T extends SupportedKeyframe>(
  keyframes: readonly T[],
  frame: number
) {
  return keyframes.find((keyframe) => keyframe.frame === frame);
}

export function hasKeyframeAtFrame(
  keyframes: readonly SupportedKeyframe[],
  frame: number
) {
  return findKeyframeAtFrame(keyframes, frame) !== undefined;
}

export function sortKeyframesByFrame<T extends SupportedKeyframe>(keyframes: readonly T[]) {
  return [...keyframes].sort((a, b) => a.frame - b.frame);
}

export function moveKeyframeValue<T extends SupportedKeyframe>(
  keyframes: T[],
  fromFrame: number,
  toFrame: number
) {
  const sourceKeyframe = findKeyframeAtFrame(keyframes, fromFrame);

  if (!sourceKeyframe) {
    return keyframes;
  }

  const nextKeyframes = keyframes.filter(
    (keyframe) => keyframe.frame !== fromFrame && keyframe.frame !== toFrame
  );

  nextKeyframes.push({
    frame: toFrame,
    value: sourceKeyframe.value,
  } as T);
  nextKeyframes.sort((a, b) => a.frame - b.frame);
  return nextKeyframes;
}

export function removeKeyframeValue<T extends SupportedKeyframe>(
  keyframes: readonly T[],
  frame: number
) {
  return keyframes.filter((keyframe) => keyframe.frame !== frame);
}
