import {
  PREVIEW_QUALITY_SCALE,
  RESOLVED_PREVIEW_QUALITIES,
} from "@/engines/canvas/constants/previewQualityConstants";
import type {
  PreviewMemoryEstimate,
  PreviewMemoryEstimatesByQuality,
  PreviewMemorySource,
  PreviewMemorySourceEstimate,
} from "@/engines/canvas/models/previewMemoryModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import type { RenderSize } from "@/engines/playback-render";

const BYTES_PER_PIXEL = 4;
const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE ** 2;
const BYTES_PER_GIGABYTE = BYTES_PER_KILOBYTE ** 3;

function normalizePixelDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatUnitValue(value: number): string {
  const decimalPlaces = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const multiplier = 10 ** decimalPlaces;
  return String(Math.round(value * multiplier) / multiplier);
}

export function getPreviewMemorySourceKey(
  source: Pick<PreviewMemorySource, "sourceId">
): string {
  return JSON.stringify(["source-registry", source.sourceId]);
}

export function scalePreviewPixelSize(
  sourcePixelSize: RenderSize,
  quality: ResolvedPreviewQuality
): RenderSize {
  const scale = PREVIEW_QUALITY_SCALE[quality];
  return {
    width: Math.ceil(normalizePixelDimension(sourcePixelSize.width) * scale),
    height: Math.ceil(normalizePixelDimension(sourcePixelSize.height) * scale),
  };
}

export function estimatePreviewSourceMemory(
  source: PreviewMemorySource,
  quality: ResolvedPreviewQuality
): PreviewMemorySourceEstimate {
  const sourcePixelSize = {
    width: normalizePixelDimension(source.sourcePixelSize.width),
    height: normalizePixelDimension(source.sourcePixelSize.height),
  };
  const scaledPixelSize = scalePreviewPixelSize(sourcePixelSize, quality);

  return {
    sourceKey: getPreviewMemorySourceKey(source),
    sourceId: source.sourceId,
    sourcePixelSize,
    scaledPixelSize,
    estimatedBytes:
      scaledPixelSize.width * scaledPixelSize.height * BYTES_PER_PIXEL,
  };
}

export function estimatePreviewMemory(
  sources: readonly PreviewMemorySource[],
  quality: ResolvedPreviewQuality
): PreviewMemoryEstimate {
  const uniqueSources = new Map<string, PreviewMemorySource>();

  sources.forEach((source) => {
    const sourceKey = getPreviewMemorySourceKey(source);
    if (!uniqueSources.has(sourceKey)) uniqueSources.set(sourceKey, source);
  });

  const sourceEstimates = Array.from(uniqueSources.values(), (source) =>
    estimatePreviewSourceMemory(source, quality)
  );

  return {
    quality,
    scale: PREVIEW_QUALITY_SCALE[quality],
    sourceCount: sourceEstimates.length,
    estimatedBytes: sourceEstimates.reduce(
      (total, source) => total + source.estimatedBytes,
      0
    ),
    sources: sourceEstimates,
  };
}

export function estimatePreviewMemoryByQuality(
  sources: readonly PreviewMemorySource[]
): PreviewMemoryEstimatesByQuality {
  const estimates = RESOLVED_PREVIEW_QUALITIES.map(
    (quality) => [quality, estimatePreviewMemory(sources, quality)] as const
  );

  return Object.fromEntries(estimates) as PreviewMemoryEstimatesByQuality;
}

export function formatPreviewMemory(estimatedBytes: number): string {
  const bytes =
    Number.isFinite(estimatedBytes) && estimatedBytes > 0
      ? Math.round(estimatedBytes)
      : 0;

  if (bytes < BYTES_PER_KILOBYTE) return `${bytes} B`;
  if (bytes < BYTES_PER_MEGABYTE) {
    return `${formatUnitValue(bytes / BYTES_PER_KILOBYTE)} KB`;
  }
  if (bytes < BYTES_PER_GIGABYTE) {
    return `${formatUnitValue(bytes / BYTES_PER_MEGABYTE)} MB`;
  }
  return `${formatUnitValue(bytes / BYTES_PER_GIGABYTE)} GB`;
}
