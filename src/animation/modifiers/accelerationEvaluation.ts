import type { AccelerationCurve, LayerModifier } from "@/models";

export function evaluateAccelerationProgress(curve: AccelerationCurve, progress: number) {
  const value = Math.max(0, Math.min(1, progress));
  if (curve === "ease-out-soft") return 1 - (1 - value) ** 2;
  if (curve === "ease-out-strong") return 1 - (1 - value) ** 4;
  if (curve === "ease-in-soft") return value ** 2;
  return value ** 4;
}

export function remapAccelerationFrame(
  modifier: Extract<LayerModifier, { type: "acceleration" }>,
  localFrame: number
) {
  if (!modifier.enabled) return localFrame;
  const endFrame = modifier.startFrame + modifier.durationFrames;
  if (localFrame <= modifier.startFrame || localFrame >= endFrame) return localFrame;
  const progress = (localFrame - modifier.startFrame) / modifier.durationFrames;
  return modifier.startFrame + evaluateAccelerationProgress(modifier.curve, progress) * modifier.durationFrames;
}
