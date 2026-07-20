import type { Canvas2DRenderContext } from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import type {
  PreviewRenderSurface,
  PreviewRenderSurfaceFactory,
} from "@/engines/playback-render/models/previewCanvasRenderModel";
import type { RenderSize } from "@/engines/playback-render/models/renderSourceModel";

function normalizePixelScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getCanvasPixelSize(
  logicalSize: RenderSize,
  pixelScale: number
) {
  const scale = normalizePixelScale(pixelScale);
  return {
    width: Math.max(1, Math.ceil(logicalSize.width * scale)),
    height: Math.max(1, Math.ceil(logicalSize.height * scale)),
    scale,
  };
}

function prepareSurface(
  canvas: HTMLCanvasElement,
  context: Canvas2DRenderContext,
  logicalWidth: number,
  logicalHeight: number,
  pixelScale: number
): PreviewRenderSurface {
  const pixelSize = getCanvasPixelSize(
    { width: logicalWidth, height: logicalHeight },
    pixelScale
  );
  if (canvas.width !== pixelSize.width) canvas.width = pixelSize.width;
  if (canvas.height !== pixelSize.height) canvas.height = pixelSize.height;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelSize.width, pixelSize.height);
  context.setTransform(pixelSize.scale, 0, 0, pixelSize.scale, 0, 0);
  return { canvas, context };
}

export const createBrowserPreviewSurface: PreviewRenderSurfaceFactory = (
  width,
  height,
  pixelScale
) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  return context
    ? prepareSurface(canvas, context, width, height, pixelScale)
    : null;
};
