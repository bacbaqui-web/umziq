import type { CompositionPreviewCacheKeyInput } from "@/engines/canvas/models/compositionCacheModel";

function normalizeScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function buildCompositionPreviewCacheKey(
  input: CompositionPreviewCacheKeyInput
): string {
  return [
    "renderer",
    input.rendererMode,
    "quality",
    input.previewQuality,
    "scale",
    normalizeScale(input.previewScale),
    "node",
    input.node.id,
    "size",
    input.node.logicalSize.width,
    input.node.logicalSize.height,
    "runtime",
    input.runtimeId ?? "default",
  ].join(":");
}
