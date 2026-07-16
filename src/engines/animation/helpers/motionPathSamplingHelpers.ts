import type { Position, PositionKeyframe } from "@/models";
import { evaluatePositionKeyframes } from "@/engines/animation/helpers/animationEvaluationHelpers";
import {
  globalFrameToLocalFrame,
  localFrameToGlobalFrame,
} from "@/engines/animation/helpers/animationFrameHelpers";

export interface MotionPathSample {
  frame: number;
  position: Position;
  isKeyframe: boolean;
}

type BuildMotionPathSamplesOptions = {
  basePosition: Position;
  positionKeyframes: readonly PositionKeyframe[];
  positionTrackEnabled: boolean;
  startFrame: number;
  durationFrames: number;
  compositionDurationFrames: number;
};

export function buildPositionMotionPathSamples({
  basePosition,
  positionKeyframes,
  positionTrackEnabled,
  startFrame,
  durationFrames,
  compositionDurationFrames,
}: BuildMotionPathSamplesOptions): MotionPathSample[] {
  const keyframeGlobalFrames = positionTrackEnabled
    ? new Set(positionKeyframes.map((keyframe) => localFrameToGlobalFrame(keyframe.frame, startFrame)))
    : new Set<number>();
  const samples: MotionPathSample[] = [];

  for (let frame = 0; frame < compositionDurationFrames; frame += 1) {
    if (frame < startFrame || frame >= startFrame + durationFrames) continue;

    samples.push({
      frame,
      position: positionTrackEnabled
        ? evaluatePositionKeyframes(
            basePosition,
            positionKeyframes,
            globalFrameToLocalFrame(frame, startFrame)
          )
        : basePosition,
      isKeyframe: keyframeGlobalFrames.has(frame),
    });
  }

  return samples;
}
