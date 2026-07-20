import type {
  PreviewQualityPreference,
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";

export type PreviewQualityOptionViewModel = {
  readonly preference: PreviewQualityPreference;
  readonly label: string;
  readonly memoryLabel: string;
};

export type PreviewQualityControlViewModel = {
  readonly preference: PreviewQualityPreference;
  readonly currentQuality: ResolvedPreviewQuality | null;
  readonly options: readonly PreviewQualityOptionViewModel[];
  readonly status: "idle" | "building" | "ready" | "error";
  readonly completedCount: number;
  readonly totalCount: number;
  readonly failedCount: number;
};

export type PreviewQualityControlCommands = {
  readonly setPreference: (preference: PreviewQualityPreference) => void;
};
