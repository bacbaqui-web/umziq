import { useState, type DragEvent } from "react";
import type { PsdImportPlanNode } from "@/engines/project";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

type DropPosition = "before" | "inside" | "after";

type Props = {
  node: PsdImportPlanNode;
  depth: number;
  draggedId: string | null;
  parentGuideLeft?: number;
  isLastSibling?: boolean;
  onBeginDrag: (nodeId: string) => void;
  onEndDrag: () => void;
  onMove: (draggedId: string, targetId: string, position: DropPosition) => void;
};

export default function PsdImportPreviewNode({
  node,
  depth,
  draggedId,
  parentGuideLeft = 0,
  isLastSibling = false,
  onBeginDrag,
  onEndDrag,
  onMove,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
  const hasChildren = node.children.length > 0;
  const baseRowIndent = 18 + (depth - 1) * 14;
  const rowIndent = Math.round(
    parentGuideLeft +
    (baseRowIndent - parentGuideLeft) * 0.75
  );
  const childGuideLeft = rowIndent + 5;

  const resolvePosition = (event: DragEvent<HTMLDivElement>): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
    if (node.kind === "group" && ratio >= 0.25 && ratio <= 0.75) return "inside";
    return ratio < 0.5 ? "before" : "after";
  };

  return (
    <div style={{ position: "relative" }}>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: parentGuideLeft,
          top: 0,
          height: isLastSibling ? 10 : "100%",
          borderLeft: "1px solid rgba(142, 182, 216, 0.82)",
          transform: "translateX(-0.5px)",
        }}
      />
      <div
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.id);
          onBeginDrag(node.id);
        }}
        onDragEnd={() => {
          setDropPosition(null);
          onEndDrag();
        }}
        onDragOver={(event) => {
          if (!draggedId || draggedId === node.id) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          setDropPosition(resolvePosition(event));
        }}
        onDragLeave={() => setDropPosition(null)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const sourceId = draggedId ?? event.dataTransfer.getData("text/plain");
          const position = dropPosition ?? resolvePosition(event);
          setDropPosition(null);
          if (sourceId) onMove(sourceId, node.id, position);
        }}
        style={{
          boxSizing: "border-box",
          height: 20,
          padding: "1px 6px",
          paddingLeft: rowIndent,
          display: "flex",
          alignItems: "center",
          gap: 2,
          position: "relative",
          color: node.autoRenamed ? "#ef777f" : "#f2f4f5",
          background: dropPosition === "inside" ? "rgba(47, 79, 127, 0.58)" : "transparent",
          borderTop: dropPosition === "before" ? "1px solid #779fbe" : "1px solid transparent",
          borderBottom: dropPosition === "after" ? "1px solid #779fbe" : "1px solid transparent",
          borderRadius: 4,
          cursor: "grab",
          userSelect: "none",
          fontSize: 12,
          lineHeight: 1.2,
          fontWeight: 500,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: parentGuideLeft,
            top: 9,
            width: rowIndent - parentGuideLeft + (hasChildren ? 1 : 0),
            borderTop: "1px solid rgba(142, 182, 216, 0.82)",
            transform: "translateY(-0.5px)",
          }}
        />
        {hasChildren && (
          <button
            type="button"
            aria-label={`${node.displayName} ${expanded ? "접기" : "펼치기"}`}
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
            style={{
              width: 10,
              height: 10,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 10px",
              position: "relative",
              overflow: "visible",
              border: "1px solid rgba(142, 182, 216, 0.72)",
              borderRadius: 2,
              background: "#182027",
              color: "#9bb5ca",
              cursor: "pointer",
            }}
          >
            {expanded && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "100%",
                  height: 6,
                  borderLeft: "1px solid rgba(142, 182, 216, 0.82)",
                  transform: "translateX(-0.5px)",
                  pointerEvents: "none",
                }}
              />
            )}
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" aria-hidden="true">
              <path d="M2 4h4" />
              {!expanded && <path d="M4 2v4" />}
            </svg>
          </button>
        )}
        <span
          aria-hidden="true"
          style={{
            color: "#8eb6d8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            transform: node.kind === "layer" ? "translateY(3px)" : "translateY(1px)",
          }}
        >
          <LayerCompositionIcon
            kind={node.kind === "group" ? "composition" : "layer"}
            size={14}
          />
        </span>
        <span style={{ marginLeft: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.displayName}
        </span>
      </div>
      {hasChildren && expanded && node.children.map((child, index) => (
        <PsdImportPreviewNode
          key={child.id}
          node={child}
          depth={depth + 1}
          draggedId={draggedId}
          parentGuideLeft={childGuideLeft}
          isLastSibling={index === node.children.length - 1}
          onBeginDrag={onBeginDrag}
          onEndDrag={onEndDrag}
          onMove={onMove}
        />
      ))}
    </div>
  );
}
