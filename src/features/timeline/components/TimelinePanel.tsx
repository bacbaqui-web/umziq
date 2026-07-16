import TimelineHeader from "@/features/timeline/components/TimelineHeader";
import TimelineRuler from "@/features/timeline/components/TimelineRuler";
import TimelineTrackRows from "@/features/timeline/components/TimelineTrackRows";
import type { TimelineEngineViewProps as TimelinePanelProps } from "@/engines/timeline";

export default function TimelinePanel(props: TimelinePanelProps) {
  const { readModel, commands, interactions, rulerRef, switcherRef, scrollContainerRef } = props;

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
      <TimelineHeader
        viewModel={readModel.header}
        commands={commands}
        interactions={interactions}
        switcherRef={switcherRef}
      />

      {readModel.available ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
          <div
            ref={scrollContainerRef}
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
                gridTemplateColumns: `${readModel.nameColumnWidth}px minmax(0, 1fr)`,
                columnGap: 6,
                rowGap: 0,
              }}
            >
              <TimelineRuler viewModel={readModel.ruler} commands={commands} rulerRef={rulerRef} />
              <TimelineTrackRows readModel={readModel} interactions={interactions} />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: "#888" }}>Timeline unavailable.</div>
      )}
    </div>
  );
}
