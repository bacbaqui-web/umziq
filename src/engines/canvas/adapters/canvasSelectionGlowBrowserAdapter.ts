import {
  buildCanvasSelectionGlowDrawPlan,
  buildCanvasSelectionGlowMaskRgba,
} from "@/engines/canvas/helpers/canvasSelectionGlowHelpers";
import type {
  CanvasSelectionGlowDrawInput,
  CanvasSelectionGlowRenderer,
} from "@/engines/canvas/models/canvasSelectionGlowModel";

type GlowRendererEvent = {
  readonly type: "scratch-build" | "scratch-reuse" | "draw" | "clear" | "dispose";
  readonly visualFingerprint: string | null;
};

type CreateCanvasSelectionGlowRendererOptions = {
  createCanvas?: () => HTMLCanvasElement;
  observe?: (event: GlowRendererEvent) => void;
};

function disposeCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  canvas.width = 1;
  canvas.height = 1;
}

function clearTarget(target: HTMLCanvasElement | null) {
  if (!target) return;
  target.getContext("2d")?.clearRect(0, 0, target.width, target.height);
}

function releaseTarget(target: HTMLCanvasElement | null) {
  if (!target) return;
  clearTarget(target);
  target.width = 1;
  target.height = 1;
}

export function createCanvasSelectionGlowRenderer({
  createCanvas = () => document.createElement("canvas"),
  observe,
}: CreateCanvasSelectionGlowRendererOptions = {}): CanvasSelectionGlowRenderer {
  let scratch: HTMLCanvasElement | null = null;
  let scratchFingerprint: string | null = null;

  const releaseScratch = () => {
    disposeCanvas(scratch);
    scratch = null;
    scratchFingerprint = null;
  };

  const ensureScratch = (input: CanvasSelectionGlowDrawInput) => {
    if (scratch && scratchFingerprint === input.entry.visualFingerprint) {
      observe?.({ type: "scratch-reuse", visualFingerprint: scratchFingerprint });
      return { canvas: scratch, rebuilt: false };
    }
    releaseScratch();
    const rgba = buildCanvasSelectionGlowMaskRgba(input.entry);
    if (!rgba) return null;
    const next = createCanvas();
    next.width = input.entry.width;
    next.height = input.entry.height;
    const context = next.getContext("2d");
    if (!context) {
      disposeCanvas(next);
      return null;
    }
    const imageData = context.createImageData(input.entry.width, input.entry.height);
    imageData.data.set(rgba);
    context.putImageData(imageData, 0, 0);
    scratch = next;
    scratchFingerprint = input.entry.visualFingerprint;
    observe?.({ type: "scratch-build", visualFingerprint: scratchFingerprint });
    return { canvas: next, rebuilt: true };
  };

  return {
    draw: (target, input) => {
      const selectedScratch = ensureScratch(input);
      if (!selectedScratch) {
        clearTarget(target);
        return null;
      }
      const plan = buildCanvasSelectionGlowDrawPlan(input);
      if (target.width !== plan.backingSize.width) target.width = plan.backingSize.width;
      if (target.height !== plan.backingSize.height) target.height = plan.backingSize.height;
      const context = target.getContext("2d");
      if (!context) return null;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, target.width, target.height);
      const matrix = plan.sourceToDevice;
      context.save();
      context.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      context.filter = `blur(${plan.blurDevicePixels}px)`;
      context.globalAlpha = plan.glowAlpha;
      context.drawImage(selectedScratch.canvas, 0, 0);
      context.restore();
      context.save();
      context.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = 1;
      context.filter = "none";
      context.drawImage(selectedScratch.canvas, 0, 0);
      context.restore();
      observe?.({ type: "draw", visualFingerprint: input.entry.visualFingerprint });
      return {
        visualFingerprint: input.entry.visualFingerprint,
        scratchRebuilt: selectedScratch.rebuilt,
      };
    },
    clearSelection: (target) => {
      releaseTarget(target);
      releaseScratch();
      observe?.({ type: "clear", visualFingerprint: null });
    },
    dispose: (target) => {
      releaseTarget(target);
      releaseScratch();
      observe?.({ type: "dispose", visualFingerprint: null });
    },
  };
}
