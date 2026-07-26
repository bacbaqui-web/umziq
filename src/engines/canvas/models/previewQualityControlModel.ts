import type {
  PreviewQualityPreference,
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";

export type PreviewQualityOptionViewModel = {
  readonly preference: PreviewQualityPreference;
  readonly label: string;
};

export type PreviewQualityControlViewModel = {
  readonly preference: PreviewQualityPreference;
  readonly currentQuality: ResolvedPreviewQuality;
  readonly options: readonly PreviewQualityOptionViewModel[];
};

export type PreviewQualityControlCommands = {
  readonly setPreference: (preference: PreviewQualityPreference) => void;
};
