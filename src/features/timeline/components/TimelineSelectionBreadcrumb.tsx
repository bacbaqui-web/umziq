import type { RefObject } from "react";
import type { TimelineBreadcrumbSegment, TimelineSelectionLabel } from "@/engines/timeline";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

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
  selectionLabel,
  isOpen = false,
  triggerRef,
  onSelectComposition,
  onToggle,
}: TimelineSelectionBreadcrumbProps) {
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
              <span aria-hidden="true" style={{ flex: "0 0 auto", color: "#66727e", padding: "0 5px" }}>
                ›
              </span>
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
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  overflow: "hidden",
                  padding: "3px 6px",
                  borderRadius: 5,
                  border: "1px solid rgba(93, 156, 214, 0.28)",
                  background: "rgba(93, 156, 214, 0.12)",
                  color: "#eef5fc",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {segment.entityKind && (
                  <LayerCompositionIcon kind={segment.entityKind} size={13} />
                )}
                <span style={{ minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {segment.name}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 auto",
                    color: isOpen ? "#eef5fc" : "#9da9b5",
                    fontSize: 10,
                    transform: isOpen ? "rotate(180deg)" : "none",
                  }}
                >
                  ▾
                </span>
              </button>
            ) : (
              <button
                type="button"
                aria-label={`${segment.name} 그룹으로 이동`}
                title={segment.name}
                onClick={() => onSelectComposition(segment.id)}
                style={{
                  minWidth: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  overflow: "hidden",
                  padding: "3px 7px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 5,
                  background: "rgba(255,255,255,0.035)",
                  color: "#aab5c0",
                  cursor: "pointer",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {segment.entityKind && (
                  <LayerCompositionIcon kind={segment.entityKind} size={13} />
                )}
                {segment.name}
              </button>
            )}
          </div>
        ))}
      </div>
      {selectionLabel && (
        <>
          <span aria-hidden="true" style={{ flex: "0 0 auto", color: "#596571" }}>·</span>
          <span
            title={selectionLabel.label}
            style={{
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
              overflow: "hidden",
              color: "#7f8a95",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            <LayerCompositionIcon kind={selectionLabel.entityKind} size={12} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectionLabel.label}
            </span>
          </span>
        </>
      )}
    </div>
  );
}
