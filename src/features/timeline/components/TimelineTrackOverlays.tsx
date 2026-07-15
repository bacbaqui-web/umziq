import type { TimelinePanelProps } from "@/features/timeline/types/timelineTypes";
import { isTimelineItemSelected } from "@/features/timeline/timelineSelectionUtils";
import { isTimelineGroupEndRow, type TimelineTrackRowLayout } from "@/features/timeline/timelineTrackRowLayout";
import { TIMELINE_GROUP_GAP_PX } from "@/features/timeline/timelineUiConstants";

type TimelineTrackOverlaysProps = Pick<
  TimelinePanelProps,
  | "displayedTimelineRows"
  | "selectedTimelineTarget"
  | "timelineContentWidth"
  | "timelinePxPerFrame"
  | "timelinePlayheadLeft"
> &
  TimelineTrackRowLayout;

export default function TimelineTrackOverlays({
  displayedTimelineRows,
  selectedTimelineTarget,
  timelineContentWidth,
  timelinePxPerFrame,
  timelinePlayheadLeft,
  gridRowByDisplayedIndex,
  totalTrackGridRows,
}: TimelineTrackOverlaysProps) {
  const frameGridBackground = [
    `repeating-linear-gradient(to right, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent ${Math.max(timelinePxPerFrame, 1)}px)`,
    `repeating-linear-gradient(to right, rgba(255,255,255,0.09) 0, rgba(255,255,255,0.09) 1px, transparent 1px, transparent ${Math.max(timelinePxPerFrame * 10, 10)}px)`,
  ].join(", ");
  const snappedPlayheadLeft = Math.round(timelinePlayheadLeft) - 1;

  const sharedTimelineSurface =
    totalTrackGridRows > 0 ? (
      <div
        style={{
          gridColumn: 2,
          gridRow: `2 / span ${totalTrackGridRows}`,
          position: "relative",
          zIndex: 0,
          width: timelineContentWidth,
          minWidth: timelineContentWidth,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#22252a",
            backgroundImage: frameGridBackground,
          }}
        />
      </div>
    ) : null;

  const sharedPlayheadOverlay =
    totalTrackGridRows > 0 ? (
      <div
        style={{
          gridColumn: 2,
          gridRow: `2 / span ${totalTrackGridRows}`,
          position: "relative",
          zIndex: 3,
          width: timelineContentWidth,
          minWidth: timelineContentWidth,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: snappedPlayheadLeft,
            top: 0,
            bottom: 0,
            width: 2,
            background: "rgba(245,165,36,0.95)",
            boxShadow: "0 0 0 1px rgba(245,165,36,0.18)",
          }}
        />
      </div>
    ) : null;

  const selectedGroupOverlays = displayedTimelineRows.flatMap((row, index) => {
    if (row.type !== "item" || !isTimelineItemSelected(selectedTimelineTarget, row.item)) {
      return [];
    }

    let propertyCount = 0;
    for (let nextIndex = index + 1; nextIndex < displayedTimelineRows.length; nextIndex += 1) {
      const nextRow = displayedTimelineRows[nextIndex];
      if (nextRow.type !== "property" || nextRow.item.id !== row.item.id) {
        break;
      }
      propertyCount += 1;
    }

    const startGridRow = gridRowByDisplayedIndex.get(index);
    const endGridRow = gridRowByDisplayedIndex.get(index + propertyCount);

    if (startGridRow === undefined || endGridRow === undefined) {
      return [];
    }

    return [
      <div
        key={`selected-block-${row.item.id}`}
        style={{
          gridColumn: "1 / span 2",
          gridRow: `${startGridRow} / span ${endGridRow - startGridRow + 1}`,
          position: "relative",
          pointerEvents: "none",
          zIndex: 4,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "1px solid rgba(214, 78, 61, 0.96)",
            borderRadius: 6,
            background: "transparent",
            boxShadow: "0 0 0 1px rgba(214, 78, 61, 0.12)",
          }}
        />
      </div>,
    ];
  });

  const groupGapRows = displayedTimelineRows.flatMap((row, index) => {
    if (!isTimelineGroupEndRow(displayedTimelineRows, index) || index >= displayedTimelineRows.length - 1) {
      return [];
    }

    const rowGrid = gridRowByDisplayedIndex.get(index);

    if (rowGrid === undefined) {
      return [];
    }

    return [
      <div
        key={`group-gap-${row.item.id}-${index}`}
        style={{
          gridColumn: "1 / span 2",
          gridRow: rowGrid + 1,
          height: TIMELINE_GROUP_GAP_PX,
          pointerEvents: "none",
        }}
      />,
    ];
  });

  return (
    <>
      {sharedTimelineSurface}
      {sharedPlayheadOverlay}
      {selectedGroupOverlays}
      {groupGapRows}
    </>
  );
}
