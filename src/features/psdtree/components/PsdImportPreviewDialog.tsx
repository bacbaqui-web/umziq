import { useEffect, useState, type DragEvent } from "react";
import type { PsdImportPlan } from "@/engines/project";
import PsdImportPreviewNode from "@/features/psdtree/components/PsdImportPreviewNode";

type Props = {
  plan: PsdImportPlan | null;
  status: "idle" | "analyzing" | "review" | "importing";
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  onMoveNode: (
    token: string,
    draggedId: string,
    targetId: string | null,
    position: "before" | "inside" | "after"
  ) => void;
  onScale: (token: string, scalePercent: number) => void;
};

function PsdFileIcon() {
  return (
    <span aria-hidden="true" style={{ width: 16, height: 19, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "center", flex: "0 0 auto", color: "#82a7c9" }}>
      <svg width="16" height="19" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M4.5 1.8h9.8l5.2 5.3v18a1.4 1.4 0 0 1-1.4 1.4H4.5A1.5 1.5 0 0 1 3 25V3.3a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path d="M14 2v5.5h5.3" />
      </svg>
      <span style={{ position: "absolute", bottom: 2.5, fontSize: 5, lineHeight: 1, fontWeight: 800, letterSpacing: 0.25 }}>PSD</span>
    </span>
  );
}

export default function PsdImportPreviewDialog({
  plan,
  status,
  error,
  onCancel,
  onConfirm,
  onMoveNode,
  onScale,
}: Props) {
  const [dragged, setDragged] = useState<{ token: string; nodeId: string } | null>(null);
  const open = status !== "idle";

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && status !== "importing") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open, status]);

  if (!open) return null;

  const handleRootDrop = (event: DragEvent<HTMLDivElement>, token: string) => {
    event.preventDefault();
    if (dragged?.token === token) onMoveNode(token, dragged.nodeId, null, "inside");
    setDragged(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PSD Import Preview"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        background: "rgba(5, 7, 9, 0.72)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        className="preview-dialog-surface"
        style={{
          width: "min(720px, 92vw)",
          maxHeight: "min(780px, 88vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#e8ebee",
        }}
      >
        <header style={{ padding: "20px 22px 16px", borderBottom: "1px solid #30363c" }}>
          <div style={{ fontSize: 16, fontWeight: 750 }}>PSD 불러오기 미리보기</div>
          <div style={{ marginTop: 5, color: "#8f989f", fontSize: 12 }}>
            계층과 순서를 확인한 뒤 불러오세요. 원본 PSD는 변경되지 않습니다.
          </div>
        </header>

        <main style={{ padding: 18, overflow: "auto", minHeight: 180 }}>
          {status === "analyzing" && (
            <div style={{ padding: 48, color: "#aab2b9", textAlign: "center" }}>PSD를 분석하고 있습니다…</div>
          )}
          {plan?.entries.map((entry) => (
            <section
              className="preview-dialog-entry"
              key={entry.token}
              style={{
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              <div style={{ height: 35, padding: "5px 8px", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(145deg, #20252a 0%, #1a1e22 100%)" }}>
                <PsdFileIcon />
                <div style={{ minWidth: 0, flex: 1, fontSize: 12.5, fontWeight: 650, color: "#f2f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.analysis.fileName.replace(/\.psd$/i, "")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#78838c", fontSize: 10, whiteSpace: "nowrap" }}>
                  <span>{entry.analysis.width} × {entry.analysis.height}</span>
                  <span>그룹 {entry.analysis.groupCount}</span>
                  <span>레이어 {entry.analysis.layerCount}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 3, color: "#9aa6af" }}>
                    크기
                    <input
                      type="number"
                      min={1}
                      max={400}
                      step={1}
                      value={entry.scalePercent}
                      onChange={(event) => {
                        const value = Number(event.currentTarget.value);
                        if (Number.isFinite(value)) onScale(entry.token, value);
                      }}
                      style={{
                        width: 42,
                        height: 20,
                        boxSizing: "border-box",
                        padding: "1px 3px",
                        border: "1px solid #46515b",
                        borderRadius: 4,
                        background: "#151a1e",
                        color: "#e6eaed",
                        font: "inherit",
                        textAlign: "right",
                      }}
                      aria-label={`${entry.analysis.fileName} 불러오기 크기`}
                    />
                    %
                  </label>
                </div>
              </div>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleRootDrop(event, entry.token)}
                style={{ padding: "0 0 6px", background: "rgba(18, 21, 24, 0.48)" }}
              >
                {(entry.tree.length === 1 && entry.tree[0].kind === "group"
                  ? entry.tree[0].children
                  : entry.tree
                ).map((node, index, nodes) => (
                  <PsdImportPreviewNode
                    key={node.id}
                    node={node}
                    depth={1}
                    draggedId={dragged?.token === entry.token ? dragged.nodeId : null}
                    parentGuideLeft={16}
                    isLastSibling={index === nodes.length - 1}
                    onBeginDrag={(nodeId) => setDragged({ token: entry.token, nodeId })}
                    onEndDrag={() => setDragged(null)}
                    onMove={(draggedId, targetId, position) =>
                      onMoveNode(entry.token, draggedId, targetId, position)
                    }
                  />
                ))}
              </div>
            </section>
          ))}
          {error && <div style={{ color: "#ef777f", fontSize: 12 }}>{error}</div>}
        </main>

        <footer
          style={{
            padding: "14px 18px",
            display: "flex",
            justifyContent: "flex-end",
            gap: 9,
            borderTop: "1px solid #30363c",
          }}
        >
          <button className="ui-button" onClick={onCancel} disabled={status === "importing"}>
            취소
          </button>
          <button
            className="ui-button ui-button--primary"
            onClick={onConfirm}
            disabled={status !== "review" || !plan?.entries.length}
          >
            {status === "importing" ? "불러오는 중…" : "불러오기"}
          </button>
        </footer>
      </div>
    </div>
  );
}
