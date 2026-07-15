import type { Position, Scale } from "@/editor/types/types";
import type { ScaleHandleDirection } from "@/editor/types/editorViewTypes";

export function formatRotationHandleValue(value: number) {
  return `${Math.round(value)}°`;
}

function formatScalePercentage(value: number) {
  return `${Math.round(value)}%`;
}

export function formatScaleHandleReadout(
  handle: ScaleHandleDirection,
  scale: Scale
) {
  if (handle === "x") {
    return `X ${formatScalePercentage(scale.x)}`;
  }

  if (handle === "y") {
    return `Y ${formatScalePercentage(scale.y)}`;
  }

  return `X ${formatScalePercentage(scale.x)} / Y ${formatScalePercentage(scale.y)}`;
}

export function formatPositionDeltaReadout(delta: Position) {
  const formatAxis = (value: number) => `${value >= 0 ? "+" : ""}${Math.round(value)}`;
  return `ΔX ${formatAxis(delta.x)} / ΔY ${formatAxis(delta.y)}`;
}

export function formatTimelineTime(frame: number, frameRate: number) {
  const seconds = frame / frameRate;
  return `${seconds.toFixed(2)}s / F${frame}`;
}

export function formatCompactTime(frame: number, frameRate: number) {
  const seconds = Math.floor(frame / frameRate);
  const frames = frame % frameRate;
  return `${seconds}s${frames}f`;
}
