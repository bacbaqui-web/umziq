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
  preference: PreviewQualityPreference
): PreviewQualityOptionViewModel {
  return {
    preference,
    label: PREVIEW_QUALITY_LABELS[preference],
  };
}

export function buildPreviewQualityControlViewModel(input: {
  readonly preference: PreviewQualityPreference;
  readonly quality: ResolvedPreviewQuality;
}): PreviewQualityControlViewModel {
  return {
    preference: input.preference,
    currentQuality: input.quality,
    options: PREVIEW_QUALITY_PREFERENCES.map(buildOption),
  };
}
