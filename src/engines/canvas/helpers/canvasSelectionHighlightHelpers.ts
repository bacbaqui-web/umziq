import {
  CANVAS_SELECTION_SCREEN_TONE_DENSITIES,
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

const BAYER_8X8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
] as const;

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

function densityForDistance(
  distance: number,
  radius: number
) {
  const third = radius / 3;
  if (distance <= third) {
    return CANVAS_SELECTION_SCREEN_TONE_DENSITIES[0];
  }
  if (distance <= third * 2) {
    return CANVAS_SELECTION_SCREEN_TONE_DENSITIES[1];
  }
  return CANVAS_SELECTION_SCREEN_TONE_DENSITIES[2];
}

export function buildCanvasSelectionScreenToneGlow(
  entry: SelectionSourceAlphaEntry
): CanvasSelectionScreenToneGlow {
  const padding =
    Math.ceil(
      CANVAS_SELECTION_SCREEN_TONE_RADIUS_SOURCE_PIXELS *
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
  const outlineDistance = Math.max(
    1,
    Math.ceil(
      CANVAS_SELECTION_SCREEN_TONE_OUTLINE_SOURCE_PIXELS *
        CANVAS_SELECTION_SCREEN_TONE_SAMPLE_SCALE
    )
  );
  const toneRadius = Math.max(
    1,
    padding - outlineDistance
  );
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = distance[index] ?? padding + 1;
      if (value <= 0 || value > padding) continue;
      const isOutline = value <= outlineDistance;
      if (!isOutline) {
        const density = densityForDistance(
          value - outlineDistance,
          toneRadius
        );
        const threshold =
          BAYER_8X8[(y % 8) * 8 + (x % 8)] ?? 64;
        if (threshold >= density * 64) continue;
      }
      const rgbaIndex = index * 4;
      rgba[rgbaIndex] = red;
      rgba[rgbaIndex + 1] = green;
      rgba[rgbaIndex + 2] = blue;
      rgba[rgbaIndex + 3] = isOutline
        ? 255
        : alpha;
    }
  }
  return {
    width,
    height,
    padding,
    offsetSourcePixels:
      CANVAS_SELECTION_SCREEN_TONE_RADIUS_SOURCE_PIXELS,
    widthSourcePixels:
      entry.width +
      CANVAS_SELECTION_SCREEN_TONE_RADIUS_SOURCE_PIXELS *
        2,
    heightSourcePixels:
      entry.height +
      CANVAS_SELECTION_SCREEN_TONE_RADIUS_SOURCE_PIXELS *
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
