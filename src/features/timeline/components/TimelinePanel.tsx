import { memo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import TimelineHeader from "@/features/timeline/components/TimelineHeader";
import TimelineMiniFlowchart from "@/features/timeline/components/TimelineMiniFlowchart";
import TimelineRuler from "@/features/timeline/components/TimelineRuler";
import TimelineTrackRows from "@/features/timeline/components/TimelineTrackRows";
import type { TimelineEngineViewProps as TimelinePanelProps } from "@/engines/timeline";

function TimelinePanel(props: TimelinePanelProps) {
  const { readModel, commands, interactions, rulerRef, switcherRef, switcherTriggerRef, scrollContainerRef } = props;
  const [isMiniFlowchartOpen, setIsMiniFlowchartOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const isInteractiveTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement
    && !!target.closest("input, textarea, select, button, a, [contenteditable='true'], [role='button']")
  );

  const closeMiniFlowchart = () => {
    setIsMiniFlowchartOpen(false);
    window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  };

  const handlePanelPointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (!isInteractiveTarget(event.target)) panelRef.current?.focus({ preventScroll: true });
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && isMiniFlowchartOpen) {
      event.preventDefault();
      closeMiniFlowchart();
      return;
    }
    if (event.key !== "Tab") return;
    if (isMiniFlowchartOpen) {
      event.preventDefault();
      closeMiniFlowchart();
      return;
    }
    if (isInteractiveTarget(event.target)) return;
    event.preventDefault();
    setIsMiniFlowchartOpen(true);
  };

  return (
    <div
      ref={panelRef}
      className="editor-panel-scroll"
      tabIndex={-1}
      aria-label="타임라인"
      onPointerDownCapture={handlePanelPointerDownCapture}
      onKeyDown={handlePanelKeyDown}
      style={{
        position: "relative",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: 10,
        overflow: "hidden",
      }}
    >
      <TimelineHeader
        viewModel={readModel.header}
        commands={commands}
        interactions={interactions}
        switcherRef={switcherRef}
        switcherTriggerRef={switcherTriggerRef}
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

      {isMiniFlowchartOpen && (
        <TimelineMiniFlowchart
          segments={readModel.header.breadcrumbSegments}
          children={readModel.header.switcher.items}
          onClose={closeMiniFlowchart}
          onSelectComposition={commands.selectComposition}
        />
      )}
    </div>
  );
}

export default memo(TimelinePanel);
