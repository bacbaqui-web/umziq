import type {
  SelectionAlphaBrowserAdapter,
  SelectionSourceAlphaDescriptor,
  SelectionSourceAlphaEntry,
  SelectionSourceAlphaResult,
  SelectionSubCompositionAlphaChild,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

type SelectionAlphaCanvasFactory = () => HTMLCanvasElement;

function toPixelDimension(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
}

function normalizeOpacity(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / 100));
}

function disposeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 1;
  canvas.height = 1;
}

function createAlphaEntry(
  visualFingerprint: string,
  width: number,
  height: number,
  alphaBytes: Uint8Array
): SelectionSourceAlphaEntry {
  return {
    visualFingerprint,
    width,
    height,
    alphaBytes,
    sample: (x, y) => {
      const pixelX = Math.floor(x);
      const pixelY = Math.floor(y);
      if (
        !Number.isFinite(pixelX) ||
        !Number.isFinite(pixelY) ||
        pixelX < 0 ||
        pixelY < 0 ||
        pixelX >= width ||
        pixelY >= height
      ) {
        return 0;
      }
      return alphaBytes[pixelY * width + pixelX] ?? 0;
    },
  };
}

function applyTransform(
  context: CanvasRenderingContext2D,
  child: SelectionSubCompositionAlphaChild
) {
  const { logicalSize } = child.source;
  const { transform } = child;
  const origin = {
    x:
      transform.position.x +
      transform.transformOffset.x -
      logicalSize.width / 2,
    y:
      transform.position.y +
      transform.transformOffset.y -
      logicalSize.height / 2,
  };
  context.translate(origin.x, origin.y);
  context.translate(transform.anchor.x, transform.anchor.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.scale.x / 100, transform.scale.y / 100);
  context.translate(-transform.anchor.x, -transform.anchor.y);
}

function applySurfaceOpacity(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity: number
) {
  const normalized = normalizeOpacity(opacity);
  if (normalized >= 1) return;
  context.save();
  context.globalCompositeOperation = "destination-in";
  context.globalAlpha = normalized;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.restore();
}

function get2dContext(canvas: HTMLCanvasElement) {
  return (
    canvas.getContext("2d", { willReadFrequently: true }) ??
    canvas.getContext("2d")
  );
}

function classifyBuildError(error: unknown) {
  return error instanceof DOMException && error.name === "SecurityError"
    ? "readback-blocked" as const
    : "draw-failed" as const;
}

export function createCanvasSelectionAlphaBrowserAdapter(
  createCanvas: SelectionAlphaCanvasFactory = () =>
    document.createElement("canvas")
): SelectionAlphaBrowserAdapter {
  const buildSurface = (
    descriptor: SelectionSourceAlphaDescriptor,
    temporaryCanvases: HTMLCanvasElement[],
    isRoot = false
  ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null => {
    const width = toPixelDimension(descriptor.logicalSize.width);
    const height = toPixelDimension(descriptor.logicalSize.height);
    if (!descriptor.visible || width <= 0 || height <= 0 || descriptor.opacity <= 0) {
      return null;
    }

    const canvas = createCanvas();
    canvas.width = width;
    canvas.height = height;
    temporaryCanvases.push(canvas);
    const context = get2dContext(canvas);
    if (!context) return null;
    context.clearRect(0, 0, width, height);

    if (descriptor.kind === "layer") {
      context.save();
      context.globalAlpha = isRoot ? 1 : normalizeOpacity(descriptor.opacity);
      context.drawImage(
        descriptor.sourceCanvas,
        0,
        0,
        descriptor.logicalSize.width,
        descriptor.logicalSize.height
      );
      context.restore();
      return { canvas, context };
    }

    if (descriptor.kind === "solid") {
      context.globalAlpha = isRoot ? 1 : normalizeOpacity(descriptor.opacity);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      return { canvas, context };
    }

    descriptor.orderedChildren.forEach((child) => {
      if (!child.source.visible || child.source.opacity <= 0) return;
      context.save();
      applyTransform(context, child);
      if (child.source.kind === "layer") {
        context.globalAlpha = normalizeOpacity(child.source.opacity);
        context.drawImage(
          child.source.sourceCanvas,
          0,
          0,
          child.source.logicalSize.width,
          child.source.logicalSize.height
        );
      } else if (child.source.kind === "solid") {
        context.globalAlpha = normalizeOpacity(child.source.opacity);
        context.fillStyle = "#fff";
        context.fillRect(
          0,
          0,
          child.source.logicalSize.width,
          child.source.logicalSize.height
        );
      } else {
        const childSurface = buildSurface(child.source, temporaryCanvases);
        if (childSurface) {
          context.drawImage(
            childSurface.canvas,
            0,
            0,
            child.source.logicalSize.width,
            child.source.logicalSize.height
          );
        }
      }
      context.restore();
    });
    if (!isRoot) applySurfaceOpacity(context, width, height, descriptor.opacity);
    return { canvas, context };
  };

  return {
    build: (descriptor, visualFingerprint): SelectionSourceAlphaResult => {
      const width = toPixelDimension(descriptor.logicalSize.width);
      const height = toPixelDimension(descriptor.logicalSize.height);
      if (!descriptor.visible || width <= 0 || height <= 0 || descriptor.opacity <= 0) {
        return {
          status: "unavailable",
          visualFingerprint,
          reason: "invalid-descriptor",
        };
      }

      const temporaryCanvases: HTMLCanvasElement[] = [];
      try {
        const surface = buildSurface(descriptor, temporaryCanvases, true);
        if (!surface) {
          return {
            status: "unavailable",
            visualFingerprint,
            reason: "context-unavailable",
          };
        }
        const rgba = surface.context.getImageData(0, 0, width, height).data;
        const alphaBytes = new Uint8Array(width * height);
        for (let index = 0; index < alphaBytes.length; index += 1) {
          alphaBytes[index] = rgba[index * 4 + 3] ?? 0;
        }
        return {
          status: "ready",
          entry: createAlphaEntry(
            visualFingerprint,
            width,
            height,
            alphaBytes
          ),
        };
      } catch (error) {
        return {
          status: "unavailable",
          visualFingerprint,
          reason: classifyBuildError(error),
        };
      } finally {
        temporaryCanvases.forEach(disposeCanvas);
      }
    },
  };
}
