import { useState, type DragEvent } from "react";
import type { PsdImportPlanNode } from "@/engines/project";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

type DropPosition = "before" | "inside" | "after";

type Props = {
  node: PsdImportPlanNode;
  depth: number;
  draggedId: string | null;
  onBeginDrag: (nodeId: string) => void;
  onEndDrag: () => void;
  onMove: (draggedId: string, targetId: string, position: DropPosition) => void;
};

export default function PsdImportPreviewNode({
  node,
  depth,
  draggedId,
  onBeginDrag,
  onEndDrag,
  onMove,
}: Props) {
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);

  const resolvePosition = (event: DragEvent<HTMLDivElement>): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(rect.height, 1);
    if (node.kind === "group" && ratio >= 0.25 && ratio <= 0.75) return "inside";
    return ratio < 0.5 ? "before" : "after";
  };

  return (
    <div>
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
          minHeight: 36,
          padding: `7px 10px 7px ${12 + depth * 22}px`,
          display: "flex",
          alignItems: "center",
          gap: 9,
          position: "relative",
          color: node.autoRenamed ? "#ef777f" : "#d7dce1",
          background: dropPosition === "inside" ? "rgba(105, 145, 176, 0.17)" : "transparent",
          borderTop: dropPosition === "before" ? "2px solid #779fbe" : "2px solid transparent",
          borderBottom: dropPosition === "after" ? "2px solid #779fbe" : "2px solid transparent",
          cursor: "grab",
          userSelect: "none",
          fontSize: 12,
        }}
      >
        <span aria-hidden="true" style={{ color: "#84909a", width: 14, textAlign: "center" }}>
          {node.kind === "group" ? "▾" : ""}
        </span>
        <span aria-hidden="true" style={{ color: node.kind === "group" ? "#9ca8b2" : "#77838d" }}>
          {node.kind === "group" ? "▱" : <LayerCompositionIcon kind="layer" size={14} />}
        </span>
        <span>{node.displayName}</span>
      </div>
      {node.children.map((child) => (
        <PsdImportPreviewNode
          key={child.id}
          node={child}
          depth={depth + 1}
          draggedId={draggedId}
          onBeginDrag={onBeginDrag}
          onEndDrag={onEndDrag}
          onMove={onMove}
        />
      ))}
    </div>
  );
}
