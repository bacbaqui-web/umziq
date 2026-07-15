import TimelineItemTrackRow from "@/features/timeline/components/TimelineItemTrackRow";
import TimelineTrackOverlays from "@/features/timeline/components/TimelineTrackOverlays";
import TimelinePropertyTrackRow from "@/features/timeline/components/TimelinePropertyTrackRow";
import { buildTimelineTrackRowLayout } from "@/features/timeline/timelineTrackRowLayout";
import type { TimelinePanelProps } from "@/features/timeline/types/timelineTypes";

type TimelineTrackRowsProps = Pick<
  TimelinePanelProps,
  | "selectedMeta"
  | "displayedTimelineRows"
  | "timelineContentWidth"
  | "selectedTimelineTarget"
  | "selectedKeyframe"
  | "draggingKeyframe"
  | "draggingKeyframeDisplayFrame"
  | "draggedTimelineItemId"
  | "timelinePxPerFrame"
  | "timelinePlayheadLeft"
  | "propertyLabels"
  | "allLayersById"
  | "allCompositionsById"
  | "formatCompactTime"
  | "onSelectTimelineItem"
  | "onAcknowledgeTimelineSourceStatus"
  | "onResolveTimelineSourceDelete"
  | "onRenameTimelineItem"
  | "onTimelineReorder"
  | "onSetDraggedTimelineItemId"
  | "onSelectKeyframe"
  | "onBeginMoveKeyframe"
  | "onBeginMoveTimelineItem"
  | "onBeginResizeTimelineItemStart"
  | "onBeginResizeTimelineItemEnd"
>;

export default function TimelineTrackRows({
  displayedTimelineRows,
  selectedTimelineTarget,
  timelineContentWidth,
  timelinePxPerFrame,
  timelinePlayheadLeft,
  ...props
}: TimelineTrackRowsProps) {
  const trackRowLayout = buildTimelineTrackRowLayout(displayedTimelineRows);

  return (
    <>
      <TimelineTrackOverlays
        displayedTimelineRows={displayedTimelineRows}
        selectedTimelineTarget={selectedTimelineTarget}
        timelineContentWidth={timelineContentWidth}
        timelinePxPerFrame={timelinePxPerFrame}
        timelinePlayheadLeft={timelinePlayheadLeft}
        {...trackRowLayout}
      />
      {displayedTimelineRows.map((row, index) => {
        const rowGridIndex = trackRowLayout.gridRowByDisplayedIndex.get(index);

        if (rowGridIndex === undefined) {
          return null;
        }

        if (row.type === "property") {
          return (
            <TimelinePropertyTrackRow
              key={`${row.item.id}-${row.property}`}
              row={row}
              rowIndex={rowGridIndex}
              timelineContentWidth={timelineContentWidth}
              timelinePxPerFrame={timelinePxPerFrame}
              selectedTimelineTarget={selectedTimelineTarget}
              {...props}
            />
          );
        }

        const nextRow = displayedTimelineRows[index + 1];
        const connectToProperties =
          nextRow?.type === "property" && nextRow.item.id === row.item.id;

        return (
          <TimelineItemTrackRow
            key={row.item.id}
            row={row}
            rowIndex={rowGridIndex}
            connectToProperties={connectToProperties}
            timelineContentWidth={timelineContentWidth}
            timelinePxPerFrame={timelinePxPerFrame}
            selectedTimelineTarget={selectedTimelineTarget}
            {...props}
          />
        );
      })}
    </>
  );
}
