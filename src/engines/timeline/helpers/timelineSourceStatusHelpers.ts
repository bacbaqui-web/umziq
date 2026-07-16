import type { Composition, Layer, SourceSyncStatus, TimelineItem } from "@/models";
import type { TimelineSourceStatusViewModel } from "@/engines/timeline/models/timelineViewModel";

export function resolveTimelineSourceStatus(
  item: TimelineItem,
  allLayersById: Map<string, Layer>,
  allCompositionsById: Map<string, Composition>
): SourceSyncStatus {
  return item.kind === "layer"
    ? allLayersById.get(item.sourceId)?.sourceSyncStatus ?? "normal"
    : allCompositionsById.get(item.sourceId)?.sourceSyncStatus ?? "normal";
}

export function buildTimelineSourceStatusViewModel(status: SourceSyncStatus): TimelineSourceStatusViewModel {
  const badge = status === "updated"
    ? { label: "update", color: "#7fb0de", background: "rgba(63, 96, 128, 0.34)" }
    : status === "new"
      ? { label: "new", color: "#96cda0", background: "rgba(50, 90, 56, 0.34)" }
      : status === "deletePending"
        ? { label: "delete?", color: "#f2a3a9", background: "rgba(126, 44, 50, 0.42)" }
        : status === "missing"
          ? { label: "missing", color: "#d7b27d", background: "rgba(111, 78, 39, 0.34)" }
          : null;
  return { status, isDeletePending: status === "deletePending", badge };
}
