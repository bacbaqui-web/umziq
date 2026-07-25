import type { TimelineCompositionSwitcherItem } from "@/engines/timeline";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

type TimelineCompositionSwitcherProps = {
  items: TimelineCompositionSwitcherItem[];
  onSelectComposition: (compId: string) => void;
};

export default function TimelineCompositionSwitcher({
  items,
  onSelectComposition,
}: TimelineCompositionSwitcherProps) {
  return (
    <div
      role="dialog"
      aria-label="그룹 전환"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width: 320,
        maxHeight: 360,
        overflowY: "auto",
        padding: 8,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(18, 22, 28, 0.98)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
        backdropFilter: "blur(10px)",
        zIndex: 20,
      }}
    >
      {items.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.isCurrent ? "page" : undefined}
              aria-label={`${item.name}${item.isCurrent ? ", 현재 그룹" : item.isAncestor ? ", 상위 그룹" : ""}`}
              title={item.name}
              onClick={() => onSelectComposition(item.id)}
              disabled={item.isCurrent}
              style={{
                minWidth: 0,
                width: "100%",
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 8,
                padding: `7px 8px 7px ${8 + item.depth * 16}px`,
                borderRadius: 6,
                border: item.isCurrent
                  ? "1px solid rgba(93, 156, 214, 0.42)"
                  : item.isAncestor
                    ? "1px solid rgba(255,255,255,0.09)"
                    : "1px solid transparent",
                background: item.isCurrent
                  ? "rgba(93, 156, 214, 0.18)"
                  : item.isAncestor
                    ? "rgba(255,255,255,0.04)"
                    : "transparent",
                color: item.isCurrent ? "#eef5fc" : item.isAncestor ? "#d7e0e8" : "#b9c4cf",
                opacity: 1,
                cursor: item.isCurrent ? "default" : "pointer",
                textAlign: "left",
                fontSize: 12,
              }}
            >
              <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {item.depth > 0 && <span aria-hidden="true" style={{ color: "#596571", marginRight: 6 }}>└</span>}
                <LayerCompositionIcon kind="composition" size={13} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
              </span>
              {(item.isCurrent || item.isAncestor) && (
                <span
                  aria-hidden="true"
                  style={{ color: item.isCurrent ? "#9cc8ef" : "#7f8a95", fontSize: 10, whiteSpace: "nowrap" }}
                >
                  {item.isCurrent ? "현재" : "상위"}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ color: "#7f8a95", fontSize: 11, padding: "6px" }}>
          이동할 그룹이 없습니다.
        </div>
      )}
    </div>
  );
}
