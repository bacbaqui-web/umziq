import type { Composition, Layer } from "@/models";

export type TransformTargetSelection =
  | {
      kind: "layer";
      layer: Layer;
    }
  | {
      kind: "composition";
      composition: Composition;
    }
  | null;

export type TransformEditMode = "static" | "animated";

export function getTransformEditMode(enabled: boolean): TransformEditMode {
  return enabled ? "animated" : "static";
}

export function isAnimatedTransformEdit(mode: TransformEditMode): boolean {
  return mode === "animated";
}

export type SelectedKeyframe = {
  targetKind: "layer" | "composition";
  targetId: string;
  frame: number;
  originFrame?: number;
  property: "position" | "opacity" | "scale" | "rotation";
} | null;
