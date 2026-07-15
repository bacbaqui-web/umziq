import { useEffect, useRef, useState } from "react";
import type { TimelinePanelProps } from "@/features/timeline/types/timelineTypes";
import TimelineCompositionSwitcher from "@/features/timeline/components/TimelineCompositionSwitcher";
import TimelineSelectionBreadcrumb from "@/features/timeline/components/TimelineSelectionBreadcrumb";
import TimelineTransportControls from "@/features/timeline/components/TimelineTransportControls";

type TimelineHeaderProps = Pick<
  TimelinePanelProps,
  | "selectedMeta"
  | "selectionBreadcrumbPath"
  | "compositionSwitcherParentName"
  | "compositionSwitcherParentIsCurrent"
  | "compositionSwitcherItems"
  | "isPlaying"
  | "onResetToStart"
  | "onStepBackward"
  | "onTogglePlayback"
  | "onDuplicateSelectedTimelineItem"
  | "onSplitSelectedTimelineItem"
  | "onStepForward"
  | "onSwitchComposition"
  | "canDuplicateSelectedTimelineItem"
  | "canSplitSelectedTimelineItem"
>;

export default function TimelineHeader({
  selectedMeta,
  selectionBreadcrumbPath,
  compositionSwitcherParentName,
  compositionSwitcherParentIsCurrent,
  compositionSwitcherItems,
  isPlaying,
  onResetToStart,
  onStepBackward,
  onTogglePlayback,
  onDuplicateSelectedTimelineItem,
  onSplitSelectedTimelineItem,
  onStepForward,
  onSwitchComposition,
  canDuplicateSelectedTimelineItem,
  canSplitSelectedTimelineItem,
}: TimelineHeaderProps) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSwitcherOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isSwitcherOpen]);

  if (!selectedMeta) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 8,
        minWidth: 0,
      }}
    >
      <div
        ref={switcherRef}
        style={{
          position: "relative",
          minWidth: 0,
          flex: 1,
        }}
      >
        <TimelineSelectionBreadcrumb
          path={selectionBreadcrumbPath}
          isOpen={isSwitcherOpen}
          onClick={() => setIsSwitcherOpen((prev) => !prev)}
        />
        {isSwitcherOpen && (
          <TimelineCompositionSwitcher
            parentName={compositionSwitcherParentName}
            parentIsCurrent={compositionSwitcherParentIsCurrent}
            items={compositionSwitcherItems}
            onSelectComposition={(compId) => {
              onSwitchComposition(compId);
              setIsSwitcherOpen(false);
            }}
          />
        )}
      </div>
      <button
        type="button"
        aria-label="선택한 타임라인 아이템 복제"
        title="선택한 타임라인 아이템 복제"
        disabled={!canDuplicateSelectedTimelineItem}
        onClick={onDuplicateSelectedTimelineItem}
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.1)",
          background: canDuplicateSelectedTimelineItem
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.02)",
          color: canDuplicateSelectedTimelineItem ? "#d8e0ea" : "#6e7782",
          padding: 0,
          cursor: canDuplicateSelectedTimelineItem ? "pointer" : "not-allowed",
          flex: "0 0 auto",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M4 2.5h5.5v6H4zM2.5 4H8v5.5H2.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="선택한 타임라인 아이템 분할"
        title="선택한 타임라인 아이템 분할"
        disabled={!canSplitSelectedTimelineItem}
        onClick={onSplitSelectedTimelineItem}
        style={{
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.1)",
          background: canSplitSelectedTimelineItem
            ? "rgba(255,255,255,0.04)"
            : "rgba(255,255,255,0.02)",
          color: canSplitSelectedTimelineItem ? "#d8e0ea" : "#6e7782",
          padding: 0,
          cursor: canSplitSelectedTimelineItem ? "pointer" : "not-allowed",
          flex: "0 0 auto",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3 2.5L6 6l-2 3.5M9 2.5L6 6l2 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <TimelineTransportControls
        isPlaying={isPlaying}
        onResetToStart={onResetToStart}
        onStepBackward={onStepBackward}
        onTogglePlayback={onTogglePlayback}
        onStepForward={onStepForward}
      />
    </div>
  );
}
