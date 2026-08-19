import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  TimelineInteractionCommands,
  TimelineItemRowViewModel,
} from "@/engines/timeline";
import LayerDocumentIcon from "@/shared/components/LayerDocumentIcon";
import {
  GROUP_HOVER_BACKGROUND,
  GROUP_SELECTED_BACKGROUND,
  GROUP_SELECTED_GLOW,
} from "@/shared/styles/groupVisualStyles";
import TimelineItemSourceStatus from "@/features/timeline/components/TimelineItemSourceStatus";

export default function TimelineItemNameCell({
  viewModel,
  interactions,
  onContextMenu,
}: {
  viewModel: TimelineItemRowViewModel;
  interactions: TimelineInteractionCommands;
  onContextMenu: (
    event: ReactMouseEvent<HTMLElement>
  ) => void;
}) {
  const item = viewModel.item;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const isEditing = viewModel.isEditingName;
  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditing]);
  const selectFullName = (
    event: ReactMouseEvent<HTMLInputElement> |
      FocusEvent<HTMLInputElement>
  ) => event.currentTarget.select();
  const handleNameKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => interactions.handleTimelineItemNameKey(event.key);

  return (
    <div
      data-layer-document-id={item.id}
      data-timeline-selected={viewModel.selected ? "true" : "false"}
      draggable={!isEditing}
      onDragStart={() => {
        if (!isEditing) {
          interactions.setDraggedTimelineItemId(item.id);
        }
      }}
      onDragEnd={() =>
        interactions.setDraggedTimelineItemId(null)
      }
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => interactions.reorderTimelineItem(item.id)}
      onClick={() => {
        if (!isEditing) {
          interactions.activateTimelineItem(
            item.id,
            viewModel.source.status
          );
        }
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onContextMenu={onContextMenu}
      onDoubleClick={(event) => {
        if (viewModel.source.isDeletePending) return;
        event.stopPropagation();
        interactions.beginRenameTimelineItem(item.id);
      }}
      style={{
        gridColumn: 1,
        gridRow: viewModel.rowIndex,
        position: "relative",
        zIndex: 1,
        padding: "0 8px 0 2px",
        height: viewModel.rowHeight,
        background: item.entityKind === "composition"
          ? viewModel.selected
            ? GROUP_SELECTED_BACKGROUND
            : hovered
              ? GROUP_HOVER_BACKGROUND
              : viewModel.rowBackground
          : viewModel.rowBackground,
        border: viewModel.selected
          ? "1px solid transparent"
          : viewModel.source.isDeletePending
            ? "1px solid rgba(160, 70, 78, 0.7)"
            : "1px solid #3a3a3a",
        borderRadius: viewModel.connectToProperties
          ? "6px 6px 0 0"
          : 6,
        boxShadow:
          viewModel.selected && item.entityKind === "composition"
            ? GROUP_SELECTED_GLOW
            : "none",
        fontSize: 12,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: isEditing ? "text" : "pointer",
        boxSizing: "border-box",
      }}
    >
      {isEditing ? (
        <input
          className="ui-input ui-input--compact"
          ref={inputRef}
          value={viewModel.draftName}
          onChange={(event) =>
            interactions.changeTimelineItemName(
              event.target.value
            )
          }
          onKeyDown={handleNameKeyDown}
          onBlur={interactions.commitTimelineItemName}
          onFocus={selectFullName}
          onClick={(event) => {
            event.stopPropagation();
            event.currentTarget.select();
          }}
          onMouseUp={(event) => {
            event.preventDefault();
            event.currentTarget.select();
          }}
          style={{
            minWidth: 0,
            flex: 1,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(12, 15, 20, 0.72)",
            color: "#eef5fc",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 0 #eef5fc",
            caretColor: "transparent",
            outline: "none",
            padding: "2px 6px",
            fontSize: 13,
          }}
        />
      ) : (
        <span style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            aria-label={`${item.name} ${viewModel.expanded ? "타임라인 상세 고정 해제" : "타임라인 상세 고정"}`}
            aria-pressed={viewModel.expanded}
            title={viewModel.expanded ? "타임라인 상세 고정 해제" : "타임라인 상세 고정"}
            onClick={(event) => {
              event.stopPropagation();
              interactions.toggleTimelineItemExpanded(item.id);
            }}
            style={{
              width: 22,
              height: 22,
              padding: 0,
              border: "none",
              borderRadius: 4,
              background: viewModel.expanded ? "rgba(72, 173, 111, 0.14)" : "transparent",
              color: viewModel.expanded ? "#6ed596" : "#8f9da8",
              cursor: "pointer",
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ opacity: viewModel.expanded ? 1 : 0.78, transform: viewModel.expanded ? "rotate(-8deg)" : "none", transition: "color 100ms ease, opacity 100ms ease, transform 100ms ease" }}>
              <path d="M16 9V4l1-1V2H7v1l1 1v5c0 1.1-.9 2-2 2v2h5.2v7h1.6v-7H18v-2c-1.1 0-2-.9-2-2Z" />
            </svg>
          </button>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", transform: item.iconKind === "layer" ? "translateY(3px)" : undefined }}>
            <LayerDocumentIcon kind={item.mediaKind === "audio" ? "audio" : item.iconKind} audioProvenance={item.audioProvenance} size={14} />
          </span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name}
          </span>
          {viewModel.source.badge && (
            <span className={`ui-badge${viewModel.source.badge.label === "NEW" ? " ui-badge--new" : ""}`} style={{ background: viewModel.source.badge.label === "NEW" ? undefined : viewModel.source.badge.background, color: viewModel.source.badge.label === "NEW" ? undefined : viewModel.source.badge.color }}>
              {viewModel.source.badge.label}
            </span>
          )}
        </span>
      )}
      <TimelineItemSourceStatus
        itemId={item.id}
        visible={viewModel.showDeleteDecision}
        interactions={interactions}
      />
    </div>
  );
}
