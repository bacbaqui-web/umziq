import type {
  PreviewQualityPreference,
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";

/**
 * Automatic quality controls Canvas backing resolution only.
 * It never creates or selects a second copy of a Source bitmap.
 */
export function resolvePreviewQuality(
  preference: PreviewQualityPreference,
  deviceMemoryGb: number | null
): ResolvedPreviewQuality {
  if (preference !== "auto") return preference;
  if (
    deviceMemoryGb === null ||
    !Number.isFinite(deviceMemoryGb) ||
    deviceMemoryGb <= 0
  ) {
    return "medium";
  }
  if (deviceMemoryGb >= 8) return "original";
  if (deviceMemoryGb >= 4) return "high";
  if (deviceMemoryGb >= 2) return "medium";
  return "low";
}
