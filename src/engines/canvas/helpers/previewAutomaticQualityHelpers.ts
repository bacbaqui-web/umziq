import {
  PREVIEW_DEVICE_MEMORY_TIER_POLICIES,
  PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES,
} from "@/engines/canvas/constants/previewAutomaticQualityConstants";
import { RESOLVED_PREVIEW_QUALITIES } from "@/engines/canvas/constants/previewQualityConstants";
import type {
  PreviewAutomaticQualityInput,
  PreviewAutomaticQualityResult,
  PreviewMemoryBudgetResult,
} from "@/engines/canvas/models/previewAutomaticQualityModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";

function isValidBudget(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeEstimatedBytes(value: number): number {
  if (!Number.isFinite(value) || value < 0) return Number.MAX_SAFE_INTEGER;
  return Math.floor(value);
}

export function resolvePreviewMemoryBudget(input: {
  readonly deviceMemoryGb?: number | null;
  readonly budgetOverrideBytes?: number | null;
}): PreviewMemoryBudgetResult {
  if (isValidBudget(input.budgetOverrideBytes)) {
    return {
      budgetBytes: Math.floor(input.budgetOverrideBytes),
      deviceMemoryGb:
        typeof input.deviceMemoryGb === "number" &&
        Number.isFinite(input.deviceMemoryGb) &&
        input.deviceMemoryGb > 0
          ? input.deviceMemoryGb
          : null,
      deviceTier: null,
      fallbackUsed: false,
      reason: "budget-override",
    };
  }

  if (input.deviceMemoryGb === null || input.deviceMemoryGb === undefined) {
    return {
      budgetBytes: PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES,
      deviceMemoryGb: null,
      deviceTier: null,
      fallbackUsed: true,
      reason: "device-memory-unavailable",
    };
  }

  if (!Number.isFinite(input.deviceMemoryGb) || input.deviceMemoryGb <= 0) {
    return {
      budgetBytes: PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES,
      deviceMemoryGb: null,
      deviceTier: null,
      fallbackUsed: true,
      reason: "device-memory-invalid",
    };
  }

  const tierPolicy = PREVIEW_DEVICE_MEMORY_TIER_POLICIES.find(
    (policy) => input.deviceMemoryGb! <= policy.maxDeviceMemoryGb
  )!;

  return {
    budgetBytes: tierPolicy.budgetBytes,
    deviceMemoryGb: input.deviceMemoryGb,
    deviceTier: tierPolicy.tier,
    fallbackUsed: false,
    reason: "device-memory-tier",
  };
}

export function resolveAutomaticPreviewQuality(
  input: PreviewAutomaticQualityInput
): PreviewAutomaticQualityResult {
  const memoryBudget = resolvePreviewMemoryBudget(input);
  let resolvedQuality: ResolvedPreviewQuality;
  let reason: PreviewAutomaticQualityResult["reason"];

  if (input.preference !== "auto") {
    resolvedQuality = input.preference;
    reason = "explicit-preference";
  } else {
    resolvedQuality =
      RESOLVED_PREVIEW_QUALITIES.find(
        (quality) =>
          normalizeEstimatedBytes(input.estimates[quality].estimatedBytes) <=
          memoryBudget.budgetBytes
      ) ?? "low";
    reason =
      normalizeEstimatedBytes(
        input.estimates[resolvedQuality].estimatedBytes
      ) <= memoryBudget.budgetBytes
        ? "highest-quality-within-budget"
        : "lowest-quality-over-budget";
  }

  const estimatedBytes = normalizeEstimatedBytes(
    input.estimates[resolvedQuality].estimatedBytes
  );

  return {
    preference: input.preference,
    resolvedQuality,
    budgetBytes: memoryBudget.budgetBytes,
    estimatedBytes,
    fitsBudget: estimatedBytes <= memoryBudget.budgetBytes,
    fallbackUsed: memoryBudget.fallbackUsed,
    reason,
    budgetReason: memoryBudget.reason,
    deviceMemoryGb: memoryBudget.deviceMemoryGb,
    deviceTier: memoryBudget.deviceTier,
  };
}
