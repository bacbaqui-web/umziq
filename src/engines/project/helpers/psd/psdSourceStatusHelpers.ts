import type { Composition, SourceSyncStatus } from "@/models";
import type { PsdRefreshCounts } from "@/engines/project/models/psdRefreshResultModel";

export const INITIAL_PSD_REFRESH_COUNTS: PsdRefreshCounts = {
  newGroups: 0,
  newLayers: 0,
  updated: 0,
  missing: 0,
  deletePending: 0,
};

export function mergePsdRefreshCounts(
  ...counts: PsdRefreshCounts[]
): PsdRefreshCounts {
  return counts.reduce(
    (total, current) => ({
      newGroups: total.newGroups + current.newGroups,
      newLayers: total.newLayers + current.newLayers,
      updated: total.updated + current.updated,
      missing: total.missing + current.missing,
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

export function countNewSourcesInComposition(
  composition: Composition
): Pick<PsdRefreshCounts, "newGroups" | "newLayers"> {
  return (composition.children ?? []).reduce(
    (counts, child) => {
      const childCounts = countNewSourcesInComposition(child);
      return {
        newGroups: counts.newGroups + childCounts.newGroups,
        newLayers: counts.newLayers + childCounts.newLayers,
      };
    },
    {
      newGroups: 1,
      newLayers: composition.layers.length,
    }
  );
}

export function createPsdRefreshSummary(
  compositionId: string,
  compositionName: string,
  counts: PsdRefreshCounts
) {
  return {
    compositionId,
    compositionName,
    ...counts,
    problematic: counts.missing + counts.deletePending,
  };
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
