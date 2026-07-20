import { getPreviewMemorySourceKey } from "@/engines/canvas/helpers/previewMemoryHelpers";
import type { PreviewCacheKeyInput } from "@/engines/canvas/models/previewCacheModel";

function normalizeLogicalDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function buildPreviewCacheKey(input: PreviewCacheKeyInput): string {
  return JSON.stringify([
    "preview-cache",
    getPreviewMemorySourceKey(input),
    input.sourceFingerprint,
    input.quality,
    normalizeLogicalDimension(input.logicalSize.width),
    normalizeLogicalDimension(input.logicalSize.height),
  ]);
}
