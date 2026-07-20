import assert from "node:assert/strict";
import { createPreviewBitmapBrowserAdapter } from "@/engines/canvas/adapters/previewBitmapBrowserAdapter";
import { createPreviewBitmapResource } from "@/engines/canvas/factories/previewBitmapFactory";
import type { PreviewBitmapCreationAdapter } from "@/engines/canvas/models/previewBitmapFactoryModel";

function makeSourceCanvas(width: number, height: number): HTMLCanvasElement {
  return {
    width,
    height,
    pixels: [11, 22, 33, 44],
  } as unknown as HTMLCanvasElement;
}

const sourceCanvas = makeSourceCanvas(8, 4);
const originalPixels = [...(sourceCanvas as unknown as { pixels: number[] }).pixels];
let primaryCloseCount = 0;
const primaryBitmap = {
  width: 4,
  height: 2,
  close: () => {
    primaryCloseCount += 1;
  },
} as unknown as ImageBitmap;
let receivedSource: HTMLCanvasElement | null = null;
let receivedOptions: ImageBitmapOptions | null = null;
const primaryAdapter = createPreviewBitmapBrowserAdapter({
  createImageBitmap: async (source, options) => {
    receivedSource = source;
    receivedOptions = options;
    return primaryBitmap;
  },
  createCopyCanvas: () => {
    throw new Error("fallback must not run");
  },
});
const primaryResult = await createPreviewBitmapResource(
  {
    key: "eye:medium",
    generation: 7,
    sourceId: "eye",
    sourceFingerprint: "fingerprint-eye",
    quality: "medium",
    sourceCanvas,
    logicalSize: { width: 16, height: 10 },
  },
  primaryAdapter
);
assert.equal(primaryResult.ok, true);
if (!primaryResult.ok) throw new Error("primary bitmap creation failed");
assert.equal(receivedSource, sourceCanvas);
assert.deepEqual(receivedOptions, {
  resizeWidth: 4,
  resizeHeight: 2,
  resizeQuality: "high",
});
assert.notEqual(primaryResult.resource.bitmap.image, sourceCanvas);
assert.equal(primaryResult.resource.bitmap.image, primaryBitmap);
assert.deepEqual(primaryResult.resource.bitmap.pixelSize, {
  width: 4,
  height: 2,
});
assert.deepEqual(primaryResult.resource.bitmap.logicalSize, {
  width: 16,
  height: 10,
});
assert.equal(primaryResult.resource.estimatedBytes, 32);
assert.equal(primaryResult.resource.allocatedBytes, 32);
assert.equal(primaryResult.resource.generation, 7);
assert.equal(sourceCanvas.width, 8);
assert.equal(sourceCanvas.height, 4);
assert.deepEqual(
  (sourceCanvas as unknown as { pixels: number[] }).pixels,
  originalPixels
);
primaryResult.resource.bitmap.dispose();
primaryResult.resource.bitmap.dispose();
assert.equal(primaryCloseCount, 1);

const originalSource = makeSourceCanvas(8, 4);
const originalBitmap = {
  width: 8,
  height: 4,
  close: () => undefined,
} as unknown as ImageBitmap;
const originalResult = await createPreviewBitmapResource(
  {
    key: "eye:original",
    generation: 7,
    sourceId: "eye",
    sourceFingerprint: null,
    quality: "original",
    sourceCanvas: originalSource,
    logicalSize: { width: 8, height: 4 },
  },
  {
    ...primaryAdapter,
    createBitmap: async () => originalBitmap,
  }
);
assert.equal(originalResult.ok, true);
if (!originalResult.ok) throw new Error("original bitmap creation failed");
assert.notEqual(originalResult.resource.bitmap.image, originalSource);
assert.deepEqual(originalResult.resource.bitmap.pixelSize, {
  width: 8,
  height: 4,
});

const fallbackSource = makeSourceCanvas(9, 5);
let fallbackDrawArgs: unknown[] = [];
const fallbackCanvas = {
  width: 3,
  height: 2,
  getContext: () => ({
    drawImage: (...args: unknown[]) => {
      fallbackDrawArgs = args;
    },
  }),
} as unknown as OffscreenCanvas;
const fallbackAdapter = createPreviewBitmapBrowserAdapter({
  createImageBitmap: null,
  createCopyCanvas: (pixelSize) => {
    assert.deepEqual(pixelSize, { width: 3, height: 2 });
    return fallbackCanvas;
  },
});
const fallbackResult = await createPreviewBitmapResource(
  {
    key: "mouth:low",
    generation: 3,
    sourceId: "mouth",
    sourceFingerprint: "fingerprint-mouth",
    quality: "low",
    sourceCanvas: fallbackSource,
    logicalSize: { width: 18, height: 10 },
  },
  fallbackAdapter
);
assert.equal(fallbackResult.ok, true);
if (!fallbackResult.ok) throw new Error("fallback bitmap creation failed");
assert.equal(fallbackResult.resource.bitmap.image, fallbackCanvas);
assert.deepEqual(fallbackDrawArgs, [fallbackSource, 0, 0, 3, 2]);
assert.equal(fallbackSource.width, 9);
assert.equal(fallbackSource.height, 5);
fallbackResult.resource.bitmap.dispose();
fallbackResult.resource.bitmap.dispose();
assert.equal(fallbackCanvas.width, 0);
assert.equal(fallbackCanvas.height, 0);

let fallbackCalledAfterFailure = false;
const failedResult = await createPreviewBitmapResource(
  {
    key: "failed:high",
    generation: 4,
    sourceId: "failed",
    sourceFingerprint: null,
    quality: "high",
    sourceCanvas: makeSourceCanvas(10, 10),
    logicalSize: { width: 10, height: 10 },
  },
  {
    createBitmap: async () => {
      throw new Error("decode failed");
    },
    createFallbackBitmap: () => {
      fallbackCalledAfterFailure = true;
      return fallbackCanvas;
    },
    disposeBitmap: () => undefined,
  }
);
assert.equal(failedResult.ok, false);
if (failedResult.ok) throw new Error("failed bitmap unexpectedly succeeded");
assert.equal(failedResult.error.code, "bitmap-creation-failed");
assert.equal(fallbackCalledAfterFailure, false);

let reusedSourceDisposed = false;
const reusedSource = makeSourceCanvas(10, 10);
const reusedSourceResult = await createPreviewBitmapResource(
  {
    key: "reused:original",
    generation: 1,
    sourceId: "reused",
    sourceFingerprint: null,
    quality: "original",
    sourceCanvas: reusedSource,
    logicalSize: { width: 10, height: 10 },
  },
  {
    createBitmap: async () => reusedSource,
    createFallbackBitmap: () => reusedSource,
    disposeBitmap: () => {
      reusedSourceDisposed = true;
    },
  } satisfies PreviewBitmapCreationAdapter
);
assert.equal(reusedSourceResult.ok, false);
if (reusedSourceResult.ok) throw new Error("source reuse unexpectedly succeeded");
assert.equal(reusedSourceResult.error.code, "source-resource-reused");
assert.equal(reusedSourceDisposed, false);

let invalidSizeAdapterCalled = false;
const invalidSizeResult = await createPreviewBitmapResource(
  {
    key: "zero:original",
    generation: 1,
    sourceId: "zero",
    sourceFingerprint: null,
    quality: "original",
    sourceCanvas: makeSourceCanvas(0, 10),
    logicalSize: { width: 0, height: 10 },
  },
  {
    createBitmap: async () => {
      invalidSizeAdapterCalled = true;
      return null;
    },
    createFallbackBitmap: () => {
      invalidSizeAdapterCalled = true;
      return fallbackCanvas;
    },
    disposeBitmap: () => undefined,
  }
);
assert.equal(invalidSizeResult.ok, false);
if (invalidSizeResult.ok) throw new Error("invalid size unexpectedly succeeded");
assert.equal(invalidSizeResult.error.code, "invalid-source-size");
assert.equal(invalidSizeAdapterCalled, false);

console.log("Preview bitmap factory verification passed");
