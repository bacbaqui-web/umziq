import type { Composition, Layer } from "@/editor/types/types";

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
