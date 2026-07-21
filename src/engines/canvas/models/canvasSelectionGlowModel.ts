import type { CanvasSelectionProjection } from "@/engines/canvas/models/canvasDirectSelectionModel";
import type { SelectionSourceAlphaEntry } from "@/engines/canvas/models/canvasSelectionAlphaModel";

export type CanvasSelectionGlowViewModel = {
  readonly attachCanvas: (canvas: HTMLCanvasElement | null) => void;
};

export type CanvasSelectionGlowDrawInput = {
  readonly entry: SelectionSourceAlphaEntry;
  readonly projection: CanvasSelectionProjection;
  readonly viewportSize: { readonly width: number; readonly height: number };
  readonly devicePixelRatio: number;
};

export type CanvasSelectionGlowDrawResult = {
  readonly visualFingerprint: string;
  readonly scratchRebuilt: boolean;
};

export type CanvasSelectionGlowRenderer = {
  readonly draw: (
    target: HTMLCanvasElement,
    input: CanvasSelectionGlowDrawInput
  ) => CanvasSelectionGlowDrawResult | null;
  readonly clearSelection: (target: HTMLCanvasElement | null) => void;
  readonly dispose: (target: HTMLCanvasElement | null) => void;
};
