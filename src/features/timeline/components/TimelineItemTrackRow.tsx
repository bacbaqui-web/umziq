import { useEffect, useRef, type FocusEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  TIMELINE_ITEM_ROW_HEIGHT,
  type TimelineInteractionCommands,
  type TimelineItemRowViewModel,
} from "@/engines/timeline";

export default function TimelineItemTrackRow({
  viewModel,
  contentWidth,
  interactions,
}: {
  viewModel: TimelineItemRowViewModel;
  contentWidth: number;
  interactions: TimelineInteractionCommands;
}) {
  const item = viewModel.item;
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const isEditingName = viewModel.isEditingName;
  const isDeletePending = viewModel.source.isDeletePending;
  const statusBadge = viewModel.source.badge;

  useEffect(() => {
    if (!isEditingName) {
      return;
    }

    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isEditingName]);

  const handleSelectFullName = (
    event: ReactMouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>
  ) => {
    event.currentTarget.select();
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    interactions.handleTimelineItemNameKey(event.key);
  };

  const handleRowNameClick = () => {
    if (isEditingName) {
      return;
    }

    interactions.activateTimelineItem(item, viewModel.source.status);
  };

  return (
    <div style={{ display: "contents" }}>
      <div
        draggable={!isEditingName}
        onDragStart={() => {
          if (!isEditingName) {
            interactions.setDraggedTimelineItemId(item.id);
          }
        }}
        onDragEnd={() => interactions.setDraggedTimelineItemId(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => interactions.reorderTimelineItem(item.id)}
        onClick={handleRowNameClick}
        onDoubleClick={(event) => {
          if (isDeletePending) {
            return;
          }

          event.stopPropagation();
          interactions.beginRenameTimelineItem(item);
        }}
        style={{
          gridColumn: 1,
          gridRow: viewModel.rowIndex,
          position: "relative",
          zIndex: 1,
          padding: "0 10px",
          height: TIMELINE_ITEM_ROW_HEIGHT,
          background: viewModel.rowBackground,
          border: viewModel.selected
            ? "1px solid transparent"
            : isDeletePending
              ? "1px solid rgba(160, 70, 78, 0.7)"
              : "1px solid #3a3a3a",
          borderRadius: viewModel.connectToProperties ? "6px 6px 0 0" : 6,
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: isEditingName ? "text" : "grab",
          boxSizing: "border-box",
        }}
      >
        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={viewModel.draftName}
            onChange={(event) => interactions.changeTimelineItemName(event.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={interactions.commitTimelineItemName}
            onFocus={handleSelectFullName}
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
              borderRadius: 4,
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
          <span
            style={{
              minWidth: 0,
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.name}
            </span>

            {statusBadge && (
              <span
                style={{
                  flex: "0 0 auto",
                  padding: "1px 5px",
                  borderRadius: 999,
                  background: statusBadge.background,
                  color: statusBadge.color,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                }}
              >
                {statusBadge.label}
              </span>
            )}
          </span>
        )}

        {viewModel.showDeleteDecision && (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: "absolute",
              left: 8,
              top: "calc(100% + 4px)",
              zIndex: 10,
              display: "flex",
              gap: 6,
              padding: 6,
              borderRadius: 6,
              background: "#1e1618",
              border: "1px solid rgba(160, 70, 78, 0.78)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
            }}
          >
            <button
              onClick={() => {
                interactions.resolveTimelineSourceDelete(item, "delete");
              }}
              style={{
                border: "1px solid rgba(192, 95, 105, 0.85)",
                background: "rgba(111, 34, 40, 0.92)",
                color: "#f6d9dd",
                borderRadius: 4,
                padding: "3px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              delete
            </button>

            <button
              onClick={() => {
                interactions.resolveTimelineSourceDelete(item, "keep");
              }}
              style={{
                border: "1px solid rgba(180, 180, 180, 0.18)",
                background: "#24282d",
                color: "#d7dde5",
                borderRadius: 4,
                padding: "3px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              keep
            </button>
          </div>
        )}
      </div>

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => interactions.reorderTimelineItem(item.id)}
        onClick={() => interactions.selectTimelineItem(item)}
        style={{
          gridColumn: 2,
          gridRow: viewModel.rowIndex,
          position: "relative",
          zIndex: 2,
          width: contentWidth,
          minWidth: contentWidth,
          height: TIMELINE_ITEM_ROW_HEIGHT,
          border: "none",
          borderRadius: 0,
          overflow: "visible",
          background: "transparent",
          boxSizing: "border-box",
        }}
      >
        {isDeletePending && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(133, 46, 52, 0.18)",
              pointerEvents: "none",
            }}
          />
        )}

        <div
          style={{
            position: "absolute",
            left: viewModel.trackLeft,
            top: 5,
            height: 14,
            width: viewModel.trackWidth,
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.12)",
            background: viewModel.trackBackground,
            opacity: viewModel.trackOpacity,
            display: "flex",
            alignItems: "center",
            paddingLeft: 0,
            paddingRight: 0,
            boxSizing: "border-box",
            color: "#fff",
            fontSize: 11,
            cursor: "grab",
            minWidth: 12,
            zIndex: 2,
            boxShadow: "inset 1px 0 0 rgba(0,0,0,0.26), inset -1px 0 0 rgba(0,0,0,0.26)",
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            interactions.beginMoveTimelineItem(event.clientX, item);
          }}
        >
          <div
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              interactions.beginResizeTimelineItemStart(event.clientX, item);
            }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 8,
              cursor: "ew-resize",
            }}
          />

          <div
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              interactions.beginResizeTimelineItemEnd(event.clientX, item);
            }}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 8,
              cursor: "ew-resize",
            }}
          />
        </div>
      </div>
    </div>
  );
}
