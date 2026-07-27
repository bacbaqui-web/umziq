import {
  buildCanvasSelectionScreenToneDrawPlan,
  buildCanvasSelectionScreenToneGlow,
} from "@/engines/canvas/helpers/canvasSelectionHighlightHelpers";
import type {
  CanvasSelectionHighlightRenderer,
} from "@/engines/canvas/models/canvasSelectionHighlightModel";

function clearTarget(target: HTMLCanvasElement | null) {
  if (!target) return;
  target
    .getContext("2d")
    ?.clearRect(0, 0, target.width, target.height);
}

export function createCanvasSelectionHighlightRenderer({
  createCanvas = () => document.createElement("canvas"),
}: {
  createCanvas?: () => HTMLCanvasElement;
} = {}): CanvasSelectionHighlightRenderer {
  let scratch: HTMLCanvasElement | null = null;
  let scratchFingerprint: string | null = null;
  let scratchOffsetSourcePixels = 0;
  let scratchWidthSourcePixels = 0;
  let scratchHeightSourcePixels = 0;

  const releaseScratch = () => {
    if (scratch) {
      scratch.width = 1;
      scratch.height = 1;
    }
    scratch = null;
    scratchFingerprint = null;
    scratchOffsetSourcePixels = 0;
    scratchWidthSourcePixels = 0;
    scratchHeightSourcePixels = 0;
  };

  const ensureScratch = (
    input: Parameters<
      CanvasSelectionHighlightRenderer["draw"]
    >[1]
  ) => {
    if (
      scratch &&
      scratchFingerprint ===
        input.entry.visualFingerprint
    ) {
      return {
        canvas: scratch,
        offsetSourcePixels:
          scratchOffsetSourcePixels,
        widthSourcePixels:
          scratchWidthSourcePixels,
        heightSourcePixels:
          scratchHeightSourcePixels,
        rebuilt: false,
      };
    }
    releaseScratch();
    const glow = buildCanvasSelectionScreenToneGlow(
      input.entry
    );
    const next = createCanvas();
    next.width = glow.width;
    next.height = glow.height;
    const context = next.getContext("2d");
    if (!context) return null;
    const imageData = context.createImageData(
      glow.width,
      glow.height
    );
    imageData.data.set(glow.rgba);
    context.putImageData(imageData, 0, 0);
    scratch = next;
    scratchFingerprint =
      input.entry.visualFingerprint;
    scratchOffsetSourcePixels =
      glow.offsetSourcePixels;
    scratchWidthSourcePixels =
      glow.widthSourcePixels;
    scratchHeightSourcePixels =
      glow.heightSourcePixels;
    return {
      canvas: next,
      offsetSourcePixels:
        glow.offsetSourcePixels,
      widthSourcePixels:
        glow.widthSourcePixels,
      heightSourcePixels:
        glow.heightSourcePixels,
      rebuilt: true,
    };
  };

  return {
    draw: (target, input) => {
      const glow = ensureScratch(input);
      if (!glow) return null;
      const plan =
        buildCanvasSelectionScreenToneDrawPlan(input);
      if (target.width !== plan.backingSize.width) {
        target.width = plan.backingSize.width;
      }
      if (target.height !== plan.backingSize.height) {
        target.height = plan.backingSize.height;
      }
      const context = target.getContext("2d");
      if (!context) return null;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, target.width, target.height);
      const matrix = plan.sourceToDevice;
      context.setTransform(
        matrix.a,
        matrix.b,
        matrix.c,
        matrix.d,
        matrix.e,
        matrix.f
      );
      context.imageSmoothingEnabled = false;
      context.drawImage(
        glow.canvas,
        -glow.offsetSourcePixels,
        -glow.offsetSourcePixels,
        glow.widthSourcePixels,
        glow.heightSourcePixels
      );
      return {
        visualFingerprint:
          input.entry.visualFingerprint,
        scratchRebuilt: glow.rebuilt,
      };
    },
    clearSelection: (target) => {
      clearTarget(target);
      releaseScratch();
      if (target) {
        target.width = 1;
        target.height = 1;
      }
    },
    dispose: (target) => {
      clearTarget(target);
      releaseScratch();
    },
  };
}
