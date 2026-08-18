import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { TimelineCompositionSwitcherItem } from "@/engines/timeline";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";
import {
  GROUP_HOVER_BACKGROUND,
  GROUP_HOVER_BORDER,
  GROUP_HOVER_GLOW,
  GROUP_SELECTED_BACKGROUND,
  GROUP_SELECTED_BORDER,
  GROUP_SELECTED_GLOW,
} from "@/shared/styles/groupVisualStyles";

type TimelineCompositionSwitcherProps = {
  items: TimelineCompositionSwitcherItem[];
  anchorRef: RefObject<HTMLButtonElement | null>;
  onSelectComposition: (compId: string) => void;
};

export default function TimelineCompositionSwitcher({
  items,
  anchorRef,
  onSelectComposition,
}: TimelineCompositionSwitcherProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const itemHeight = 24;
  const itemGap = 4;
  const connectorHeight = items.length * itemHeight + Math.max(0, items.length - 1) * itemGap;
  const [position, setPosition] = useState({ left: 0, top: 0, connectorWidth: 20, ready: false });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel || !anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const preferredLeft = anchorRect.right + 18;
      const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - panelRect.width - 8));
      setPosition({
        left,
        top: Math.max(8, Math.min(anchorRect.top + anchorRect.height / 2 - panelRect.height / 2, window.innerHeight - panelRect.height - 8)),
        connectorWidth: Math.max(0, left - anchorRect.right),
        ready: true,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [anchorRef, items]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="그룹 전환"
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: "max-content",
        maxWidth: 220,
        overflow: "visible",
        padding: 0,
        zIndex: 2147483646,
        visibility: position.ready ? "visible" : "hidden",
      }}
    >
      {items.length > 0 ? (
        <>
          <svg
            aria-hidden="true"
            width={position.connectorWidth}
            height={connectorHeight}
            preserveAspectRatio="none"
            style={{ position: "absolute", right: "100%", top: 0, zIndex: 1, overflow: "visible", pointerEvents: "none" }}
          >
            {items.map((item, index) => (
              <line
                key={item.id}
                x1="0"
                y1={connectorHeight / 2}
                x2={position.connectorWidth}
                y2={itemHeight / 2 + index * (itemHeight + itemGap)}
                stroke="#7a858f"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, maxHeight: 348, overflowY: "auto" }}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.isCurrent ? "page" : undefined}
              aria-label={`${item.name}${item.isCurrent ? ", 현재 그룹" : item.isAncestor ? ", 상위 그룹" : ""}`}
              title={item.name}
              onClick={() => onSelectComposition(item.id)}
              onPointerEnter={() => setHoveredId(item.id)}
              onPointerLeave={() => setHoveredId((current) => current === item.id ? null : current)}
              disabled={item.isCurrent}
              style={{
                position: "relative",
                zIndex: 2,
                minWidth: 0,
                minHeight: itemHeight,
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 6px",
                borderRadius: 5,
                border: hoveredId === item.id || item.isCurrent
                  ? `1px solid ${hoveredId === item.id ? GROUP_HOVER_BORDER : GROUP_SELECTED_BORDER}`
                  : "1px solid #3a3a3a",
                background: hoveredId === item.id && !item.isCurrent
                  ? GROUP_HOVER_BACKGROUND
                  : item.isCurrent
                    ? GROUP_SELECTED_BACKGROUND
                    : "#24282d",
                color: item.isCurrent || hoveredId === item.id
                  ? "#eef5fc"
                  : "#aab5c0",
                opacity: 1,
                cursor: item.isCurrent ? "default" : "pointer",
                textAlign: "left",
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.2,
                boxShadow: hoveredId === item.id
                  ? GROUP_HOVER_GLOW
                  : item.isCurrent ? GROUP_SELECTED_GLOW : "none",
                transition: "background-color 100ms ease, border-color 100ms ease, box-shadow 100ms ease",
              }}
            >
              <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 5, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                <LayerCompositionIcon kind="composition" size={13} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
              </span>
            </button>
          ))}
          </div>
        </>
      ) : (
        <div style={{ color: "#7f8a95", fontSize: 11, padding: "6px" }}>
          이동할 그룹이 없습니다.
        </div>
      )}
    </div>,
    document.body
  );
}
