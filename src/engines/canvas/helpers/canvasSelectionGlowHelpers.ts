import {
  CANVAS_SELECTION_GLOW_BLUR_CSS_PIXELS,
  CANVAS_SELECTION_GLOW_RGBA,
} from "@/engines/canvas/constants/canvasSelectionGlowConstants";
import { SELECTION_ALPHA_THRESHOLD } from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import type {
  CanvasSelectionGlowDrawInput,
} from "@/engines/canvas/models/canvasSelectionGlowModel";
import type {
  SelectionSourceAlphaEntry,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

export function buildCanvasSelectionGlowMaskRgba(
  entry: SelectionSourceAlphaEntry
): Uint8ClampedArray | null {
  const pixelCount = entry.width * entry.height;
  if (!Number.isInteger(entry.width) || !Number.isInteger(entry.height) ||
      entry.width <= 0 || entry.height <= 0 || entry.alphaBytes.length !== pixelCount) {
    return null;
  }
  const rgba = new Uint8ClampedArray(pixelCount * 4);
  for (let index = 0; index < pixelCount; index += 1) {
    if ((entry.alphaBytes[index] ?? 0) <= SELECTION_ALPHA_THRESHOLD) continue;
    rgba[index * 4] = CANVAS_SELECTION_GLOW_RGBA[0];
    rgba[index * 4 + 1] = CANVAS_SELECTION_GLOW_RGBA[1];
    rgba[index * 4 + 2] = CANVAS_SELECTION_GLOW_RGBA[2];
    rgba[index * 4 + 3] = 255;
  }
  return rgba;
}

export function buildCanvasSelectionGlowDrawPlan(
  input: CanvasSelectionGlowDrawInput
) {
  const dpr = Number.isFinite(input.devicePixelRatio)
    ? Math.max(1, input.devicePixelRatio)
    : 1;
  const matrix = input.projection.sourceToViewport;
  return {
    backingSize: {
      width: Math.max(1, Math.ceil(input.viewportSize.width * dpr)),
      height: Math.max(1, Math.ceil(input.viewportSize.height * dpr)),
    },
    sourceToDevice: {
      a: matrix.a * dpr,
      b: matrix.b * dpr,
      c: matrix.c * dpr,
      d: matrix.d * dpr,
      e: matrix.e * dpr,
      f: matrix.f * dpr,
    },
    blurDevicePixels: CANVAS_SELECTION_GLOW_BLUR_CSS_PIXELS * dpr,
    glowAlpha: CANVAS_SELECTION_GLOW_RGBA[3] / 255,
    compositeSequence: [
      "clear-viewport",
      "draw-blurred-selected-mask",
      "destination-out-selected-interior",
    ] as const,
  };
}
