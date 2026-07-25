import type { ModifierInstance, Position, PositionKeyframe } from "@/models";
import { evaluatePositionKeyframes } from "@/engines/animation/helpers/animationEvaluationHelpers";
import { applyPositionModifiers } from "@/engines/animation/helpers/modifierEvaluationHelpers";
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
  sourceOffsetFrames?: number;
  compositionDurationFrames: number;
  targetId?: string;
  modifiers?: readonly ModifierInstance[];
  frameRate?: number;
};

export function buildPositionMotionPathSamples({
  basePosition,
  positionKeyframes,
  positionTrackEnabled,
  startFrame,
  durationFrames,
  sourceOffsetFrames = 0,
  compositionDurationFrames,
  targetId,
  modifiers,
  frameRate = 30,
}: BuildMotionPathSamplesOptions): MotionPathSample[] {
  const keyframeGlobalFrames = positionTrackEnabled
    ? new Set(positionKeyframes.map((keyframe) =>
        localFrameToGlobalFrame(
          keyframe.frame,
          startFrame,
          sourceOffsetFrames
        )
      ))
    : new Set<number>();
  const samples: MotionPathSample[] = [];

  for (let frame = 0; frame < compositionDurationFrames; frame += 1) {
    if (frame < startFrame || frame >= startFrame + durationFrames) continue;

    samples.push({
      frame,
      position: applyPositionModifiers(
        positionTrackEnabled
          ? evaluatePositionKeyframes(
              basePosition,
              positionKeyframes,
              globalFrameToLocalFrame(
                frame,
                startFrame,
                sourceOffsetFrames
              )
            )
          : basePosition,
        targetId ?? "motion-path",
        modifiers,
        globalFrameToLocalFrame(
          frame,
          startFrame,
          sourceOffsetFrames
        ),
        frameRate
      ),
      isKeyframe: keyframeGlobalFrames.has(frame),
    });
  }

  return samples;
}
