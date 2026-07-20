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
};

export default function PsdImportPreviewDialog({
  plan,
  status,
  error,
  onCancel,
  onConfirm,
  onMoveNode,
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
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #2b3238" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{entry.analysis.fileName}</div>
                <div style={{ marginTop: 7, display: "flex", gap: 16, color: "#929ca4", fontSize: 11 }}>
                  <span>{entry.analysis.width} × {entry.analysis.height}</span>
                  <span>그룹 {entry.analysis.groupCount}</span>
                  <span>레이어 {entry.analysis.layerCount}</span>
                </div>
              </div>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleRootDrop(event, entry.token)}
                style={{ padding: "7px 8px 10px" }}
              >
                {entry.tree.map((node) => (
                  <PsdImportPreviewNode
                    key={node.id}
                    node={node}
                    depth={0}
                    draggedId={dragged?.token === entry.token ? dragged.nodeId : null}
                    onBeginDrag={(nodeId) => setDragged({ token: entry.token, nodeId })}
                    onEndDrag={() => setDragged(null)}
                    onMove={(draggedId, targetId, position) =>
                      onMoveNode(entry.token, draggedId, targetId, position)
                    }
                  />
                ))}
                <div style={{ padding: "8px 12px 2px", color: "#68737c", fontSize: 10 }}>
                  빈 영역에 놓으면 root의 맨 아래로 이동합니다.
                </div>
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
