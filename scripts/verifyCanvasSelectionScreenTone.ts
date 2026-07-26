import assert from "node:assert/strict";
import {
  createCanvasSelectionGlowRenderer,
} from "@/engines/canvas/adapters/canvasSelectionGlowBrowserAdapter";
import {
  buildCanvasSelectionScreenToneDrawPlan,
  buildCanvasSelectionScreenToneGlow,
} from "@/engines/canvas/helpers/canvasSelectionGlowHelpers";

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

function density(from: number, to: number) {
  let active = 0;
  let total = 0;
  for (let y = 0; y < glow.height; y += 1) {
    for (let x = 0; x < glow.width; x += 1) {
      const distance = Math.max(
        Math.abs(x - center),
        Math.abs(y - center)
      );
      if (distance < from || distance > to) continue;
      total += 1;
      if (
        (glow.rgba[(y * glow.width + x) * 4 + 3] ??
          0) > 0
      ) {
        active += 1;
      }
    }
  }
  return active / total;
}

const outlineDensity = density(1, 2);
const nearDensity = density(3, 5);
const middleDensity = density(6, 9);
const farDensity = density(10, glow.padding);
assert.equal(outlineDensity, 1);
assert.ok(nearDensity > middleDensity);
assert.ok(middleDensity > farDensity);
assert.ok(farDensity > 0);

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
const renderer = createCanvasSelectionGlowRenderer({
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
  -glow.offsetSourcePixels,
  -glow.offsetSourcePixels,
  glow.widthSourcePixels,
  glow.heightSourcePixels,
]);

renderer.clearSelection(target);
assert.equal(target.width, 1);
assert.equal(target.height, 1);

console.log(
  "Canvas outer gradient screen tone verification passed"
);
