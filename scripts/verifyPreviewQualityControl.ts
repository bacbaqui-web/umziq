import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveAutomaticPreviewQuality } from "@/engines/canvas/helpers/previewAutomaticQualityHelpers";
import { buildPreviewQualityControlViewModel } from "@/engines/canvas/helpers/previewQualityControlHelpers";
import type { PreviewBuildReadModel } from "@/engines/canvas/models/previewBuildModel";
import type { PreviewMemoryEstimatesByQuality } from "@/engines/canvas/models/previewMemoryModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";

const MEBIBYTE = 1024 ** 2;
const bytesByQuality = {
  original: 420 * MEBIBYTE,
  high: 180 * MEBIBYTE,
  medium: 92 * MEBIBYTE,
  low: 24 * MEBIBYTE,
} as const;
const scales = { original: 1, high: 0.75, medium: 0.5, low: 0.25 };
const memoryEstimates = Object.fromEntries(
  (Object.keys(bytesByQuality) as ResolvedPreviewQuality[]).map((quality) => [
    quality,
    {
      quality,
      scale: scales[quality],
      sourceCount: 1,
      estimatedBytes: bytesByQuality[quality],
      sources: [],
    },
  ])
) as PreviewMemoryEstimatesByQuality;
const automaticQuality = resolveAutomaticPreviewQuality({
  preference: "auto",
  estimates: memoryEstimates,
  budgetOverrideBytes: 200 * MEBIBYTE,
});
const readyBuild: PreviewBuildReadModel = {
  status: "ready",
  generation: 2,
  activeGeneration: 2,
  activeQuality: "high",
  quality: "high",
  completedCount: 26,
  totalCount: 26,
  failedCount: 0,
};

const readyModel = buildPreviewQualityControlViewModel({
  preference: "auto",
  automaticQuality,
  memoryEstimates,
  build: readyBuild,
});
assert.equal(readyModel.options.length, 5);
assert.deepEqual(
  readyModel.options.map((option) => option.preference),
  ["auto", "original", "high", "medium", "low"]
);
assert.deepEqual(
  readyModel.options.map((option) => option.label),
  ["자동 (현재: 상)", "원본", "상", "중", "하"]
);
assert.deepEqual(
  readyModel.options.map((option) => option.memoryLabel),
  ["180 MB", "420 MB", "180 MB", "92 MB", "24 MB"]
);

const buildingModel = buildPreviewQualityControlViewModel({
  preference: "low",
  automaticQuality: { ...automaticQuality, preference: "low", resolvedQuality: "low" },
  memoryEstimates,
  build: {
    ...readyBuild,
    status: "building",
    activeQuality: "high",
    quality: "low",
    completedCount: 18,
  },
});
assert.equal(buildingModel.preference, "low");
assert.equal(buildingModel.currentQuality, "high");
assert.equal(buildingModel.completedCount, 18);
assert.equal(buildingModel.totalCount, 26);

const errorModel = buildPreviewQualityControlViewModel({
  preference: "low",
  automaticQuality: { ...automaticQuality, preference: "low", resolvedQuality: "low" },
  memoryEstimates,
  build: {
    ...readyBuild,
    status: "error",
    activeQuality: "high",
    quality: "low",
    failedCount: 2,
  },
});
assert.equal(errorModel.status, "error");
assert.equal(errorModel.currentQuality, "high");
assert.equal(errorModel.failedCount, 2);

const initialModel = buildPreviewQualityControlViewModel({
  preference: "auto",
  automaticQuality,
  memoryEstimates,
  build: {
    ...readyBuild,
    status: "building",
    activeGeneration: null,
    activeQuality: null,
  },
});
assert.equal(initialModel.options[0]?.label, "자동 (현재: 원본)");

const componentSource = readFileSync(
  "src/features/preview/components/PreviewQualityControl.tsx",
  "utf8"
);
assert.match(componentSource, /<select/);
assert.match(componentSource, /aria-label="Preview 품질"/);
assert.match(componentSource, /aria-live="polite"/);
assert.match(componentSource, /commands\.setPreference/);
assert.doesNotMatch(componentSource, /Bitmap|Cache|Project|Render/);

console.log("Preview quality control verification passed");
