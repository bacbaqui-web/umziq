import type { PreviewSurfaceCacheKeyInput } from "@/engines/canvas/models/surfaceCacheModel";

function normalizeScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getPixelSize(logicalSize: number, scale: number): number {
  return Math.max(1, Math.ceil(logicalSize * scale));
}

export function buildPreviewSurfaceCacheKey(
  input: PreviewSurfaceCacheKeyInput
): string {
  const previewScale = normalizeScale(input.previewScale);
  const pixelWidth = getPixelSize(input.logicalWidth, previewScale);
  const pixelHeight = getPixelSize(input.logicalHeight, previewScale);

  return [
    "quality",
    input.previewQuality,
    "scale",
    previewScale,
    "logical",
    input.logicalWidth,
    input.logicalHeight,
    "pixel",
    pixelWidth,
    pixelHeight,
  ].join(":");
}
