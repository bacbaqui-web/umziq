import type { CanvasSelectionProjection } from "@/engines/canvas/models/canvasDirectSelectionModel";
import type { SelectionSourceAlphaEntry } from "@/engines/canvas/models/canvasSelectionAlphaModel";

export type CanvasSelectionHighlightViewModel = {
  readonly attachCanvas: (canvas: HTMLCanvasElement | null) => void;
};

export type CanvasSelectionHighlightDrawInput = {
  readonly entry: SelectionSourceAlphaEntry;
  readonly projection: CanvasSelectionProjection;
  readonly viewportSize: { readonly width: number; readonly height: number };
  readonly devicePixelRatio: number;
};

export type CanvasSelectionHighlightDrawResult = {
  readonly visualFingerprint: string;
  readonly scratchRebuilt: boolean;
};

export type CanvasSelectionHighlightRenderer = {
  readonly draw: (
    target: HTMLCanvasElement,
    input: CanvasSelectionHighlightDrawInput
  ) => CanvasSelectionHighlightDrawResult | null;
  readonly clearSelection: (target: HTMLCanvasElement | null) => void;
  readonly dispose: (target: HTMLCanvasElement | null) => void;
};
