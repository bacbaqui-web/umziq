import {
  CANVAS_SELECTION_SCREEN_TONE_OUTLINE_SOURCE_PIXELS,
  CANVAS_SELECTION_SCREEN_TONE_RADIUS_SOURCE_PIXELS,
  CANVAS_SELECTION_SCREEN_TONE_RGBA,
  CANVAS_SELECTION_SCREEN_TONE_SAMPLE_SCALE,
} from "@/engines/canvas/constants/canvasSelectionHighlightConstants";
import {
  SELECTION_ALPHA_THRESHOLD,
} from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import type {
  CanvasSelectionHighlightDrawInput,
} from "@/engines/canvas/models/canvasSelectionHighlightModel";
import type {
  SelectionSourceAlphaEntry,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

export type CanvasSelectionScreenToneGlow = {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly offsetSourcePixels: number;
  readonly widthSourcePixels: number;
  readonly heightSourcePixels: number;
  readonly rgba: Uint8ClampedArray;
};

function buildOutsideDistance(
  entry: SelectionSourceAlphaEntry,
  padding: number,
  width: number,
  height: number,
  sampleScale: number
) {
  const far = padding + 1;
  const distance = new Uint8Array(width * height);
  distance.fill(far);
  for (let y = 0; y < entry.height; y += 1) {
    for (let x = 0; x < entry.width; x += 1) {
      if (
        (entry.alphaBytes[y * entry.width + x] ?? 0) <=
        SELECTION_ALPHA_THRESHOLD
      ) {
        continue;
      }
      distance[
        (Math.floor(y * sampleScale) + padding) *
          width +
          Math.floor(x * sampleScale) +
          padding
      ] = 0;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      let nearest = distance[index] ?? far;
      if (x > 0) {
        nearest = Math.min(
          nearest,
          (distance[index - 1] ?? far) + 1
        );
      }
      if (y > 0) {
        nearest = Math.min(
          nearest,
          (distance[index - width] ?? far) + 1
        );
        if (x > 0) {
          nearest = Math.min(
            nearest,
            (distance[index - width - 1] ?? far) + 1
          );
        }
        if (x + 1 < width) {
          nearest = Math.min(
            nearest,
            (distance[index - width + 1] ?? far) + 1
          );
        }
      }
      distance[index] = nearest;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (distance[index] === 0) continue;
      let nearest = distance[index] ?? far;
      if (x + 1 < width) {
        nearest = Math.min(
          nearest,
          (distance[index + 1] ?? far) + 1
        );
      }
      if (y + 1 < height) {
        nearest = Math.min(
          nearest,
          (distance[index + width] ?? far) + 1
        );
        if (x > 0) {
          nearest = Math.min(
            nearest,
            (distance[index + width - 1] ?? far) + 1
          );
        }
        if (x + 1 < width) {
          nearest = Math.min(
            nearest,
            (distance[index + width + 1] ?? far) + 1
          );
        }
      }
      distance[index] = nearest;
    }
  }
  return distance;
}

export function buildCanvasSelectionScreenToneGlow(
  entry: SelectionSourceAlphaEntry,
  options: {
    radiusSourcePixels?: number;
    outlineSourcePixels?: number;
  } = {}
): CanvasSelectionScreenToneGlow {
  const radiusSourcePixels = Math.max(
    0.01,
    options.radiusSourcePixels ??
      CANVAS_SELECTION_SCREEN_TONE_RADIUS_SOURCE_PIXELS
  );
  const outlineSourcePixels = Math.min(
    radiusSourcePixels,
    Math.max(
      0,
      options.outlineSourcePixels ??
        CANVAS_SELECTION_SCREEN_TONE_OUTLINE_SOURCE_PIXELS
    )
  );
  const padding =
    Math.ceil(
      radiusSourcePixels *
        CANVAS_SELECTION_SCREEN_TONE_SAMPLE_SCALE
    );
  const width =
    Math.ceil(
      entry.width *
        CANVAS_SELECTION_SCREEN_TONE_SAMPLE_SCALE
    ) +
    padding * 2;
  const height =
    Math.ceil(
      entry.height *
        CANVAS_SELECTION_SCREEN_TONE_SAMPLE_SCALE
    ) +
    padding * 2;
  const distance = buildOutsideDistance(
    entry,
    padding,
    width,
    height,
    CANVAS_SELECTION_SCREEN_TONE_SAMPLE_SCALE
  );
  const rgba = new Uint8ClampedArray(width * height * 4);
  const [red, green, blue, alpha] =
    CANVAS_SELECTION_SCREEN_TONE_RGBA;
  const outlineDistance = Math.ceil(
    outlineSourcePixels *
      CANVAS_SELECTION_SCREEN_TONE_SAMPLE_SCALE
  );
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = distance[index] ?? padding + 1;
      if (value <= 0 || value > padding) continue;
      const isOutline = value <= outlineDistance;
      // The selected artwork itself stays untouched. A crisp 2px outline is
      // followed by a cached outer glow; no blur is recomputed per frame.
      const outwardFade = isOutline
        ? 1
        : Math.max(
            0,
            1 -
              (value - outlineDistance - 1) /
                Math.max(1, padding - outlineDistance - 1)
          );
      const rgbaIndex = index * 4;
      rgba[rgbaIndex] = Math.round(
        red + (198 - red) * (isOutline ? 1 : outwardFade)
      );
      rgba[rgbaIndex + 1] = Math.round(
        green + (229 - green) * (isOutline ? 1 : outwardFade)
      );
      rgba[rgbaIndex + 2] = Math.round(
        blue + (255 - blue) * (isOutline ? 1 : outwardFade)
      );
      rgba[rgbaIndex + 3] = Math.round(
        isOutline ? 255 : alpha * 0.58 * outwardFade
      );
    }
  }
  return {
    width,
    height,
    padding,
    offsetSourcePixels:
      radiusSourcePixels,
    widthSourcePixels:
      entry.width +
      radiusSourcePixels *
        2,
    heightSourcePixels:
      entry.height +
      radiusSourcePixels *
        2,
    rgba,
  };
}

export function buildCanvasSelectionScreenToneDrawPlan(
  input: CanvasSelectionHighlightDrawInput
) {
  const dpr = Number.isFinite(input.devicePixelRatio)
    ? Math.max(1, input.devicePixelRatio)
    : 1;
  const matrix = input.projection.sourceToViewport;
  return {
    backingSize: {
      width: Math.max(
        1,
        Math.ceil(input.viewportSize.width * dpr)
      ),
      height: Math.max(
        1,
        Math.ceil(input.viewportSize.height * dpr)
      ),
    },
    sourceToDevice: {
      a: matrix.a * dpr,
      b: matrix.b * dpr,
      c: matrix.c * dpr,
      d: matrix.d * dpr,
      e: matrix.e * dpr,
      f: matrix.f * dpr,
    },
  };
}
