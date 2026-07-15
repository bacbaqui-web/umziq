import type {
  Composition,
  Layer,
  SourceSyncStatus,
  TimelineItem,
} from "@/editor/types/types";

export function getTimelineItemSourceSyncStatus(
  item: TimelineItem,
  allLayersById: Map<string, Layer>,
  allCompositionsById: Map<string, Composition>
): SourceSyncStatus {
  if (item.kind === "layer") {
    return allLayersById.get(item.sourceId)?.sourceSyncStatus ?? "normal";
  }

  return allCompositionsById.get(item.sourceId)?.sourceSyncStatus ?? "normal";
}
