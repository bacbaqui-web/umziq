import type {
  OpacityKeyframe,
  PositionKeyframe,
  RotationKeyframe,
  ScaleKeyframe,
} from "@/editor/types/types";

type AnySupportedKeyframe =
  | PositionKeyframe
  | OpacityKeyframe
  | ScaleKeyframe
  | RotationKeyframe;

export function upsertKeyframeValue<T extends AnySupportedKeyframe>(
  keyframes: T[],
  frame: number,
  value: T["value"]
) {
  const nextKeyframes = [...keyframes];
  const existingIndex = nextKeyframes.findIndex((keyframe) => keyframe.frame === frame);
  const nextKeyframe = { frame, value } as T;

  if (existingIndex >= 0) {
    nextKeyframes[existingIndex] = nextKeyframe;
  } else {
    nextKeyframes.push(nextKeyframe);
  }

  nextKeyframes.sort((a, b) => a.frame - b.frame);
  return nextKeyframes;
}

export function moveKeyframeValue<T extends AnySupportedKeyframe>(
  keyframes: T[],
  fromFrame: number,
  toFrame: number
) {
  const sourceKeyframe = keyframes.find((keyframe) => keyframe.frame === fromFrame);

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

export function removeKeyframeValue<T extends AnySupportedKeyframe>(keyframes: T[], frame: number) {
  return keyframes.filter((keyframe) => keyframe.frame !== frame);
}
