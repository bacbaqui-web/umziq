import type { TimelineInteractionCommands, TimelineReadModel } from "@/engines/timeline";
import TimelineItemTrackRow from "@/features/timeline/components/TimelineItemTrackRow";
import TimelinePropertyTrackRow from "@/features/timeline/components/TimelinePropertyTrackRow";
import TimelineTrackOverlays from "@/features/timeline/components/TimelineTrackOverlays";

export default function TimelineTrackRows({ readModel, interactions }: {
  readModel: TimelineReadModel;
  interactions: TimelineInteractionCommands;
}) {
  return (
    <>
      <TimelineTrackOverlays viewModel={readModel.overlay} contentWidth={readModel.ruler.contentWidth} />
      {readModel.rows.map((row) => row.type === "property" ? (
        <TimelinePropertyTrackRow key={`${row.item.id}-${row.property}`} viewModel={row} contentWidth={readModel.ruler.contentWidth} interactions={interactions} />
      ) : (
        <TimelineItemTrackRow key={row.item.id} viewModel={row} contentWidth={readModel.ruler.contentWidth} interactions={interactions} />
      ))}
    </>
  );
}
