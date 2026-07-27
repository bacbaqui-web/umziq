import type { EditorPlaceholderDescriptor } from "@/render/models/editorPlaceholderModel";
import type { Canvas2DRenderContext } from "@/render/adapters/canvas2dRenderAdapter";

export function drawEditorPlaceholderToContext(
  context: Canvas2DRenderContext,
  descriptor: EditorPlaceholderDescriptor
): void {
  const { width, height } = descriptor.size;
  context.fillStyle = descriptor.fill;
  context.fillRect(0, 0, width, height);
  if (!descriptor.label) return;

  context.fillStyle = descriptor.textColor;
  context.font = "600 20px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(descriptor.label, width / 2, height / 2);
}
