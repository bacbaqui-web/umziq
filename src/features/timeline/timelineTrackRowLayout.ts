import type { TimelineRow } from "@/editor/types/editorViewTypes";

export type TimelineTrackRowLayout = {
  gridRowByDisplayedIndex: Map<number, number>;
  totalTrackGridRows: number;
};

export function isTimelineGroupEndRow(displayedTimelineRows: TimelineRow[], index: number) {
  const currentRow = displayedTimelineRows[index];
  const nextRow = displayedTimelineRows[index + 1];

  return !nextRow || nextRow.type === "item" || nextRow.item.id !== currentRow.item.id;
}

export function buildTimelineTrackRowLayout(
  displayedTimelineRows: TimelineRow[]
): TimelineTrackRowLayout {
  const gridRowByDisplayedIndex = new Map<number, number>();
  let nextGridRow = 2;

  displayedTimelineRows.forEach((_, index) => {
    gridRowByDisplayedIndex.set(index, nextGridRow);
    nextGridRow += 1;

    if (isTimelineGroupEndRow(displayedTimelineRows, index) && index < displayedTimelineRows.length - 1) {
      nextGridRow += 1;
    }
  });

  return {
    gridRowByDisplayedIndex,
    totalTrackGridRows: nextGridRow - 2,
  };
}
