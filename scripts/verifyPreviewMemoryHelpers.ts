import assert from "node:assert/strict";
import {
  estimatePreviewMemory,
  estimatePreviewMemoryByQuality,
  estimatePreviewSourceMemory,
  formatPreviewMemory,
  getPreviewMemorySourceKey,
  scalePreviewPixelSize,
} from "@/engines/canvas/helpers/previewMemoryHelpers";
import type { PreviewMemorySource } from "@/engines/canvas/models/previewMemoryModel";

const source = {
  sourceId: "runtime-eye",
  sourcePixelSize: { width: 100, height: 80 },
} satisfies PreviewMemorySource;

assert.deepEqual(scalePreviewPixelSize(source.sourcePixelSize, "original"), {
  width: 100,
  height: 80,
});
assert.deepEqual(scalePreviewPixelSize(source.sourcePixelSize, "high"), {
  width: 75,
  height: 60,
});
assert.deepEqual(scalePreviewPixelSize(source.sourcePixelSize, "medium"), {
  width: 50,
  height: 40,
});
assert.deepEqual(scalePreviewPixelSize(source.sourcePixelSize, "low"), {
  width: 25,
  height: 20,
});

const expectedByQuality = {
  original: { scale: 1, width: 100, height: 80, bytes: 32_000 },
  high: { scale: 0.75, width: 75, height: 60, bytes: 18_000 },
  medium: { scale: 0.5, width: 50, height: 40, bytes: 8_000 },
  low: { scale: 0.25, width: 25, height: 20, bytes: 2_000 },
} as const;
const allQualityEstimates = estimatePreviewMemoryByQuality([source]);
Object.entries(expectedByQuality).forEach(([quality, expected]) => {
  const estimate = allQualityEstimates[
    quality as keyof typeof allQualityEstimates
  ];
  assert.equal(estimate.scale, expected.scale);
  assert.equal(estimate.estimatedBytes, expected.bytes);
  assert.deepEqual(estimate.sources[0]?.scaledPixelSize, {
    width: expected.width,
    height: expected.height,
  });
});

const tinyEstimate = estimatePreviewSourceMemory(
  { sourceId: "tiny", sourcePixelSize: { width: 3, height: 5 } },
  "low"
);
assert.deepEqual(tinyEstimate.scaledPixelSize, { width: 1, height: 2 });
assert.equal(tinyEstimate.estimatedBytes, 8);

const zeroEstimate = estimatePreviewSourceMemory(
  { sourceId: "zero", sourcePixelSize: { width: 0, height: 0 } },
  "original"
);
assert.deepEqual(zeroEstimate.scaledPixelSize, { width: 0, height: 0 });
assert.equal(zeroEstimate.estimatedBytes, 0);

const flattenedDuplicate = {
  ...source,
} satisfies PreviewMemorySource;
const sameLayerKeyInAnotherPsd = {
  ...source,
  sourceId: "other-eye",
} satisfies PreviewMemorySource;
const sourceRegistryDedupeEstimate = estimatePreviewMemory(
  [source, flattenedDuplicate, sameLayerKeyInAnotherPsd],
  "original"
);
assert.equal(sourceRegistryDedupeEstimate.sourceCount, 2);
assert.equal(sourceRegistryDedupeEstimate.estimatedBytes, 64_000);
assert.equal(
  getPreviewMemorySourceKey(source),
  getPreviewMemorySourceKey(flattenedDuplicate)
);
assert.notEqual(
  getPreviewMemorySourceKey(source),
  getPreviewMemorySourceKey(sameLayerKeyInAnotherPsd)
);

const sourceIdDedupeEstimate = estimatePreviewMemory(
  [
    { sourceId: "legacy-a", sourcePixelSize: { width: 10, height: 20 } },
    { sourceId: "legacy-a", sourcePixelSize: { width: 10, height: 20 } },
    { sourceId: "legacy-b", sourcePixelSize: { width: 10, height: 20 } },
  ],
  "original"
);
assert.equal(sourceIdDedupeEstimate.sourceCount, 2);
assert.equal(sourceIdDedupeEstimate.estimatedBytes, 1_600);

const largeEstimate = estimatePreviewSourceMemory(
  {
    sourceId: "large",
    sourcePixelSize: { width: 100_000, height: 50_000 },
  },
  "original"
);
assert.equal(largeEstimate.estimatedBytes, 20_000_000_000);
const veryLargeEstimate = estimatePreviewSourceMemory(
  {
    sourceId: "very-large",
    sourcePixelSize: { width: 1_000_000, height: 1_000_000 },
  },
  "original"
);
assert.equal(veryLargeEstimate.estimatedBytes, 4_000_000_000_000);

assert.equal(formatPreviewMemory(0), "0 B");
assert.equal(formatPreviewMemory(512), "512 B");
assert.equal(formatPreviewMemory(1_024), "1 KB");
assert.equal(formatPreviewMemory(1_536), "1.5 KB");
assert.equal(formatPreviewMemory(1_048_576), "1 MB");
assert.equal(formatPreviewMemory(1_610_612_736), "1.5 GB");
assert.equal(formatPreviewMemory(Number.NaN), "0 B");

assert.deepEqual(
  estimatePreviewMemoryByQuality([source, flattenedDuplicate]),
  estimatePreviewMemoryByQuality([source, flattenedDuplicate])
);

console.log("Preview memory helper verification passed");
