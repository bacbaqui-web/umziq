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
  onPreview: (
    previewUrl: string,
    name: string,
    width: number | undefined,
    height: number | undefined,
    clientX: number,
    clientY: number
  ) => void;
  onPreviewEnd: () => void;
  onRename: (layerDocumentId: string, name: string) => void;
  onRemove: (layerDocumentId: string) => void;
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
  onPreview,
  onPreviewEnd,
  onRename,
  onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(node.displayName);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
  const hasChildren = node.children.length > 0;
  const rowIndent = depth === 1
    ? parentGuideLeft + 8
    : parentGuideLeft + 10;
  const childGuideLeft = rowIndent + 19;

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
        draggable={!editing}
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
        onMouseEnter={() => setHovered(true)}
        onMouseMove={(event) => {
          if (node.previewUrl || node.previewEmpty) {
            onPreview(
              node.previewUrl ?? "",
              node.displayName,
              node.previewWidth,
              node.previewHeight,
              event.clientX,
              event.clientY
            );
          }
        }}
        onMouseLeave={() => {
          setHovered(false);
          onPreviewEnd();
        }}
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
          background: dropPosition === "inside"
            ? "rgba(47, 79, 127, 0.58)"
            : hovered
              ? "rgba(66, 91, 112, 0.22)"
              : "transparent",
          borderTop: dropPosition === "before" ? "1px solid #779fbe" : "1px solid transparent",
          borderBottom: dropPosition === "after" ? "1px solid #779fbe" : "1px solid transparent",
          borderRadius: 4,
          boxShadow: hovered
            ? "inset 0 0 0 1px rgba(126, 166, 198, 0.3)"
            : "none",
          cursor: "pointer",
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
            position: "relative",
            transform: node.kind === "layer" ? "translateY(3px)" : "translateY(1px)",
          }}
        >
          <LayerCompositionIcon
            kind={node.kind === "group" ? "composition" : "layer"}
            size={14}
          />
          {hasChildren && expanded && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "50%",
                top: "calc(100% + 2px)",
                height: 2,
                borderLeft: "1px solid rgba(142, 182, 216, 0.82)",
                transform: "translateX(-0.5px)",
                pointerEvents: "none",
              }}
            />
          )}
        </span>
        {editing ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(event) => setNameDraft(event.currentTarget.value)}
            onFocus={(event) => event.currentTarget.select()}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                const nextName = nameDraft.trim();
                if (nextName) onRename(node.id, nextName);
                else setNameDraft(node.displayName);
                setEditing(false);
              } else if (event.key === "Escape") {
                setNameDraft(node.displayName);
                setEditing(false);
              }
            }}
            onBlur={() => {
              const nextName = nameDraft.trim();
              if (nextName) onRename(node.id, nextName);
              else setNameDraft(node.displayName);
              setEditing(false);
            }}
            aria-label={`${node.displayName} 이름 수정`}
            style={{
              minWidth: 0,
              flex: 1,
              height: 18,
              boxSizing: "border-box",
              padding: "0 3px",
              border: "1px solid #6687a3",
              borderRadius: 3,
              outline: "none",
              background: "#11181e",
              color: "#f2f4f5",
              font: "inherit",
            }}
          />
        ) : (
          <span
            onDoubleClick={(event) => {
              event.stopPropagation();
              setNameDraft(node.displayName);
              setEditing(true);
            }}
            style={{
              minWidth: 0,
              flex: "0 1 auto",
              marginLeft: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.displayName}
          </span>
        )}
        {!editing && (
          <div
            style={{
              marginLeft: 2,
              display: "flex",
              alignItems: "center",
              gap: 2,
              flex: "0 0 auto",
              opacity: hovered ? 1 : 0.68,
            }}
          >
            <button
              type="button"
              aria-label={`${node.displayName} 이름 수정`}
              title="이름 수정"
              draggable={false}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setNameDraft(node.displayName);
                setEditing(true);
              }}
              style={{
                width: 16,
                height: 16,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #34414b",
                borderRadius: 4,
                background: "rgba(17, 23, 28, 0.76)",
                color: "#8199ad",
                cursor: "pointer",
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={`${node.displayName} 불러오기에서 제외`}
              title="불러오기에서 제외"
              draggable={false}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onPreviewEnd();
                onRemove(node.id);
              }}
              style={{
                width: 16,
                height: 16,
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #44383b",
                borderRadius: 4,
                background: "rgba(24, 20, 22, 0.76)",
                color: "#9a7171",
                cursor: "pointer",
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4.8c0-.7.6-1.3 1.3-1.3h5.4c.7 0 1.3.6 1.3 1.3V6" />
                <path d="M7 6l.8 13.2c0 .7.6 1.3 1.3 1.3h5.8c.7 0 1.3-.6 1.3-1.3L17 6" />
              </svg>
            </button>
          </div>
        )}
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
          onPreview={onPreview}
          onPreviewEnd={onPreviewEnd}
          onRename={onRename}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
