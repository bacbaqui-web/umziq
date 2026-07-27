import type {
  EvaluatedRenderTransform,
  RenderCommand,
  RenderFrame,
} from "@/render/models/renderFrameModel";
import type { RuntimeMetricRecordPort } from "@/render/models/runtimeMetricPortModel";
import { drawEditorPlaceholderToContext } from "@/render/adapters/editorPlaceholderCanvas2dAdapter";

export type Canvas2DRenderContext = Pick<
  CanvasRenderingContext2D,
  | "clearRect"
  | "beginPath"
  | "rect"
  | "clip"
  | "save"
  | "restore"
  | "translate"
  | "rotate"
  | "scale"
  | "drawImage"
  | "fillRect"
  | "fillText"
  | "setTransform"
  | "globalAlpha"
  | "fillStyle"
  | "font"
  | "textAlign"
  | "textBaseline"
>;

export type RenderSurface = {
  canvas: HTMLCanvasElement;
  context: Canvas2DRenderContext;
};

export type RenderSurfaceFactory = (
  logicalWidth: number,
  logicalHeight: number,
  pixelScale: number
) => RenderSurface | null;

export type ReusableAccurateSurfaceFactory = {
  beginFrame: () => void;
  endFrame: () => void;
  createSurface: RenderSurfaceFactory;
  dispose: () => void;
};

type CanvasElementFactory = () => HTMLCanvasElement;

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function applyTransform(
  context: Canvas2DRenderContext,
  transform: EvaluatedRenderTransform
) {
  context.translate(transform.origin.x, transform.origin.y);
  context.translate(transform.anchor.x, transform.anchor.y);
  context.rotate(degreesToRadians(transform.rotation));
  context.scale(transform.scale.x / 100, transform.scale.y / 100);
  context.translate(-transform.anchor.x, -transform.anchor.y);
}

export function drawRenderCommandsToContext(
  context: Canvas2DRenderContext,
  commands: readonly RenderCommand[],
  createSurface: RenderSurfaceFactory,
  pixelScale = 1,
  runtimeMetrics?: RuntimeMetricRecordPort
) {
  for (
    let index = commands.length - 1;
    index >= 0;
    index -= 1
  ) {
    const command = commands[index];
    if (!command) continue;
    runtimeMetrics?.increment("painterTraversal");
    if (command.type === "drawable") {
      context.save();
      context.globalAlpha = command.opacity / 100;
      applyTransform(context, command.transform);
      context.drawImage(
        command.source.image,
        0,
        0,
        command.logicalSize.width,
        command.logicalSize.height
      );
      runtimeMetrics?.increment("drawImage");
      context.restore();
      continue;
    }

    if (command.type === "placeholder") {
      context.save();
      context.globalAlpha = command.opacity / 100;
      applyTransform(context, command.transform);
      drawEditorPlaceholderToContext(context, command.placeholder);
      context.restore();
      continue;
    }

    runtimeMetrics?.increment("compositionRender");
    const surface = createSurface(command.width, command.height, pixelScale);

    if (!surface) {
      continue;
    }

    drawRenderCommandsToContext(
      surface.context,
      command.children,
      createSurface,
      pixelScale,
      runtimeMetrics
    );
    context.save();
    context.globalAlpha = command.opacity / 100;
    applyTransform(context, command.transform);
    context.drawImage(surface.canvas, 0, 0, command.width, command.height);
    runtimeMetrics?.increment("drawImage");
    context.restore();
  }
}

function normalizePixelScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getSurfacePixelSize(
  logicalWidth: number,
  logicalHeight: number,
  pixelScale: number
) {
  const scale = normalizePixelScale(pixelScale);
  return {
    width: Math.max(1, Math.ceil(logicalWidth * scale)),
    height: Math.max(1, Math.ceil(logicalHeight * scale)),
    scale,
  };
}

function prepareSurface(
  canvas: HTMLCanvasElement,
  context: Canvas2DRenderContext,
  logicalWidth: number,
  logicalHeight: number,
  pixelScale: number
): RenderSurface {
  const pixelSize = getSurfacePixelSize(
    logicalWidth,
    logicalHeight,
    pixelScale
  );
  if (canvas.width !== pixelSize.width) canvas.width = pixelSize.width;
  if (canvas.height !== pixelSize.height) canvas.height = pixelSize.height;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelSize.width, pixelSize.height);
  context.setTransform(pixelSize.scale, 0, 0, pixelSize.scale, 0, 0);
  return { canvas, context };
}

function createBrowserSurface(
  width: number,
  height: number,
  pixelScale: number
): RenderSurface | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  return context
    ? prepareSurface(canvas, context, width, height, pixelScale)
    : null;
}

export function createReusableAccurateSurfaceFactory(
  createCanvas: CanvasElementFactory = () => document.createElement("canvas"),
  runtimeMetrics?: RuntimeMetricRecordPort
): ReusableAccurateSurfaceFactory {
  const surfaces: RenderSurface[] = [];
  let nextSurfaceIndex = 0;

  return {
    beginFrame: () => {
      nextSurfaceIndex = 0;
    },
    endFrame: () => {
      const unusedSurfaces = surfaces.splice(nextSurfaceIndex);
      unusedSurfaces.forEach(({ canvas }) => {
        canvas.width = 1;
        canvas.height = 1;
      });
    },
    createSurface: (width, height, pixelScale) => {
      const existing = surfaces[nextSurfaceIndex];
      nextSurfaceIndex += 1;
      if (existing) {
        runtimeMetrics?.increment("surfaceReuse");
        return prepareSurface(
          existing.canvas,
          existing.context,
          width,
          height,
          pixelScale
        );
      }

      const canvas = createCanvas();
      const context = canvas.getContext("2d");
      if (!context) return null;
      runtimeMetrics?.increment("surfaceCreate");
      const surface = prepareSurface(
        canvas,
        context,
        width,
        height,
        pixelScale
      );
      surfaces.push(surface);
      return surface;
    },
    dispose: () => {
      surfaces.forEach(({ canvas }) => {
        canvas.width = 1;
        canvas.height = 1;
      });
      surfaces.length = 0;
      nextSurfaceIndex = 0;
    },
  };
}

export function renderAccurateFrameToCanvas(
  canvas: HTMLCanvasElement,
  frame: RenderFrame,
  createSurface: RenderSurfaceFactory = createBrowserSurface,
  pixelScale = 1,
  runtimeMetrics?: RuntimeMetricRecordPort
) {
  runtimeMetrics?.resetFrame?.();
  const pixelSize = getSurfacePixelSize(
    frame.width,
    frame.height,
    pixelScale
  );
  if (canvas.width !== pixelSize.width) canvas.width = pixelSize.width;
  if (canvas.height !== pixelSize.height) canvas.height = pixelSize.height;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelSize.width, pixelSize.height);
  context.setTransform(pixelSize.scale, 0, 0, pixelSize.scale, 0, 0);
  drawRenderCommandsToContext(
    context,
    frame.commands,
    createSurface,
    pixelSize.scale,
    runtimeMetrics
  );
}
