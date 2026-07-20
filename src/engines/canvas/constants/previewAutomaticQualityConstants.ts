export type PreviewDeviceMemoryTier =
  | "constrained"
  | "low"
  | "standard"
  | "high"
  | "extended";

export type PreviewDeviceMemoryTierPolicy = {
  readonly tier: PreviewDeviceMemoryTier;
  readonly maxDeviceMemoryGb: number;
  readonly budgetBytes: number;
};

const MEBIBYTE = 1024 ** 2;

export const PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES = 128 * MEBIBYTE;

export const PREVIEW_DEVICE_MEMORY_TIER_POLICIES = [
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
] as const satisfies readonly PreviewDeviceMemoryTierPolicy[];
