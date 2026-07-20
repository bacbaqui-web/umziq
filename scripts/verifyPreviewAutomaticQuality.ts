import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PREVIEW_DEVICE_MEMORY_TIER_POLICIES,
  PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES,
} from "@/engines/canvas/constants/previewAutomaticQualityConstants";
import {
  resolveAutomaticPreviewQuality,
  resolvePreviewMemoryBudget,
} from "@/engines/canvas/helpers/previewAutomaticQualityHelpers";
import type { PreviewMemoryEstimatesByQuality } from "@/engines/canvas/models/previewMemoryModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";

function makeEstimates(bytes: {
  readonly original: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}): PreviewMemoryEstimatesByQuality {
  const scales = { original: 1, high: 0.75, medium: 0.5, low: 0.25 };
  return Object.fromEntries(
    (Object.keys(bytes) as ResolvedPreviewQuality[]).map((quality) => [
      quality,
      {
        quality,
        scale: scales[quality],
        sourceCount: 1,
        estimatedBytes: bytes[quality],
        sources: [],
      },
    ])
  ) as PreviewMemoryEstimatesByQuality;
}

const MEBIBYTE = 1024 ** 2;
assert.deepEqual(PREVIEW_DEVICE_MEMORY_TIER_POLICIES, [
  {
    tier: "constrained",
    maxDeviceMemoryGb: 1,
    budgetBytes: 64 * MEBIBYTE,
  },
  { tier: "low", maxDeviceMemoryGb: 2, budgetBytes: 128 * MEBIBYTE },
  {
    tier: "standard",
    maxDeviceMemoryGb: 4,
    budgetBytes: 256 * MEBIBYTE,
  },
  { tier: "high", maxDeviceMemoryGb: 8, budgetBytes: 512 * MEBIBYTE },
  {
    tier: "extended",
    maxDeviceMemoryGb: Number.POSITIVE_INFINITY,
    budgetBytes: 1024 * MEBIBYTE,
  },
]);
assert.equal(PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES, 128 * MEBIBYTE);

assert.deepEqual(resolvePreviewMemoryBudget({ deviceMemoryGb: 0.5 }), {
  budgetBytes: 64 * MEBIBYTE,
  deviceMemoryGb: 0.5,
  deviceTier: "constrained",
  fallbackUsed: false,
  reason: "device-memory-tier",
});
assert.equal(resolvePreviewMemoryBudget({ deviceMemoryGb: 2 }).deviceTier, "low");
assert.equal(
  resolvePreviewMemoryBudget({ deviceMemoryGb: 4 }).deviceTier,
  "standard"
);
assert.equal(resolvePreviewMemoryBudget({ deviceMemoryGb: 8 }).deviceTier, "high");
assert.equal(
  resolvePreviewMemoryBudget({ deviceMemoryGb: 16 }).deviceTier,
  "extended"
);

const unavailableBudget = resolvePreviewMemoryBudget({});
assert.equal(unavailableBudget.budgetBytes, 128 * MEBIBYTE);
assert.equal(unavailableBudget.fallbackUsed, true);
assert.equal(unavailableBudget.reason, "device-memory-unavailable");
for (const invalidDeviceMemory of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  const invalidBudget = resolvePreviewMemoryBudget({
    deviceMemoryGb: invalidDeviceMemory,
  });
  assert.equal(invalidBudget.budgetBytes, 128 * MEBIBYTE);
  assert.equal(invalidBudget.fallbackUsed, true);
  assert.equal(invalidBudget.reason, "device-memory-invalid");
}
assert.deepEqual(
  resolvePreviewMemoryBudget({
    deviceMemoryGb: Number.NaN,
    budgetOverrideBytes: 1_000,
  }),
  {
    budgetBytes: 1_000,
    deviceMemoryGb: null,
    deviceTier: null,
    fallbackUsed: false,
    reason: "budget-override",
  }
);

const qualityCases = [
  {
    expected: "original",
    bytes: { original: 1_000, high: 900, medium: 700, low: 500 },
  },
  {
    expected: "high",
    bytes: { original: 1_001, high: 1_000, medium: 700, low: 500 },
  },
  {
    expected: "medium",
    bytes: { original: 1_500, high: 1_001, medium: 1_000, low: 500 },
  },
  {
    expected: "low",
    bytes: { original: 2_000, high: 1_500, medium: 1_001, low: 1_000 },
  },
] as const;

qualityCases.forEach(({ expected, bytes }) => {
  const result = resolveAutomaticPreviewQuality({
    preference: "auto",
    estimates: makeEstimates(bytes),
    budgetOverrideBytes: 1_000,
  });
  assert.equal(result.resolvedQuality, expected);
  assert.equal(result.estimatedBytes, bytes[expected]);
  assert.equal(result.fitsBudget, true);
  assert.equal(result.reason, "highest-quality-within-budget");
});

const overBudgetResult = resolveAutomaticPreviewQuality({
  preference: "auto",
  estimates: makeEstimates({
    original: 4_000,
    high: 3_000,
    medium: 2_000,
    low: 1_001,
  }),
  budgetOverrideBytes: 1_000,
});
assert.equal(overBudgetResult.resolvedQuality, "low");
assert.equal(overBudgetResult.estimatedBytes, 1_001);
assert.equal(overBudgetResult.fitsBudget, false);
assert.equal(overBudgetResult.reason, "lowest-quality-over-budget");

const tinyProjectResult = resolveAutomaticPreviewQuality({
  preference: "auto",
  estimates: makeEstimates({ original: 0, high: 0, medium: 0, low: 0 }),
  deviceMemoryGb: null,
});
assert.equal(tinyProjectResult.resolvedQuality, "original");
assert.equal(tinyProjectResult.fallbackUsed, true);

const hugeProjectResult = resolveAutomaticPreviewQuality({
  preference: "auto",
  estimates: makeEstimates({
    original: Number.MAX_SAFE_INTEGER,
    high: Number.MAX_SAFE_INTEGER,
    medium: Number.MAX_SAFE_INTEGER,
    low: Number.MAX_SAFE_INTEGER,
  }),
  deviceMemoryGb: 16,
});
assert.equal(hugeProjectResult.resolvedQuality, "low");
assert.equal(hugeProjectResult.fitsBudget, false);

const explicitResult = resolveAutomaticPreviewQuality({
  preference: "medium",
  estimates: makeEstimates({ original: 100, high: 75, medium: 50, low: 25 }),
  budgetOverrideBytes: 10,
});
assert.equal(explicitResult.resolvedQuality, "medium");
assert.equal(explicitResult.fitsBudget, false);
assert.equal(explicitResult.reason, "explicit-preference");

const deterministicInput = {
  preference: "auto" as const,
  estimates: makeEstimates({
    original: 300 * MEBIBYTE,
    high: 200 * MEBIBYTE,
    medium: 100 * MEBIBYTE,
    low: 50 * MEBIBYTE,
  }),
  deviceMemoryGb: 4,
};
assert.deepEqual(
  resolveAutomaticPreviewQuality(deterministicInput),
  resolveAutomaticPreviewQuality(deterministicInput)
);
assert.deepEqual(
  JSON.parse(JSON.stringify(resolveAutomaticPreviewQuality(deterministicInput))),
  resolveAutomaticPreviewQuality(deterministicInput)
);

const modelSource = readFileSync(
  "src/engines/canvas/models/previewAutomaticQualityModel.ts",
  "utf8"
);
const helperSource = readFileSync(
  "src/engines/canvas/helpers/previewAutomaticQualityHelpers.ts",
  "utf8"
);
assert.equal(/trackedBytes|allocatedBytes|PreviewCacheSnapshot/.test(modelSource), false);
assert.equal(/trackedBytes|allocatedBytes|previewCache/.test(helperSource), false);
assert.equal(/navigator|performance\.memory/.test(helperSource), false);

console.log("Preview automatic quality policy verification passed");
