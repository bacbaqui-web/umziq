import type { PreviewScene } from "@/engines/playback-render";

export type PreviewNodeCacheStats = {
  readonly updatedNodeCount: number;
  readonly reusedNodeCount: number;
};

export type PreviewNodeCacheResult = {
  readonly scene: PreviewScene | null;
  readonly stats: PreviewNodeCacheStats;
};
