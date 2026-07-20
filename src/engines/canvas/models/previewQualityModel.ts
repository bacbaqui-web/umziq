export type PreviewQualityPreference =
  | "auto"
  | "original"
  | "high"
  | "medium"
  | "low";

export type ResolvedPreviewQuality = Exclude<
  PreviewQualityPreference,
  "auto"
>;
