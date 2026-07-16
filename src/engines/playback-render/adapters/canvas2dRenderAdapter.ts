import type {
  EvaluatedRenderTransform,
  RenderCommand,
  RenderFrame,
} from "@/engines/playback-render/models/renderFrameModel";

export type Canvas2DRenderContext = Pick<
  CanvasRenderingContext2D,
  | "clearRect"
  | "save"
  | "restore"
  | "translate"
  | "rotate"
  | "scale"
  | "drawImage"
  | "globalAlpha"
>;

export type RenderSurface = {
  canvas: HTMLCanvasElement;
  context: Canvas2DRenderContext;
};

export type RenderSurfaceFactory = (
  width: number,
  height: number
) => RenderSurface | null;

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
  createSurface: RenderSurfaceFactory
) {
  commands.forEach((command) => {
    if (command.type === "drawable") {
      context.save();
      context.globalAlpha = command.opacity / 100;
      applyTransform(context, command.transform);
      context.drawImage(command.canvas, 0, 0);
      context.restore();
      return;
    }

    const surface = createSurface(command.width, command.height);

    if (!surface) {
      return;
    }

    drawRenderCommandsToContext(surface.context, command.children, createSurface);
    context.save();
    context.globalAlpha = command.opacity / 100;
    applyTransform(context, command.transform);
    context.drawImage(surface.canvas, 0, 0);
    context.restore();
  });
}

function createBrowserSurface(width: number, height: number): RenderSurface | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const context = canvas.getContext("2d");

  return context ? { canvas, context } : null;
}

export function renderFrameToCanvas(
  canvas: HTMLCanvasElement,
  frame: RenderFrame,
  createSurface: RenderSurfaceFactory = createBrowserSurface
) {
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, frame.width, frame.height);
  drawRenderCommandsToContext(context, frame.commands, createSurface);
}
