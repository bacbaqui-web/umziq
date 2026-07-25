export interface FrameValueKeyframe<TValue = unknown> {
  readonly frame: number;
  readonly value: TValue;
}

/**
 * Shared Plain Data keyframe primitive. Animation commands and Layer
 * Document atomic transactions use this same replacement/sort policy.
 */
export function upsertKeyframeValue<
  TValue,
  TKeyframe extends FrameValueKeyframe<TValue>,
>(
  keyframes: readonly TKeyframe[],
  frame: number,
  value: TValue
): TKeyframe[] {
  const nextKeyframes = [...keyframes];
  const existingIndex = nextKeyframes.findIndex(
    (keyframe) => keyframe.frame === frame
  );
  const nextKeyframe = { frame, value } as TKeyframe;

  if (existingIndex >= 0) {
    nextKeyframes[existingIndex] = nextKeyframe;
  } else {
    nextKeyframes.push(nextKeyframe);
  }
  nextKeyframes.sort((left, right) => left.frame - right.frame);
  return nextKeyframes;
}

export function moveFrameValueKeyframe<
  TValue,
  TKeyframe extends FrameValueKeyframe<TValue>,
>(
  keyframes: readonly TKeyframe[],
  fromFrame: number,
  toFrame: number
): TKeyframe[] {
  const source = keyframes.find(
    (keyframe) => keyframe.frame === fromFrame
  );
  if (!source) return [...keyframes];
  return [
    ...keyframes.filter(
      (keyframe) =>
        keyframe.frame !== fromFrame &&
        keyframe.frame !== toFrame
    ),
    { frame: toFrame, value: source.value } as TKeyframe,
  ].sort((left, right) => left.frame - right.frame);
}

export function removeFrameValueKeyframe<
  TValue,
  TKeyframe extends FrameValueKeyframe<TValue>,
>(
  keyframes: readonly TKeyframe[],
  frame: number
): TKeyframe[] {
  return keyframes.filter(
    (keyframe) => keyframe.frame !== frame
  );
}
