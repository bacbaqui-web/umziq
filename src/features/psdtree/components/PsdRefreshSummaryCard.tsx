import { useEffect } from "react";
import type { PsdTreeViewProps } from "@/engines/psd-tree";

type Props = {
  summary: NonNullable<PsdTreeViewProps["refreshSummary"]>;
  onDismiss: () => void;
};

const SUMMARY_DURATION_MS = 8000;

export default function PsdRefreshSummaryCard({ summary, onDismiss }: Props) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, SUMMARY_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, summary]);

  return (
    <section
      className={`refresh-summary ${summary.problematic > 0 ? "refresh-summary--problem" : "refresh-summary--ok"}`}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#edf3ef", fontSize: 12, fontWeight: 750 }}>
            {summary.compositionName} 새로고침 완료
          </div>
          {!summary.hasChanges && (
            <div style={{ marginTop: 5, color: "#a8b6ad", fontSize: 11 }}>
              변경 사항 없음
            </div>
          )}
        </div>
        <button
          className="ui-button ui-button--icon"
          type="button"
          onClick={onDismiss}
          aria-label="새로고침 결과 닫기"
          style={{
            background: "rgba(10, 12, 13, 0.24)",
            color: "#aeb8b2",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {summary.hasChanges && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 6,
            marginTop: 10,
          }}
        >
          {summary.items.map((item) => (
            <div
              className="refresh-summary__metric"
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                color: item.problem && item.value > 0 ? "#ef9ba2" : "#aeb9b2",
                fontSize: 10,
              }}
            >
              <span>{item.label}</span>
              <strong style={{ color: "inherit", fontVariantNumeric: "tabular-nums" }}>
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
