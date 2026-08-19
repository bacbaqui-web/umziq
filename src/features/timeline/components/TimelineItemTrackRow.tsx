import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  TimelineInteractionCommands,
  TimelineItemRowViewModel,
} from "@/engines/timeline";
import TimelineItemContextMenu, {
  type TimelineItemContextMenuPoint,
} from "@/features/timeline/components/TimelineItemContextMenu";
import TimelineItemNameCell from "@/features/timeline/components/TimelineItemNameCell";
import TimelineItemTrackClip from "@/features/timeline/components/TimelineItemTrackClip";

export default function TimelineItemTrackRow({
  viewModel,
  contentWidth,
  interactions,
}: {
  viewModel: TimelineItemRowViewModel;
  contentWidth: number;
  interactions: TimelineInteractionCommands;
}) {
  const [contextMenu, setContextMenu] =
    useState<TimelineItemContextMenuPoint | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const handleKeyDown = (
      event: globalThis.KeyboardEvent
    ) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const handleContextMenu = (
    event: ReactMouseEvent<HTMLElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    interactions.selectTimelineItem(viewModel.item.id);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  };

  return (
    <div style={{ display: "contents" }}>
      <TimelineItemNameCell
        viewModel={viewModel}
        interactions={interactions}
        onContextMenu={handleContextMenu}
      />
      <TimelineItemTrackClip
        viewModel={viewModel}
        contentWidth={contentWidth}
        interactions={interactions}
        onContextMenu={handleContextMenu}
      />
      {contextMenu && (
        <TimelineItemContextMenu
          itemId={viewModel.item.id}
          itemName={viewModel.item.name}
          point={contextMenu}
          interactions={interactions}
          close={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
