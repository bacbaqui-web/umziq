import type { TimelineCompositionSwitcherItem } from "@/features/timeline/timelineSelectionPath";

type TimelineCompositionSwitcherProps = {
  parentName: string | null;
  parentIsCurrent: boolean;
  items: TimelineCompositionSwitcherItem[];
  onSelectComposition: (compId: string) => void;
};

export default function TimelineCompositionSwitcher({
  parentName,
  parentIsCurrent,
  items,
  onSelectComposition,
}: TimelineCompositionSwitcherProps) {
  const hasChildren = items.length > 0;
  const connectorColor = "rgba(255,255,255,0.12)";

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width: 320,
        padding: 8,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(18, 22, 28, 0.98)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
        backdropFilter: "blur(10px)",
        zIndex: 20,
      }}
      title={parentName ?? undefined}
    >
      {parentName ? (
        hasChildren ? (
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: 10,
              minWidth: 0,
              padding: "2px",
            }}
          >
            <div
              title={parentName}
              style={{
                alignSelf: "center",
                minWidth: 0,
                width: 118,
                padding: "8px 10px",
                borderRadius: 6,
                border: parentIsCurrent
                  ? "1px solid rgba(93, 156, 214, 0.42)"
                  : "1px solid rgba(255,255,255,0.06)",
                background: parentIsCurrent
                  ? "rgba(93, 156, 214, 0.18)"
                  : "rgba(255,255,255,0.03)",
                color: parentIsCurrent ? "#eef5fc" : "#d7e0e8",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {parentName}
            </div>
            <div
              aria-hidden="true"
              style={{
                position: "relative",
                width: 18,
                flex: "0 0 18px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  right: 0,
                  borderTop: `1px solid ${connectorColor}`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  bottom: 12,
                  left: "50%",
                  borderLeft: `1px solid ${connectorColor}`,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                flex: 1,
                minWidth: 0,
              }}
            >
              {items.map((item, index) => {
                const isFirst = index === 0;
                const isLast = index === items.length - 1;

                return (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "12px 1fr",
                      alignItems: "center",
                      minWidth: 0,
                      minHeight: 32,
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        position: "relative",
                        height: "100%",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: isLast ? "50%" : 0,
                          left: 0,
                          borderLeft: `1px solid ${connectorColor}`,
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: 0,
                          right: 0,
                          borderTop: `1px solid ${connectorColor}`,
                        }}
                      />
                      {isFirst ? (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: "50%",
                            left: 0,
                            width: 1,
                            background: "rgba(18, 22, 28, 0.98)",
                          }}
                        />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      title={item.name}
                      onClick={() => onSelectComposition(item.id)}
                      disabled={item.isActive}
                      style={{
                        minWidth: 0,
                        width: "100%",
                        padding: "7px 8px",
                        borderRadius: 6,
                        border: item.isActive
                          ? "1px solid rgba(93, 156, 214, 0.42)"
                          : "1px solid rgba(255,255,255,0.06)",
                        background: item.isActive
                          ? "rgba(93, 156, 214, 0.18)"
                          : "rgba(255,255,255,0.03)",
                        color: item.isActive ? "#eef5fc" : "#c6d0da",
                        cursor: item.isActive ? "default" : "pointer",
                        textAlign: "left",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.name}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            title={parentName}
            style={{
              minWidth: 0,
              padding: "2px",
            }}
          >
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: parentIsCurrent
                  ? "1px solid rgba(93, 156, 214, 0.42)"
                  : "1px solid rgba(255,255,255,0.06)",
                background: parentIsCurrent
                  ? "rgba(93, 156, 214, 0.18)"
                  : "rgba(255,255,255,0.03)",
                color: parentIsCurrent ? "#eef5fc" : "#d7e0e8",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {parentName}
            </div>
            <div
              style={{
                color: "#7f8a95",
                fontSize: 11,
                padding: "8px 2px 2px",
              }}
            >
              전환할 관련 컴포지션이 없습니다.
            </div>
          </div>
        )
      ) : (
        <div
          style={{
            color: "#7f8a95",
            fontSize: 11,
            padding: "4px 2px",
          }}
        >
          전환할 관련 컴포지션이 없습니다.
        </div>
      )}
    </div>
  );
}
