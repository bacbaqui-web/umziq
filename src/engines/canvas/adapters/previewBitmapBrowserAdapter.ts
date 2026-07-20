import type { RenderSize } from "@/engines/playback-render";
import type { PreviewBitmapCreationAdapter } from "@/engines/canvas/models/previewBitmapFactoryModel";
import type { PreviewBitmapImage } from "@/engines/canvas/models/previewRuntimeModel";

type PreviewCopyCanvas = HTMLCanvasElement | OffscreenCanvas;

export type PreviewBitmapBrowserDependencies = {
  readonly createImageBitmap:
    | ((
        sourceCanvas: HTMLCanvasElement,
        options: ImageBitmapOptions
      ) => Promise<ImageBitmap>)
    | null;
  readonly createCopyCanvas: (pixelSize: RenderSize) => PreviewCopyCanvas;
};

function createDefaultCopyCanvas(pixelSize: RenderSize): PreviewCopyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(pixelSize.width, pixelSize.height);
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = pixelSize.width;
    canvas.height = pixelSize.height;
    return canvas;
  }

  throw new Error("Preview bitmap fallback canvas is unavailable");
}

function resolveDefaultDependencies(): PreviewBitmapBrowserDependencies {
  return {
    createImageBitmap:
      typeof globalThis.createImageBitmap === "function"
        ? (sourceCanvas, options) =>
            globalThis.createImageBitmap(sourceCanvas, options)
        : null,
    createCopyCanvas: createDefaultCopyCanvas,
  };
}

function createFallbackBitmap(
  sourceCanvas: HTMLCanvasElement,
  pixelSize: RenderSize,
  createCopyCanvas: (pixelSize: RenderSize) => PreviewCopyCanvas
): PreviewCopyCanvas {
  const bitmap = createCopyCanvas(pixelSize);
  bitmap.width = pixelSize.width;
  bitmap.height = pixelSize.height;
  const context = bitmap.getContext("2d");
  if (!context) throw new Error("Preview bitmap fallback context is unavailable");
  context.drawImage(sourceCanvas, 0, 0, pixelSize.width, pixelSize.height);
  return bitmap;
}

function disposeBitmap(bitmap: PreviewBitmapImage): void {
  const close = (bitmap as { close?: () => void }).close;
  if (typeof close === "function") {
    close.call(bitmap);
    return;
  }

  const canvas = bitmap as HTMLCanvasElement | OffscreenCanvas;
  canvas.width = 0;
  canvas.height = 0;
}

export function createPreviewBitmapBrowserAdapter(
  dependencies: PreviewBitmapBrowserDependencies = resolveDefaultDependencies()
): PreviewBitmapCreationAdapter {
  return {
    createBitmap: async (sourceCanvas, pixelSize) => {
      if (!dependencies.createImageBitmap) return null;
      return dependencies.createImageBitmap(sourceCanvas, {
        resizeWidth: pixelSize.width,
        resizeHeight: pixelSize.height,
        resizeQuality: "high",
      });
    },
    createFallbackBitmap: (sourceCanvas, pixelSize) =>
      createFallbackBitmap(
        sourceCanvas,
        pixelSize,
        dependencies.createCopyCanvas
      ),
    disposeBitmap,
  };
}

export const previewBitmapBrowserAdapter =
  createPreviewBitmapBrowserAdapter();
