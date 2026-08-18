import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  type TimelineInteractionCommands,
  type TimelineItemRowViewModel,
} from "@/engines/timeline";
import LayerDocumentIcon from "@/shared/components/LayerDocumentIcon";
import {
  GROUP_HOVER_BACKGROUND,
  GROUP_SELECTED_BACKGROUND,
  GROUP_SELECTED_GLOW,
} from "@/shared/styles/groupVisualStyles";

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
  const timingClickRef = useRef<{
    startClientX: number;
    moved: boolean;
    wasSelected: boolean;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [rowHovered, setRowHovered] = useState(false);
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
        data-layer-document-id={item.id}
        data-timeline-selected={viewModel.selected ? "true" : "false"}
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
        onPointerEnter={() => setRowHovered(true)}
        onPointerLeave={() => setRowHovered(false)}
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
          padding: "0 8px 0 2px",
          height: viewModel.rowHeight,
          background: item.entityKind === "composition"
            ? viewModel.selected
              ? GROUP_SELECTED_BACKGROUND
              : rowHovered ? GROUP_HOVER_BACKGROUND : viewModel.rowBackground
            : viewModel.rowBackground,
          border: viewModel.selected
            ? "1px solid transparent"
            : isDeletePending
              ? "1px solid rgba(160, 70, 78, 0.7)"
              : "1px solid #3a3a3a",
          borderRadius: viewModel.connectToProperties ? "6px 6px 0 0" : 6,
          boxShadow: viewModel.selected && item.entityKind === "composition"
            ? GROUP_SELECTED_GLOW
            : "none",
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
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{
                  opacity: viewModel.expanded ? 1 : 0.78,
                  transform: viewModel.expanded ? "rotate(-8deg)" : "none",
                  transition: "color 100ms ease, opacity 100ms ease, transform 100ms ease",
                }}
              >
                <path d="M16 9V4l1-1V2H7v1l1 1v5c0 1.1-.9 2-2 2v2h5.2v7h1.6v-7H18v-2c-1.1 0-2-.9-2-2Z" />
              </svg>
            </button>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", transform: item.mediaKind === "visual" && item.entityKind === "layer" ? "translateY(3px)" : undefined }}>
              <LayerDocumentIcon
                kind={item.mediaKind === "audio" ? "audio" : item.entityKind}
                audioProvenance={item.audioProvenance}
                size={14}
              />
            </span>
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
          height: viewModel.rowHeight,
          border: "none",
          borderRadius: 0,
          overflow: "visible",
          clipPath: "inset(0 -10000px 0 0)",
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
          aria-hidden="true"
          style={{
            position: "absolute",
            left: viewModel.sourceTrackLeft,
            top: 5,
            height: viewModel.rowHeight - 10,
            width: viewModel.sourceTrackWidth,
            borderRadius: 2,
            background: viewModel.trackBackground,
            opacity: 0.22,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: viewModel.trackLeft,
            top: 5,
            height: viewModel.rowHeight - 10,
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
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            timingClickRef.current = {
              startClientX: event.clientX,
              moved: false,
              wasSelected: viewModel.selected,
            };
            if (!viewModel.selected) {
              interactions.selectTimelineItem(item.id);
            }
            interactions.beginMoveTimelineItem({
              clientX: event.clientX,
              pointerId: event.pointerId,
              captureTarget: event.currentTarget,
            }, item.id);
          }}
          onPointerMove={(event) => {
            const timingClick = timingClickRef.current;
            if (
              timingClick &&
              Math.abs(event.clientX - timingClick.startClientX) >= 3
            ) {
              timingClick.moved = true;
            }
          }}
          onPointerCancel={() => {
            timingClickRef.current = null;
          }}
          onClick={(event) => {
            event.stopPropagation();
            const timingClick = timingClickRef.current;
            timingClickRef.current = null;
            if (timingClick && !timingClick.moved && timingClick.wasSelected) {
              interactions.selectTimelineItem(item.id);
            }
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(13, 18, 23, 0.62)",
              pointerEvents: "none",
            }}
          />
          {viewModel.visibleTrackWidth > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: viewModel.visibleTrackLeft,
                top: 0,
                bottom: 0,
                width: viewModel.visibleTrackWidth,
                background: viewModel.trackBackground,
                pointerEvents: "none",
              }}
            />
          )}
          {item.mediaKind === "audio" && viewModel.waveform.length > 0 && (
            <svg
              viewBox={`0 0 ${viewModel.waveform.length} ${viewModel.rowHeight - 10}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.82 }}
            >
              {viewModel.waveform.map((peak, index) => {
                const waveformHeight = viewModel.rowHeight - 10;
                const height = Math.max(1, Math.min(waveformHeight - 2, peak * (waveformHeight - 2)));
                return <line key={index} x1={index + 0.5} x2={index + 0.5} y1={waveformHeight / 2 - height / 2} y2={waveformHeight / 2 + height / 2} stroke="#d3f4df" strokeWidth="0.7" />;
              })}
            </svg>
          )}
          <div
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              interactions.beginResizeTimelineItemStart({
                clientX: event.clientX,
                pointerId: event.pointerId,
                captureTarget: event.currentTarget,
              }, item.id);
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
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              interactions.beginResizeTimelineItemEnd({
                clientX: event.clientX,
                pointerId: event.pointerId,
                captureTarget: event.currentTarget,
              }, item.id);
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
