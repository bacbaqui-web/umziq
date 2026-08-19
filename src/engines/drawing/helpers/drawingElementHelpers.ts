import type { PlainDataObject } from "@/models";

export function createDrawingStroke(options: {
  tool: "brush" | "eraser";
  color: string;
  size: number;
  points: readonly { x: number; y: number }[];
}): PlainDataObject {
  return {
    kind: "stroke",
    tool: options.tool,
    color: options.color,
    size: options.size,
    points: options.points.map((point) => ({ x: point.x, y: point.y })),
  };
}

export function createDrawingFill(color: string): PlainDataObject {
  return { kind: "fill", color };
}

function rgb(color: string) {
  const value = color.replace("#", "");
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16), 255];
}

export async function fillDrawingRegion(options: {
  elements: readonly PlainDataObject[]; width: number; height: number;
  point: { x: number; y: number }; color: string;
}): Promise<PlainDataObject> {
  const canvas = document.createElement("canvas"); canvas.width = options.width; canvas.height = options.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Drawing surface is unavailable");
  for (const element of options.elements) {
    if (element.kind === "raster" && typeof element.dataUrl === "string") {
      const image = new Image(); image.src = element.dataUrl; await image.decode();
      context.drawImage(image, 0, 0, options.width, options.height);
    } else if (element.kind === "fill" && typeof element.color === "string") {
      context.fillStyle = element.color; context.fillRect(0, 0, options.width, options.height);
    } else if (element.kind === "stroke" && Array.isArray(element.points) && typeof element.size === "number") {
      const points = element.points as { x: number; y: number }[]; if (!points[0]) continue;
      context.save(); context.globalCompositeOperation = element.tool === "eraser" ? "destination-out" : "source-over";
      context.strokeStyle = String(element.color); context.lineWidth = element.size;
      context.lineCap = "round"; context.lineJoin = "round"; context.beginPath();
      context.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke(); context.restore();
    }
  }
  const image = context.getImageData(0, 0, options.width, options.height);
  const x = Math.max(0, Math.min(options.width - 1, Math.floor(options.point.x)));
  const y = Math.max(0, Math.min(options.height - 1, Math.floor(options.point.y)));
  const start = (y * options.width + x) * 4;
  const target = Array.from(image.data.slice(start, start + 4)); const replacement = rgb(options.color);
  if (target.every((value, index) => value === replacement[index]))
    return { kind: "raster", width: options.width, height: options.height, dataUrl: canvas.toDataURL("image/png") };
  const stack = [x, y]; const seen = new Uint8Array(options.width * options.height);
  while (stack.length) {
    const cy = stack.pop()!; const cx = stack.pop()!; const pixel = cy * options.width + cx;
    if (seen[pixel]) continue; seen[pixel] = 1; const offset = pixel * 4;
    if (!target.every((value, index) => image.data[offset + index] === value)) continue;
    replacement.forEach((value, index) => { image.data[offset + index] = value; });
    if (cx > 0) stack.push(cx - 1, cy); if (cx + 1 < options.width) stack.push(cx + 1, cy);
    if (cy > 0) stack.push(cx, cy - 1); if (cy + 1 < options.height) stack.push(cx, cy + 1);
  }
  context.putImageData(image, 0, 0);
  return { kind: "raster", width: options.width, height: options.height, dataUrl: canvas.toDataURL("image/png") };
}
