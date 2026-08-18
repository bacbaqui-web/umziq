import { useState, type RefObject } from "react";
import type { TimelineBreadcrumbSegment, TimelineSelectionLabel } from "@/engines/timeline";
import LayerDocumentIcon from "@/shared/components/LayerDocumentIcon";
import {
  GROUP_HOVER_BACKGROUND,
  GROUP_HOVER_BORDER,
  GROUP_HOVER_GLOW,
  GROUP_SELECTED_BACKGROUND,
  GROUP_SELECTED_BORDER,
  GROUP_SELECTED_GLOW,
} from "@/shared/styles/groupVisualStyles";

type TimelineSelectionBreadcrumbProps = {
  segments: TimelineBreadcrumbSegment[];
  selectionLabel: TimelineSelectionLabel | null;
  isOpen?: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onSelectComposition: (compId: string) => void;
  onToggle: () => void;
};

export default function TimelineSelectionBreadcrumb({
  segments,
  isOpen = false,
  triggerRef,
  onSelectComposition,
  onToggle,
}: TimelineSelectionBreadcrumbProps) {
  const currentSegmentId = segments.at(-1)?.id ?? null;
  const [hoverState, setHoverState] = useState<{ segmentId: string; currentSegmentId: string | null } | null>(null);
  const hoveredSegmentId = hoverState?.currentSegmentId === currentSegmentId
    ? hoverState.segmentId
    : null;

  return (
    <div
      aria-label="현재 그룹 위치"
      style={{
        minWidth: 0,
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 5,
        overflow: "hidden",
        fontSize: 12,
        lineHeight: 1.2,
        letterSpacing: 0.1,
      }}
    >
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", overflow: "hidden" }}>
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            style={{ minWidth: 0, display: "flex", alignItems: "center", overflow: "hidden" }}
          >
            {index > 0 && (
              <span aria-hidden="true" style={{ flex: "0 0 auto", width: 18, height: 1, background: "#7a858f" }} />
            )}
            {segment.isCurrent ? (
              <button
                ref={triggerRef}
                type="button"
                aria-current="page"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={`${segment.name} 그룹. 그룹 전환 ${isOpen ? "닫기" : "열기"}`}
                title={segment.name}
                onClick={onToggle}
                style={{
                  minWidth: 0,
                  minHeight: 24,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  overflow: "hidden",
                  padding: "3px 6px",
                  borderRadius: 5,
                  border: `1px solid ${GROUP_SELECTED_BORDER}`,
                  background: GROUP_SELECTED_BACKGROUND,
                  color: "#eef5fc",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  boxShadow: GROUP_SELECTED_GLOW,
                }}
              >
                {segment.entityKind && (
                  <LayerDocumentIcon kind={segment.entityKind} size={13} />
                )}
                <span style={{ minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {segment.name}
                </span>
              </button>
            ) : (
              <button
                type="button"
                aria-label={`${segment.name} 그룹으로 이동`}
                title={segment.name}
                onClick={() => onSelectComposition(segment.id)}
                onPointerEnter={() => setHoverState({ segmentId: segment.id, currentSegmentId })}
                onPointerLeave={() => setHoverState((current) => current?.segmentId === segment.id ? null : current)}
                style={{
                  minWidth: 0,
                  minHeight: 24,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  overflow: "hidden",
                  padding: "3px 6px",
                  border: `1px solid ${hoveredSegmentId === segment.id ? GROUP_HOVER_BORDER : "#3a3a3a"}`,
                  borderRadius: 5,
                  background: hoveredSegmentId === segment.id ? GROUP_HOVER_BACKGROUND : "#24282d",
                  color: hoveredSegmentId === segment.id ? "#eef5fc" : "#aab5c0",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  boxShadow: hoveredSegmentId === segment.id ? GROUP_HOVER_GLOW : "none",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {segment.entityKind && (
                  <LayerDocumentIcon kind={segment.entityKind} size={13} />
                )}
                {segment.name}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
