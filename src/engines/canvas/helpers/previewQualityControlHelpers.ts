import { formatPreviewMemory } from "@/engines/canvas/helpers/previewMemoryHelpers";
import type { PreviewAutomaticQualityResult } from "@/engines/canvas/models/previewAutomaticQualityModel";
import type { PreviewBuildReadModel } from "@/engines/canvas/models/previewBuildModel";
import type { PreviewMemoryEstimatesByQuality } from "@/engines/canvas/models/previewMemoryModel";
import type {
  PreviewQualityControlViewModel,
  PreviewQualityOptionViewModel,
} from "@/engines/canvas/models/previewQualityControlModel";
import type {
  PreviewQualityPreference,
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";

export const PREVIEW_QUALITY_LABELS: Readonly<
  Record<PreviewQualityPreference, string>
> = {
  auto: "자동",
  original: "원본",
  high: "상",
  medium: "중",
  low: "하",
};

const PREVIEW_QUALITY_PREFERENCES: readonly PreviewQualityPreference[] = [
  "auto",
  "original",
  "high",
  "medium",
  "low",
];

function buildOption(
  preference: PreviewQualityPreference,
  automaticQuality: PreviewAutomaticQualityResult,
  memoryEstimates: PreviewMemoryEstimatesByQuality,
  currentQuality: ResolvedPreviewQuality | null
): PreviewQualityOptionViewModel {
  const resolvedQuality =
    preference === "auto" ? automaticQuality.resolvedQuality : preference;
  const currentLabel = currentQuality
    ? PREVIEW_QUALITY_LABELS[currentQuality]
    : PREVIEW_QUALITY_LABELS.original;

  return {
    preference,
    label:
      preference === "auto"
        ? `자동 (현재: ${currentLabel})`
        : PREVIEW_QUALITY_LABELS[preference],
    memoryLabel: formatPreviewMemory(
      memoryEstimates[resolvedQuality].estimatedBytes
    ),
  };
}

export function buildPreviewQualityControlViewModel(input: {
  readonly preference: PreviewQualityPreference;
  readonly automaticQuality: PreviewAutomaticQualityResult;
  readonly memoryEstimates: PreviewMemoryEstimatesByQuality;
  readonly build: PreviewBuildReadModel;
}): PreviewQualityControlViewModel {
  const currentQuality = input.build.activeQuality;
  return {
    preference: input.preference,
    currentQuality,
    options: PREVIEW_QUALITY_PREFERENCES.map((preference) =>
      buildOption(
        preference,
        input.automaticQuality,
        input.memoryEstimates,
        currentQuality
      )
    ),
    status: input.build.status,
    completedCount: input.build.completedCount,
    totalCount: input.build.totalCount,
    failedCount: input.build.failedCount,
  };
}
