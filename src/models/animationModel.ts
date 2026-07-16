import type { Position, Scale } from "@/models/transformModel";

export type AnimatableProperty = "position" | "scale" | "rotation" | "opacity";

export interface PropertyTrackState {
  position: boolean;
  scale: boolean;
  rotation: boolean;
  opacity: boolean;
}

export function createPropertyTrackState(
  overrides: Partial<PropertyTrackState> = {}
): PropertyTrackState {
  return {
    position: false,
    scale: false,
    rotation: false,
    opacity: false,
    ...overrides,
  };
}

export interface PositionKeyframe {
  frame: number;
  value: Position;
}

export interface ScaleKeyframe {
  frame: number;
  value: Scale;
}

export interface RotationKeyframe {
  frame: number;
  value: number;
}

export interface OpacityKeyframe {
  frame: number;
  value: number;
}
