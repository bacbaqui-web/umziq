import type { PsdSourceIdentity } from "@/models";
import type { RenderSize } from "@/engines/playback-render";
import type {
  PreviewBitmapFactoryInput,
  PreviewBitmapFactoryResult,
} from "@/engines/canvas/models/previewBitmapFactoryModel";
import type { PreviewCacheRuntime } from "@/engines/canvas/models/previewCacheModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import type { PreviewGeneration } from "@/engines/canvas/models/previewRuntimeModel";

export type PreviewBuildSource = {
  readonly sourceId: string;
  readonly sourceIds: readonly string[];
  readonly sourceIdentity?: PsdSourceIdentity | null;
  readonly sourceFingerprint: string | null;
  readonly sourceCanvas: HTMLCanvasElement;
  readonly logicalSize: RenderSize;
};

export type PreviewBitmapFactoryPort = (
  input: PreviewBitmapFactoryInput
) => Promise<PreviewBitmapFactoryResult>;

export type PreviewCacheBuildError = {
  readonly sourceId: string;
  readonly code: string;
  readonly message: string;
};

export type PreviewCacheBuildProgress = {
  readonly generation: PreviewGeneration;
  readonly quality: ResolvedPreviewQuality;
  readonly completedCount: number;
  readonly totalCount: number;
  readonly failedCount: number;
};

export type PreviewCacheBuildResult = {
  readonly status: "completed" | "failed" | "stale";
  readonly generation: PreviewGeneration;
  readonly quality: ResolvedPreviewQuality;
  readonly resourceKeyBySourceId: ReadonlyMap<string, string>;
  readonly errors: readonly PreviewCacheBuildError[];
};

export type PreviewCacheBuildOptions = {
  readonly sources: readonly PreviewBuildSource[];
  readonly quality: ResolvedPreviewQuality;
  readonly cache: PreviewCacheRuntime;
  readonly factory?: PreviewBitmapFactoryPort;
  readonly concurrency?: number;
  readonly onProgress?: (progress: PreviewCacheBuildProgress) => void;
};

export type PreviewBuildReadModel = {
  readonly status: "idle" | "building" | "ready" | "error";
  readonly generation: PreviewGeneration;
  readonly activeGeneration: PreviewGeneration | null;
  readonly activeQuality: ResolvedPreviewQuality | null;
  readonly quality: ResolvedPreviewQuality;
  readonly completedCount: number;
  readonly totalCount: number;
  readonly failedCount: number;
};
