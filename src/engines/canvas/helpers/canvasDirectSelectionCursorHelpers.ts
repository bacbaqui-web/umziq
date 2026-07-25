export function resolveCanvasPreviewCursor(options: {
  isPreviewPanning: boolean;
  isPreviewPanModifierActive: boolean;
  isDraggingPosition: boolean;
  isAlphaHit: boolean;
}): "default" | "grab" | "grabbing" | "pointer" {
  if (options.isPreviewPanning) return "grabbing";
  if (options.isPreviewPanModifierActive) return "grab";
  if (options.isDraggingPosition) return "grabbing";
  if (options.isAlphaHit) return "pointer";
  return "default";
}
