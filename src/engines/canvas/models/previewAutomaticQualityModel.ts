import type { PreviewMemoryEstimatesByQuality } from "@/engines/canvas/models/previewMemoryModel";
import type {
  PreviewQualityPreference,
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";
import type { PreviewDeviceMemoryTier } from "@/engines/canvas/constants/previewAutomaticQualityConstants";

export type PreviewMemoryBudgetReason =
  | "budget-override"
  | "device-memory-tier"
  | "device-memory-unavailable"
  | "device-memory-invalid";

export type PreviewMemoryBudgetResult = {
  readonly budgetBytes: number;
  readonly deviceMemoryGb: number | null;
  readonly deviceTier: PreviewDeviceMemoryTier | null;
  readonly fallbackUsed: boolean;
  readonly reason: PreviewMemoryBudgetReason;
};

export type PreviewAutomaticQualityReason =
  | "explicit-preference"
  | "highest-quality-within-budget"
  | "lowest-quality-over-budget";

export type PreviewAutomaticQualityInput = {
  readonly preference: PreviewQualityPreference;
  readonly estimates: PreviewMemoryEstimatesByQuality;
  readonly deviceMemoryGb?: number | null;
  readonly budgetOverrideBytes?: number | null;
};

export type PreviewAutomaticQualityResult = {
  readonly preference: PreviewQualityPreference;
  readonly resolvedQuality: ResolvedPreviewQuality;
  readonly budgetBytes: number;
  readonly estimatedBytes: number;
  readonly fitsBudget: boolean;
  readonly fallbackUsed: boolean;
  readonly reason: PreviewAutomaticQualityReason;
  readonly budgetReason: PreviewMemoryBudgetReason;
  readonly deviceMemoryGb: number | null;
  readonly deviceTier: PreviewDeviceMemoryTier | null;
};
