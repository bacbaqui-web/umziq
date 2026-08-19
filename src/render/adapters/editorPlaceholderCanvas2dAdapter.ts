import type { EditorPlaceholderDescriptor } from "@/render/models/editorPlaceholderModel";
import type { Canvas2DRenderContext } from "@/render/adapters/canvas2dRenderAdapter";

const drawingRasterImages = new Map<string, HTMLImageElement>();

export function drawEditorPlaceholderToContext(
  context: Canvas2DRenderContext,
  descriptor: EditorPlaceholderDescriptor
): void {
  const { width, height } = descriptor.size;
  if (descriptor.placeholderKind === "drawing") {
    if (typeof document === "undefined") return;
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const drawing = surface.getContext("2d");
    if (!drawing) return;
    for (const element of descriptor.drawingElements ?? []) {
      if (element.kind === "raster" && typeof element.width === "number" &&
        typeof element.height === "number" && typeof element.dataUrl === "string") {
        let image = drawingRasterImages.get(element.dataUrl);
        if (!image) {
          image = new Image();
          image.src = element.dataUrl;
          image.addEventListener("load", () => window.dispatchEvent(new Event("resize")), { once: true });
          drawingRasterImages.set(element.dataUrl, image);
        }
        if (image.complete && image.naturalWidth > 0)
          drawing.drawImage(image, 0, 0, element.width, element.height);
        continue;
      }
      if (element.kind === "fill" && typeof element.color === "string") {
        drawing.fillStyle = element.color;
        drawing.fillRect(0, 0, width, height);
        continue;
      }
      if (
        element.kind !== "stroke" ||
        typeof element.color !== "string" ||
        typeof element.size !== "number" ||
        !Array.isArray(element.points) ||
        element.points.length === 0
      ) continue;
      const points = element.points.filter((point): point is { x: number; y: number } =>
        typeof point === "object" && point !== null &&
        typeof (point as { x?: unknown }).x === "number" &&
        typeof (point as { y?: unknown }).y === "number"
      );
      if (points.length === 0) continue;
      drawing.save();
      drawing.globalCompositeOperation = element.tool === "eraser"
        ? "destination-out"
        : "source-over";
      drawing.strokeStyle = element.color;
      drawing.lineWidth = element.size;
      drawing.lineCap = "round";
      drawing.lineJoin = "round";
      drawing.beginPath();
      drawing.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) drawing.lineTo(point.x, point.y);
      if (points.length === 1) drawing.lineTo(points[0].x + 0.01, points[0].y);
      drawing.stroke();
      drawing.restore();
    }
    context.drawImage(surface, 0, 0, width, height);
    return;
  }
  context.fillStyle = descriptor.fill;
  context.fillRect(0, 0, width, height);
  if (!descriptor.label) return;

  context.fillStyle = descriptor.textColor;
  context.font = "600 20px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(descriptor.label, width / 2, height / 2);
}
