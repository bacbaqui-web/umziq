import assert from "node:assert/strict";
import {
  createCanvasSelectionHighlightRenderer,
} from "@/engines/canvas/adapters/canvasSelectionHighlightBrowserAdapter";
import {
  buildCanvasSelectionScreenToneDrawPlan,
  buildCanvasSelectionScreenToneGlow,
} from "@/engines/canvas/helpers/canvasSelectionHighlightHelpers";

const entry = {
  visualFingerprint: "alpha:single-pixel",
  width: 1,
  height: 1,
  alphaBytes: new Uint8Array([255]),
  sample: () => 255,
};
const glow = buildCanvasSelectionScreenToneGlow(entry);
const center = glow.padding;
assert.equal(
  glow.rgba[(center * glow.width + center) * 4 + 3],
  0
);

assert.equal(glow.padding, 8);
const innerAlpha =
  glow.rgba[(center * glow.width + center + 1) * 4 + 3] ?? 0;
const outerAlpha =
  glow.rgba[(center * glow.width + center + 2) * 4 + 3] ?? 0;
const nearGlowAlpha =
  glow.rgba[(center * glow.width + center + 3) * 4 + 3] ?? 0;
const farGlowAlpha =
  glow.rgba[(center * glow.width + center + 7) * 4 + 3] ?? 0;
assert.equal(innerAlpha, 255);
assert.ok(innerAlpha > outerAlpha);
assert.ok(nearGlowAlpha > farGlowAlpha);
assert.ok(farGlowAlpha > 0);

const projection = {
  sourceToViewport: {
    a: 2,
    b: 0,
    c: 0,
    d: 2,
    e: 10,
    f: 20,
  },
  viewportQuad: [
    { x: 10, y: 20 },
    { x: 12, y: 20 },
    { x: 12, y: 22 },
    { x: 10, y: 22 },
  ],
  viewportBounds: {
    left: 10,
    top: 20,
    right: 12,
    bottom: 22,
  },
  viewportToSource: {
    a: 0.5,
    b: 0,
    c: 0,
    d: 0.5,
    e: -5,
    f: -10,
  },
} as const;
const input = {
  entry,
  projection,
  viewportSize: { width: 100, height: 80 },
  devicePixelRatio: 2,
};
const plan =
  buildCanvasSelectionScreenToneDrawPlan(input);
assert.deepEqual(plan.backingSize, {
  width: 200,
  height: 160,
});
assert.deepEqual(plan.sourceToDevice, {
  a: 4,
  b: 0,
  c: 0,
  d: 4,
  e: 20,
  f: 40,
});

const drawArguments: unknown[][] = [];
const targetContext = {
  setTransform: () => undefined,
  clearRect: () => undefined,
  drawImage: (...args: unknown[]) =>
    drawArguments.push(args),
  imageSmoothingEnabled: true,
} as unknown as CanvasRenderingContext2D;
const target = {
  width: 1,
  height: 1,
  getContext: () => targetContext,
} as unknown as HTMLCanvasElement;
const scratchContext = {
  createImageData: (width: number, height: number) => ({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  }),
  putImageData: () => undefined,
} as unknown as CanvasRenderingContext2D;
const renderer = createCanvasSelectionHighlightRenderer({
  createCanvas: () => ({
    width: 1,
    height: 1,
    getContext: () => scratchContext,
  }) as unknown as HTMLCanvasElement,
});
const first = renderer.draw(target, input);
const reused = renderer.draw(target, input);
assert.deepEqual(first, {
  visualFingerprint: "alpha:single-pixel",
  scratchRebuilt: true,
});
assert.deepEqual(reused, {
  visualFingerprint: "alpha:single-pixel",
  scratchRebuilt: false,
});
assert.deepEqual(drawArguments[0]?.slice(1), [
  -4,
  -4,
  entry.width + 8,
  entry.height + 8,
]);

const zoomed = renderer.draw(target, {
  ...input,
  projection: {
    ...projection,
    sourceToViewport: {
      ...projection.sourceToViewport,
      a: 4,
      d: 4,
    },
  },
});
assert.equal(zoomed?.scratchRebuilt, true);
assert.deepEqual(drawArguments[2]?.slice(1), [
  -2,
  -2,
  entry.width + 4,
  entry.height + 4,
]);

renderer.clearSelection(target);
assert.equal(target.width, 1);
assert.equal(target.height, 1);

console.log(
  "Canvas 1px outline with cached outer glow verification passed"
);
