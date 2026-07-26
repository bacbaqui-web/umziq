import type {
  SelectionAlphaBrowserAdapter,
  SelectionSourceAlphaDescriptor,
  SelectionSourceAlphaEntry,
  SelectionSubCompositionAlphaChild,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

type SelectionAlphaCanvasFactory = () => HTMLCanvasElement;

function dimension(value: number) {
  return Number.isFinite(value) && value > 0
    ? Math.ceil(value)
    : 0;
}

function opacity(value: number) {
  return Number.isFinite(value)
    ? Math.min(1, Math.max(0, value / 100))
    : 0;
}

function applyTransform(
  context: CanvasRenderingContext2D,
  child: SelectionSubCompositionAlphaChild
) {
  const { logicalSize } = child.source;
  const { transform } = child;
  const x =
    transform.position.x +
    transform.transformOffset.x -
    logicalSize.width / 2;
  const y =
    transform.position.y +
    transform.transformOffset.y -
    logicalSize.height / 2;
  context.translate(x, y);
  context.translate(transform.anchor.x, transform.anchor.y);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(
    transform.scale.x / 100,
    transform.scale.y / 100
  );
  context.translate(-transform.anchor.x, -transform.anchor.y);
}

function createEntry(
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
        pixelX < 0 ||
        pixelY < 0 ||
        pixelX >= width ||
        pixelY >= height
      ) {
        return 0;
      }
      return (
        alphaBytes[pixelY * width + pixelX] ?? 0
      );
    },
  };
}

export function createCanvasSelectionAlphaBrowserAdapter(
  createCanvas: SelectionAlphaCanvasFactory = () =>
    document.createElement("canvas")
): SelectionAlphaBrowserAdapter {
  const buildSurface = (
    descriptor: SelectionSourceAlphaDescriptor,
    temporary: HTMLCanvasElement[],
    isRoot = false
  ): HTMLCanvasElement | null => {
    const width = dimension(descriptor.logicalSize.width);
    const height = dimension(descriptor.logicalSize.height);
    if (
      !descriptor.visible ||
      descriptor.opacity <= 0 ||
      width <= 0 ||
      height <= 0
    ) {
      return null;
    }
    const canvas = createCanvas();
    canvas.width = width;
    canvas.height = height;
    temporary.push(canvas);
    const context =
      canvas.getContext("2d", {
        willReadFrequently: true,
      }) ?? canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, width, height);
    if (descriptor.kind === "layer") {
      context.globalAlpha = isRoot
        ? 1
        : opacity(descriptor.opacity);
      context.drawImage(
        descriptor.sourceCanvas,
        0,
        0,
        descriptor.logicalSize.width,
        descriptor.logicalSize.height
      );
      return canvas;
    }
    if (descriptor.kind === "solid") {
      context.globalAlpha = isRoot
        ? 1
        : opacity(descriptor.opacity);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      return canvas;
    }
    descriptor.orderedChildren.forEach((child) => {
      if (!child.source.visible || child.source.opacity <= 0) {
        return;
      }
      context.save();
      applyTransform(context, child);
      if (child.source.kind === "layer") {
        context.globalAlpha = opacity(child.source.opacity);
        context.drawImage(
          child.source.sourceCanvas,
          0,
          0,
          child.source.logicalSize.width,
          child.source.logicalSize.height
        );
      } else if (child.source.kind === "solid") {
        context.globalAlpha = opacity(child.source.opacity);
        context.fillStyle = "#fff";
        context.fillRect(
          0,
          0,
          child.source.logicalSize.width,
          child.source.logicalSize.height
        );
      } else {
        const childSurface = buildSurface(
          child.source,
          temporary
        );
        if (childSurface) {
          context.drawImage(
            childSurface,
            0,
            0,
            child.source.logicalSize.width,
            child.source.logicalSize.height
          );
        }
      }
      context.restore();
    });
    if (!isRoot && descriptor.opacity < 100) {
      context.save();
      context.globalCompositeOperation = "destination-in";
      context.globalAlpha = opacity(descriptor.opacity);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.restore();
    }
    return canvas;
  };

  return {
    build: (descriptor, visualFingerprint) => {
      const width = dimension(descriptor.logicalSize.width);
      const height = dimension(descriptor.logicalSize.height);
      const temporary: HTMLCanvasElement[] = [];
      try {
        const surface = buildSurface(
          descriptor,
          temporary,
          true
        );
        const context =
          surface?.getContext("2d", {
            willReadFrequently: true,
          }) ?? surface?.getContext("2d");
        if (!surface || !context) {
          return {
            status: "unavailable",
            visualFingerprint,
            reason: "context-unavailable",
          };
        }
        const rgba = context.getImageData(
          0,
          0,
          width,
          height
        ).data;
        const alphaBytes = new Uint8Array(width * height);
        for (let index = 0; index < alphaBytes.length; index += 1) {
          alphaBytes[index] = rgba[index * 4 + 3] ?? 0;
        }
        return {
          status: "ready",
          entry: createEntry(
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
          reason:
            error instanceof DOMException &&
            error.name === "SecurityError"
              ? "readback-blocked"
              : "draw-failed",
        };
      } finally {
        temporary.forEach((canvas) => {
          canvas.width = 1;
          canvas.height = 1;
        });
      }
    },
  };
}
