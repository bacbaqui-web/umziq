import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  TIMELINE_ITEM_ROW_HEIGHT,
  type TimelineInteractionCommands,
  type TimelineItemRowViewModel,
} from "@/engines/timeline";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
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

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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

    interactions.activateTimelineItem(item.id, viewModel.source.status);
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    interactions.selectTimelineItem(item.id);
    setContextMenu({ x: event.clientX, y: event.clientY });
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
        onContextMenu={handleContextMenu}
        onDoubleClick={(event) => {
          if (isDeletePending) {
            return;
          }

          event.stopPropagation();
          interactions.beginRenameTimelineItem(item.id);
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
          cursor: isEditingName ? "text" : "pointer",
          boxSizing: "border-box",
        }}
      >
        {isEditingName ? (
          <input
            className="ui-input ui-input--compact"
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
            <LayerCompositionIcon
              kind={item.entityKind}
              size={14}
            />
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
                className={`ui-badge${statusBadge.label === "NEW" ? " ui-badge--new" : ""}`}
                style={{
                  background: statusBadge.label === "NEW" ? undefined : statusBadge.background,
                  color: statusBadge.label === "NEW" ? undefined : statusBadge.color,
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
                interactions.resolveTimelineSourceDelete(item.id, "delete");
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
                interactions.resolveTimelineSourceDelete(item.id, "keep");
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
        onClick={() => interactions.selectTimelineItem(item.id)}
        onContextMenu={handleContextMenu}
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
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            interactions.beginMoveTimelineItem(event.clientX, item.id);
          }}
        >
          <div
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              interactions.beginResizeTimelineItemStart(event.clientX, item.id);
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
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              interactions.beginResizeTimelineItemEnd(event.clientX, item.id);
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

      {contextMenu && (
        <div
          role="menu"
          aria-label={`${item.name} 타임라인 항목 메뉴`}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000,
            minWidth: 132,
            padding: 5,
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "#1b1f24",
            boxShadow: "0 10px 28px rgba(0,0,0,0.42)",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              interactions.duplicateTimelineItem(item.id);
            }}
            style={{
              width: "100%",
              border: 0,
              borderRadius: 5,
              padding: "7px 10px",
              background: "transparent",
              color: "#dce5ef",
              fontSize: 12,
              textAlign: "left",
              cursor: "pointer",
            }}
            onPointerEnter={(event) => {
              event.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
          >
            복제
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              interactions.deleteTimelineItem(item.id);
            }}
            style={{
              width: "100%",
              border: 0,
              borderRadius: 5,
              padding: "7px 10px",
              background: "transparent",
              color: "#f19aa3",
              fontSize: 12,
              textAlign: "left",
              cursor: "pointer",
            }}
            onPointerEnter={(event) => {
              event.currentTarget.style.background = "rgba(198, 65, 78, 0.18)";
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.background = "transparent";
            }}
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
