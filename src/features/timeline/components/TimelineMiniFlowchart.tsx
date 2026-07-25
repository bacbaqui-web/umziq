import { useEffect, useRef } from "react";
import type {
  TimelineBreadcrumbSegment,
  TimelineCompositionSwitcherItem,
} from "@/engines/timeline";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

type TimelineMiniFlowchartProps = {
  segments: TimelineBreadcrumbSegment[];
  children: TimelineCompositionSwitcherItem[];
  onClose: () => void;
  onSelectComposition: (compId: string) => void;
};

export default function TimelineMiniFlowchart({
  segments,
  children,
  onClose,
  onSelectComposition,
}: TimelineMiniFlowchartProps) {
  const currentRef = useRef<HTMLButtonElement | null>(null);
  const current = segments.at(-1) ?? null;
  const parent = segments.at(-2) ?? null;

  useEffect(() => {
    currentRef.current?.focus();
  }, []);

  if (!current) return null;

  const selectComposition = (compId: string) => {
    onSelectComposition(compId);
    onClose();
  };

  return (
    <div
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(8, 11, 15, 0.56)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        role="dialog"
        aria-label="그룹 이동 지도"
        aria-modal="false"
        style={{
          width: "min(760px, 100%)",
          maxHeight: "min(480px, 100%)",
          overflow: "auto",
          padding: 16,
          border: "1px solid rgba(125, 164, 201, 0.3)",
          borderRadius: 12,
          background: "rgba(17, 22, 28, 0.98)",
          boxShadow: "0 18px 48px rgba(0, 0, 0, 0.46)",
        }}
      >
        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {parent && (
            <div style={{ minWidth: 150, flex: "1 1 0" }}>
              <FlowNode
                label="상위"
                name={parent.name}
                onClick={() => selectComposition(parent.id)}
              />
            </div>
          )}

          {parent && <FlowConnector />}

          <div style={{ minWidth: 170, flex: "1 1 0" }}>
            <FlowNode
              buttonRef={currentRef}
              label="현재"
              name={current.name}
              current
            />
          </div>

          {children.length > 0 ? (
            <>
              <FlowConnector />
              <div
                aria-label="바로 아래 그룹"
                style={{
                  minWidth: 170,
                  flex: "1.15 1 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {children.map((child) => (
                  <FlowNode
                    key={child.id}
                    label="하위"
                    name={child.name}
                    onClick={() => selectComposition(child.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                minWidth: 150,
                paddingLeft: 18,
                color: "#6f7b87",
                fontSize: 11,
                textAlign: "center",
              }}
            >
              바로 아래 그룹이 없습니다.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function FlowConnector() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 36,
        flex: "0 0 36px",
        display: "flex",
        alignItems: "center",
        color: "rgba(125, 164, 201, 0.58)",
      }}
    >
      <span style={{ width: 26, height: 1, background: "rgba(125, 164, 201, 0.4)" }} />
      <span style={{ marginLeft: -1, fontSize: 14, lineHeight: 1 }}>›</span>
    </div>
  );
}

function FlowNode({
  buttonRef,
  label,
  name,
  current = false,
  onClick,
}: {
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  label: string;
  name: string;
  current?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-current={current ? "page" : undefined}
      aria-disabled={current || undefined}
      onClick={onClick}
      style={{
        width: "100%",
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr)",
        alignItems: "center",
        gap: 9,
        padding: "9px 10px",
        borderRadius: 8,
        border: current
          ? "1px solid rgba(93, 156, 214, 0.58)"
          : "1px solid rgba(255, 255, 255, 0.09)",
        background: current
          ? "rgba(93, 156, 214, 0.2)"
          : "rgba(255, 255, 255, 0.035)",
        color: current ? "#eef6fd" : "#c8d2dc",
        cursor: current ? "default" : "pointer",
        textAlign: "left",
        opacity: 1,
      }}
    >
      <LayerCompositionIcon kind="composition" size={16} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", marginBottom: 2, color: current ? "#9cc8ef" : "#71808d", fontSize: 9 }}>
          {label}
        </span>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: current ? 700 : 550 }}>
          {name}
        </span>
      </span>
    </button>
  );
}
