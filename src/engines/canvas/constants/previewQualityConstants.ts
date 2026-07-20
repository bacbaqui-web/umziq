import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";

export const PREVIEW_QUALITY_SCALE = {
  original: 1,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
} as const satisfies Readonly<Record<ResolvedPreviewQuality, number>>;

export const RESOLVED_PREVIEW_QUALITIES = [
  "original",
  "high",
  "medium",
  "low",
] as const satisfies readonly ResolvedPreviewQuality[];
