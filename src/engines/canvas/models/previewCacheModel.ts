import type { RenderSize } from "@/engines/playback-render";
import type { PsdSourceIdentity } from "@/models";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import type {
  PreviewGeneration,
  PreviewRuntimeResource,
} from "@/engines/canvas/models/previewRuntimeModel";

export type PreviewCacheKeyInput = {
  readonly sourceId: string;
  readonly sourceIdentity?: PsdSourceIdentity | null;
  readonly sourceFingerprint: string | null;
  readonly quality: ResolvedPreviewQuality;
  readonly logicalSize: RenderSize;
};

export type PreviewCacheCommitStatus =
  | "committed"
  | "hit"
  | "stale"
  | "disposed";

export type PreviewCacheCommitResult = {
  readonly status: PreviewCacheCommitStatus;
  readonly resource: PreviewRuntimeResource | null;
  readonly evictedKeys: readonly string[];
};

export type PreviewCacheSnapshot = {
  readonly generation: PreviewGeneration;
  readonly budgetBytes: number;
  readonly trackedBytes: number;
  readonly size: number;
  readonly hitCount: number;
  readonly missCount: number;
  readonly activeKeys: readonly string[];
  readonly overBudget: boolean;
  readonly disposed: boolean;
};

export type PreviewCacheRuntime = {
  readonly beginBuild: () => PreviewGeneration;
  readonly getGeneration: () => PreviewGeneration;
  readonly get: (key: string) => PreviewRuntimeResource | null;
  readonly peek: (key: string) => PreviewRuntimeResource | null;
  readonly commit: (
    resource: PreviewRuntimeResource
  ) => PreviewCacheCommitResult;
  readonly setActiveKeys: (keys: readonly string[]) => readonly string[];
  readonly setBudgetBytes: (budgetBytes: number) => readonly string[];
  readonly remove: (key: string) => boolean;
  readonly retainKeys: (keys: readonly string[]) => readonly string[];
  readonly clear: () => void;
  readonly getSnapshot: () => PreviewCacheSnapshot;
  readonly dispose: () => void;
};
