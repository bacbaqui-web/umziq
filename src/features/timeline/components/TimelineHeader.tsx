import type { RefObject } from "react";
import type { TimelineCommands, TimelineHeaderViewModel, TimelineInteractionCommands } from "@/engines/timeline";
import TimelineCompositionSwitcher from "@/features/timeline/components/TimelineCompositionSwitcher";
import TimelineSelectionBreadcrumb from "@/features/timeline/components/TimelineSelectionBreadcrumb";
import TimelineTransportControls from "@/features/timeline/components/TimelineTransportControls";

type Props = {
  viewModel: TimelineHeaderViewModel;
  commands: TimelineCommands;
  interactions: TimelineInteractionCommands;
  switcherRef: RefObject<HTMLDivElement | null>;
  switcherTriggerRef: RefObject<HTMLButtonElement | null>;
};

export default function TimelineHeader({ viewModel, commands, interactions, switcherRef, switcherTriggerRef }: Props) {
  if (!viewModel.visible) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, minWidth: 0 }}>
      <div ref={switcherRef} style={{ position: "relative", minWidth: 0, flex: 1 }}>
        <TimelineSelectionBreadcrumb
          segments={viewModel.breadcrumbSegments}
          selectionLabel={viewModel.selectionLabel}
          isOpen={viewModel.switcher.isOpen}
          triggerRef={switcherTriggerRef}
          onSelectComposition={commands.selectComposition}
          onToggle={commands.toggleCompositionSwitcher}
        />
        {viewModel.switcher.isOpen && (
          <TimelineCompositionSwitcher
            items={viewModel.switcher.items}
            anchorRef={switcherTriggerRef}
            onSelectComposition={commands.selectComposition}
          />
        )}
      </div>
      <HeaderActionButton
        label="선택한 타임라인 아이템 복제"
        disabled={!viewModel.canDuplicateSelectedItem}
        onClick={interactions.duplicateSelectedTimelineItem}
      >
        <path d="M4 2.5h5.5v6H4zM2.5 4H8v5.5H2.5z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </HeaderActionButton>
      <HeaderActionButton
        label="선택한 타임라인 아이템 분할"
        disabled={!viewModel.canSplitSelectedItem}
        onClick={interactions.splitSelectedTimelineItem}
      >
        <path d="M3 2.5L6 6l-2 3.5M9 2.5L6 6l2 3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </HeaderActionButton>
      <TimelineTransportControls
        isPlaying={viewModel.isPlaying}
        onResetToStart={commands.reset}
        onStepBackward={commands.stepBackward}
        onTogglePlayback={commands.togglePlayback}
        onStepForward={commands.stepForward}
      />
    </div>
  );
}

function HeaderActionButton({ label, disabled, onClick, children }: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className="ui-button ui-button--icon" type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      style={{ width: 28, height: 28, minHeight: 28, background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)", color: disabled ? "#6e7782" : "#d8e0ea", flex: "0 0 auto" }}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">{children}</svg>
    </button>
  );
}
