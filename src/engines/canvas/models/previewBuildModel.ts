import type {
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";

export type PreviewBuildReadModel = {
  readonly status:
    | "idle"
    | "building"
    | "ready"
    | "error";
  readonly generation: number;
  readonly activeGeneration: number | null;
  readonly activeQuality:
    ResolvedPreviewQuality | null;
  readonly quality: ResolvedPreviewQuality;
  readonly completedCount: number;
  readonly totalCount: number;
  readonly failedCount: number;
};
