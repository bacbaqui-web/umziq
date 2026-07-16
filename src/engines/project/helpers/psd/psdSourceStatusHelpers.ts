import type { Composition, SourceSyncStatus } from "@/models";
import type { PsdRefreshCounts } from "@/engines/project/models/psdRefreshResultModel";

export const INITIAL_PSD_REFRESH_COUNTS: PsdRefreshCounts = {
  updated: 0,
  added: 0,
  deletePending: 0,
};

export function mergePsdRefreshCounts(
  ...counts: PsdRefreshCounts[]
): PsdRefreshCounts {
  return counts.reduce(
    (total, current) => ({
      updated: total.updated + current.updated,
      added: total.added + current.added,
      deletePending: total.deletePending + current.deletePending,
    }),
    INITIAL_PSD_REFRESH_COUNTS
  );
}

export function markCompositionSubtreeStatus(
  composition: Composition,
  sourceSyncStatus: SourceSyncStatus
): Composition {
  return {
    ...composition,
    sourceSyncStatus,
    children: composition.children?.map((child) =>
      markCompositionSubtreeStatus(child, sourceSyncStatus)
    ),
    layers: composition.layers.map((layer) => ({ ...layer, sourceSyncStatus })),
  };
}

export function countSourceEntitiesInComposition(composition: Composition): number {
  return (
    1 +
    composition.layers.length +
    (composition.children?.reduce(
      (total, child) => total + countSourceEntitiesInComposition(child),
      0
    ) ?? 0)
  );
}

export function getSourceStatusAfterRefresh(
  existingStatus: SourceSyncStatus | undefined,
  fingerprintChanged: boolean
): SourceSyncStatus {
  if (existingStatus === "new") return "new";
  if (existingStatus === "deletePending" || existingStatus === "missing") {
    return "updated";
  }
  if (fingerprintChanged || existingStatus === "updated") return "updated";
  return "normal";
}

export function getSourceStatusAfterMissing(
  existingStatus: SourceSyncStatus | undefined
): SourceSyncStatus {
  return existingStatus === "missing" ? "missing" : "deletePending";
}
