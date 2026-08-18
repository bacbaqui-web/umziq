import { useEffect, useState, type DragEvent } from "react";
import type { PsdImportPlan } from "@/engines/project";
import PsdImportPreviewNode from "@/features/library/components/PsdImportPreviewNode";
import LayerHoverPreviewCard from "@/shared/components/LayerHoverPreviewCard";
import {
  measureLayerHoverPreview,
  positionLayerHoverPreview,
} from "@/shared/helpers/layerHoverPreviewHelpers";

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
  onRenameNode: (
    token: string,
    layerDocumentId: string,
    name: string
  ) => void;
  onRemoveNode: (
    token: string,
    layerDocumentId: string
  ) => void;
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

function DimensionInput({
  value,
  label,
  align,
  onCommit,
}: {
  value: number;
  label: string;
  align: "left" | "right";
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const next = Number(draft);
    if (Number.isFinite(next) && next > 0) onCommit(next);
    else setDraft(String(value));
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      aria-label={label}
      className="dimension-input"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        if (/^\d*$/.test(event.currentTarget.value)) {
          setDraft(event.currentTarget.value);
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(String(value));
        }
      }}
      style={{
        width: 38,
        textAlign: align,
      }}
    />
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
  onRenameNode,
  onRemoveNode,
}: Props) {
  const [dragged, setDragged] = useState<{ token: string; nodeId: string } | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{
    url: string;
    name: string;
    width?: number;
    height?: number;
    x: number;
    y: number;
  } | null>(null);
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
          width: "min(460px, 92vw)",
          maxHeight: "min(780px, 88vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "#e8ebee",
        }}
      >
        <header style={{ padding: "16px 22px", borderBottom: "1px solid #30363c" }}>
          <div style={{ fontSize: 16, fontWeight: 750 }}>PSD 미리보기</div>
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
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <DimensionInput
                      value={entry.analysis.width}
                      label={`${entry.analysis.fileName} 가로 크기`}
                      align="right"
                      onCommit={(width) => {
                        const originalWidth =
                          entry.analysis.width /
                          (entry.scalePercent / 100);
                        onScale(
                          entry.token,
                          Math.min(
                            400,
                            Math.max(
                              1,
                              Math.round(
                                (width / originalWidth) * 10000
                              ) / 100
                            )
                          )
                        );
                      }}
                    />
                    ×
                    <DimensionInput
                      value={entry.analysis.height}
                      label={`${entry.analysis.fileName} 세로 크기`}
                      align="left"
                      onCommit={(height) => {
                        const originalHeight =
                          entry.analysis.height /
                          (entry.scalePercent / 100);
                        onScale(
                          entry.token,
                          Math.min(
                            400,
                            Math.max(
                              1,
                              Math.round(
                                (height / originalHeight) * 10000
                              ) / 100
                            )
                          )
                        );
                      }}
                    />
                  </span>
                  <span>그룹 {entry.analysis.groupCount}개</span>
                  <span>레이어 {entry.analysis.layerCount}개</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 3, color: "#9aa6af" }}>
                    크기
                    <input
                      className="dimension-input number-input--no-spinner"
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
                        width: 38,
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
                    onPreview={(url, name, width, height, clientX, clientY) => {
                      const { cardHeight } = measureLayerHoverPreview({
                        hasVisual: Boolean(url), width, height,
                      });
                      const position = positionLayerHoverPreview({ clientX, clientY, cardHeight });
                      setHoverPreview({
                        url,
                        name,
                        width,
                        height,
                        x: position.x,
                        y: position.y,
                      });
                    }}
                    onPreviewEnd={() => setHoverPreview(null)}
                    onRename={(layerDocumentId, name) =>
                      onRenameNode(entry.token, layerDocumentId, name)
                    }
                    onRemove={(layerDocumentId) =>
                      onRemoveNode(entry.token, layerDocumentId)
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
      {hoverPreview && (
        <LayerHoverPreviewCard
          name={hoverPreview.name}
          width={hoverPreview.width}
          height={hoverPreview.height}
          imageUrl={hoverPreview.url}
          status={hoverPreview.url ? "ready" : "empty"}
          x={hoverPreview.x}
          y={hoverPreview.y}
          zIndex={1010}
        />
      )}
    </div>
  );
}
