import type { RenderSize } from "@/engines/playback-render";
import type { PsdSourceIdentity } from "@/models";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";

export type PreviewMemorySource = {
  readonly sourceId: string;
  readonly sourceIdentity?: PsdSourceIdentity | null;
  readonly sourcePixelSize: RenderSize;
};

export type PreviewMemorySourceEstimate = {
  readonly sourceKey: string;
  readonly sourceId: string;
  readonly sourcePixelSize: RenderSize;
  readonly scaledPixelSize: RenderSize;
  readonly estimatedBytes: number;
};

export type PreviewMemoryEstimate = {
  readonly quality: ResolvedPreviewQuality;
  readonly scale: number;
  readonly sourceCount: number;
  readonly estimatedBytes: number;
  readonly sources: readonly PreviewMemorySourceEstimate[];
};

export type PreviewMemoryEstimatesByQuality = Readonly<
  Record<ResolvedPreviewQuality, PreviewMemoryEstimate>
>;
