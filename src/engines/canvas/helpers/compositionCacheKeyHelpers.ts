import type { CompositionPreviewCacheKeyInput } from "@/engines/canvas/models/compositionCacheModel";
import type { CompositionPreviewNode } from "@/render";

function normalizeScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function buildCompositionPreviewCacheKey(
  input: CompositionPreviewCacheKeyInput
): string {
  return [
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

export function isCompositionPreviewSurfaceContentEqual(
  previous: CompositionPreviewNode,
  next: CompositionPreviewNode
): boolean {
  return (
    previous.targetCompId === next.targetCompId &&
    previous.logicalSize.width === next.logicalSize.width &&
    previous.logicalSize.height === next.logicalSize.height &&
    previous.children.length === next.children.length &&
    previous.children.every(
      (child, index) => child === next.children[index]
    )
  );
}
