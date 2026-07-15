import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { TimelineRow } from "@/editor/types/editorViewTypes";
import { getTimelineItemSourceSyncStatus } from "@/features/timeline/timelineSourceSyncUtils";
import { isTimelineItemSelected } from "@/features/timeline/timelineSelectionUtils";
import { TIMELINE_ITEM_ROW_HEIGHT } from "@/features/timeline/timelineUiConstants";
import type { TimelinePanelProps } from "@/features/timeline/types/timelineTypes";

type TimelineItemTrackRowProps = Pick<
  TimelinePanelProps,
  | "timelinePxPerFrame"
  | "timelineContentWidth"
  | "draggedTimelineItemId"
  | "selectedTimelineTarget"
  | "allLayersById"
  | "allCompositionsById"
  | "onSetDraggedTimelineItemId"
  | "onTimelineReorder"
  | "onSelectTimelineItem"
  | "onAcknowledgeTimelineSourceStatus"
  | "onResolveTimelineSourceDelete"
  | "onRenameTimelineItem"
  | "onBeginMoveTimelineItem"
  | "onBeginResizeTimelineItemStart"
  | "onBeginResizeTimelineItemEnd"
> & {
  row: Extract<TimelineRow, { type: "item" }>;
  connectToProperties: boolean;
  rowIndex: number;
};

export default function TimelineItemTrackRow({
  row,
  timelinePxPerFrame,
  timelineContentWidth,
  draggedTimelineItemId,
  selectedTimelineTarget,
  allLayersById,
  allCompositionsById,
  onSetDraggedTimelineItemId,
  onTimelineReorder,
  onSelectTimelineItem,
  onAcknowledgeTimelineSourceStatus,
  onResolveTimelineSourceDelete,
  onRenameTimelineItem,
  onBeginMoveTimelineItem,
  onBeginResizeTimelineItemStart,
  onBeginResizeTimelineItemEnd,
  connectToProperties,
  rowIndex,
}: TimelineItemTrackRowProps) {
  const item = row.item;
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(() => item.name);
  const [showDeleteDecision, setShowDeleteDecision] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const isSelectedItem = isTimelineItemSelected(selectedTimelineTarget, item);
  const sourceSyncStatus = getTimelineItemSourceSyncStatus(
    item,
    allLayersById,
    allCompositionsById
  );
  const isDeletePending = sourceSyncStatus === "deletePending";
  const baseRowBackground = item.kind === "subComp" ? "#21334a" : "#2a2a2a";
  const rowBackground =
    draggedTimelineItemId === item.id
      ? "#4b3f2b"
      : isDeletePending
        ? "rgba(133, 46, 52, 0.58)"
      : baseRowBackground;
  const isSelectedBlockRow = isSelectedItem;
  const statusBadge =
    sourceSyncStatus === "updated"
      ? { label: "update", color: "#7fb0de", background: "rgba(63, 96, 128, 0.34)" }
      : sourceSyncStatus === "new"
        ? { label: "new", color: "#96cda0", background: "rgba(50, 90, 56, 0.34)" }
      : sourceSyncStatus === "deletePending"
        ? { label: "delete?", color: "#f2a3a9", background: "rgba(126, 44, 50, 0.42)" }
      : sourceSyncStatus === "missing"
        ? { label: "missing", color: "#d7b27d", background: "rgba(111, 78, 39, 0.34)" }
      : null;

  useEffect(() => {
    if (!isEditingName) {
      return;
    }

    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isEditingName]);

  useEffect(() => {
    setShowDeleteDecision(false);
  }, [item.id, sourceSyncStatus]);

  const handleSelectFullName = (
    event: ReactMouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>
  ) => {
    event.currentTarget.select();
  };

  const commitNameEditing = () => {
    onRenameTimelineItem(item.id, draftName);
    setIsEditingName(false);
  };

  const cancelNameEditing = () => {
    setDraftName(item.name);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitNameEditing();
      return;
    }

    if (event.key === "Escape") {
      cancelNameEditing();
    }
  };

  const handleRowNameClick = () => {
    if (isEditingName) {
      return;
    }

    if (sourceSyncStatus === "updated" || sourceSyncStatus === "new") {
      onAcknowledgeTimelineSourceStatus(item);
      onSelectTimelineItem(item);
      return;
    }

    if (sourceSyncStatus === "deletePending") {
      onSelectTimelineItem(item);
      setShowDeleteDecision(true);
      return;
    }

    onSelectTimelineItem(item);
  };

  return (
    <div style={{ display: "contents" }}>
      <div
        draggable={!isEditingName}
        onDragStart={() => {
          if (!isEditingName) {
            onSetDraggedTimelineItemId(item.id);
          }
        }}
        onDragEnd={() => onSetDraggedTimelineItemId(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => onTimelineReorder(item.id)}
        onClick={handleRowNameClick}
        onDoubleClick={(event) => {
          if (isDeletePending) {
            return;
          }

          event.stopPropagation();
          setDraftName(item.name);
          setIsEditingName(true);
        }}
        style={{
          gridColumn: 1,
          gridRow: rowIndex,
          position: "relative",
          zIndex: 1,
          padding: "0 10px",
          height: TIMELINE_ITEM_ROW_HEIGHT,
          background: rowBackground,
          border: isSelectedBlockRow
            ? "1px solid transparent"
            : isDeletePending
              ? "1px solid rgba(160, 70, 78, 0.7)"
              : "1px solid #3a3a3a",
          borderRadius: connectToProperties ? "6px 6px 0 0" : 6,
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
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={commitNameEditing}
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

        {showDeleteDecision && (
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
                onResolveTimelineSourceDelete(item, "delete");
                setShowDeleteDecision(false);
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
                onResolveTimelineSourceDelete(item, "keep");
                setShowDeleteDecision(false);
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
        onDrop={() => onTimelineReorder(item.id)}
        onClick={() => onSelectTimelineItem(item)}
        style={{
          gridColumn: 2,
          gridRow: rowIndex,
          position: "relative",
          zIndex: 2,
          width: timelineContentWidth,
          minWidth: timelineContentWidth,
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
            left: item.startFrame * timelinePxPerFrame,
            top: 5,
            height: 14,
            width: item.durationFrames * timelinePxPerFrame,
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              item.kind === "subComp"
                ? "linear-gradient(90deg, #3a6ea5 0%, #4f83bc 100%)"
                : "linear-gradient(90deg, #4a4a4a 0%, #636363 100%)",
            opacity: item.visible ? 0.92 : 0.42,
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
          onMouseDown={(event) => onBeginMoveTimelineItem(event, item)}
        >
          <div
            onMouseDown={(event) => onBeginResizeTimelineItemStart(event, item)}
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
            onMouseDown={(event) => onBeginResizeTimelineItemEnd(event, item)}
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
