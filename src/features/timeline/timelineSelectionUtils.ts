import type { TimelineSelection } from "@/editor/types/editorViewTypes";
import type { TimelineItem } from "@/editor/types/types";

type TimelineSelectableItem = Pick<TimelineItem, "id" | "sourceId" | "kind">;

export function isTimelineItemSelected(
  selectedTimelineTarget: TimelineSelection,
  item: TimelineSelectableItem
) {
  return (
    (selectedTimelineTarget?.itemId
      ? selectedTimelineTarget.itemId === item.id
      : selectedTimelineTarget?.sourceId === item.sourceId) &&
    selectedTimelineTarget?.kind === item.kind
  );
}
