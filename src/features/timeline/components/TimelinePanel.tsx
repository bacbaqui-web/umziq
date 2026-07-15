import TimelineHeader from "@/features/timeline/components/TimelineHeader";
import TimelineRuler from "@/features/timeline/components/TimelineRuler";
import TimelineTrackRows from "@/features/timeline/components/TimelineTrackRows";
import type { TimelinePanelProps } from "@/features/timeline/types/timelineTypes";

export default function TimelinePanel(props: TimelinePanelProps) {
  const { selectedComp, selectedMeta, timelineNameColWidth } = props;

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: 8,
        overflow: "hidden",
      }}
    >
      <TimelineHeader {...props} />

      {selectedComp && selectedMeta ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "grid",
                width: "100%",
                gridTemplateColumns: `${timelineNameColWidth}px minmax(0, 1fr)`,
                columnGap: 6,
                rowGap: 0,
              }}
            >
              <TimelineRuler {...props} />
              <TimelineTrackRows {...props} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: "#888" }}>Timeline unavailable.</div>
      )}
    </div>
  );
}
