import { useState, type ReactNode } from "react";
import type { PsdTreeNodeProps } from "@/engines/psd-tree";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

type Props = PsdTreeNodeProps & {
  readonly parentGuideLeft?: number;
  readonly isLastSibling?: boolean;
};

function PsdFileIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 16,
        height: 19,
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        flex: "0 0 auto",
        marginLeft: 2,
        color: "#82a7c9",
      }}
    >
      <svg
        width="16"
        height="19"
        viewBox="0 0 24 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      >
        <path d="M4.5 1.8h9.8l5.2 5.3v18a1.4 1.4 0 0 1-1.4 1.4H4.5A1.5 1.5 0 0 1 3 25V3.3a1.5 1.5 0 0 1 1.5-1.5Z" />
        <path d="M14 2v5.5h5.3" />
      </svg>
      <span
        style={{
          position: "absolute",
          bottom: 2.5,
          fontSize: 5,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: 0.25,
        }}
      >
        PSD
      </span>
    </span>
  );
}

function ActionButton({
  label,
  color,
  onClick,
  children,
}: {
  label: string;
  color: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      style={{
        width: 22,
        height: 22,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? "#2a3036" : "rgba(24, 28, 32, 0.45)",
        color,
        border: hovered ? "1px solid #46515b" : "1px solid #343a40",
        borderRadius: 6,
        cursor: "pointer",
        opacity: hovered ? 1 : 0.86,
        transition: "background 140ms ease, border-color 140ms ease, opacity 140ms ease",
      }}
    >
      {children}
    </button>
  );
}

export default function PsdTreeNode({
  node,
  isFirstRoot,
  draggedMainCompId,
  dropTarget,
  onSelectNode,
  onRefreshMainComp,
  onDeleteMainComp,
  onBeginMainDrag,
  onDragOverMain,
  onDropMain,
  onEndMainDrag,
  parentGuideLeft,
  isLastSibling = false,
}: Props) {
  const [rowHovered, setRowHovered] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const isRoot = node.depth === 0;
  const isMain = node.type === "main";
  const hasChildren = node.children.length > 0;
  const baseRowIndent = isMain
    ? 3
    : 18 + (node.depth - 1) * 14;
  const branchLeft = parentGuideLeft ?? 0;
  const rowIndent = isMain
    ? baseRowIndent
    : Math.round(
        branchLeft +
        (baseRowIndent - branchLeft) * 0.75
      );
  const childGuideLeft = rowIndent + 5;
  const isDragging = node.canReorder && draggedMainCompId === node.id;
  const showDropBefore =
    node.canReorder &&
    dropTarget?.targetId === node.id &&
    dropTarget.position === "before";
  const showDropAfter =
    node.canReorder &&
    dropTarget?.targetId === node.id &&
    dropTarget.position === "after";

  const rowBackground = node.selected
    ? isMain
      ? "linear-gradient(90deg, rgba(47, 79, 127, 0.88), rgba(42, 64, 91, 0.58))"
      : "transparent"
    : rowHovered
      ? isMain ? "rgba(45, 51, 57, 0.72)" : "rgba(42, 48, 54, 0.64)"
      : "transparent";

  return (
    <div
      draggable={node.canReorder}
      onDragStart={() => {
        if (node.canReorder) onBeginMainDrag(node.id);
      }}
      onDragEnd={onEndMainDrag}
      onDragOver={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (onDragOverMain(node.id, event.clientY, bounds.top, bounds.height)) {
          event.preventDefault();
        }
      }}
      onDrop={() => onDropMain(node.id)}
      style={{
        position: "relative",
        marginTop: isRoot && !isFirstRoot ? 6 : isMain ? 2 : 0,
        border: isMain
          ? node.selected ? "1px solid #4b6685" : "1px solid #343a40"
          : "none",
        borderRadius: isMain ? 8 : 4,
        background: isMain
          ? "linear-gradient(145deg, #20252a 0%, #1a1e22 100%)"
          : isDragging ? "rgba(74, 84, 96, 0.22)" : "transparent",
        boxShadow: isMain
          ? node.selected
            ? "0 6px 18px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(86, 126, 168, 0.08)"
            : "0 4px 14px rgba(0, 0, 0, 0.18)"
          : "none",
        opacity: isDragging ? 0.62 : 1,
        transform: isDragging ? "scale(0.988)" : "scale(1)",
        transition: "border-color 150ms ease, box-shadow 150ms ease, opacity 140ms ease, transform 140ms ease",
      }}
    >
      {showDropBefore && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            zIndex: 2,
            left: 5,
            right: 5,
            top: -4,
            height: 2,
            borderRadius: 999,
            background: "#5d8fcb",
            boxShadow: "0 0 0 1px rgba(93, 143, 203, 0.18), 0 0 8px rgba(93, 143, 203, 0.35)",
          }}
        />
      )}

      {!isMain && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: branchLeft,
            top: 0,
            height: isLastSibling ? 10 : "100%",
            borderLeft:
              "1px solid rgba(142, 182, 216, 0.82)",
            transform: "translateX(-0.5px)",
          }}
        />
      )}

      <div
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
        style={{
          position: "relative",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 2,
          height: isMain ? 35 : 20,
          padding: isMain ? "5px 7px" : "1px 6px",
          paddingLeft: rowIndent,
          borderRadius: isMain ? (hasChildren ? "7px 7px 0 0" : 7) : 4,
          background: rowBackground,
          boxShadow:
            node.selected && isMain
              ? "inset 0 0 0 1px rgba(111, 157, 204, 0.16)"
              : "none",
          transition: "background 140ms ease, box-shadow 140ms ease",
        }}
      >
        {!isMain && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: branchLeft,
              top: 10,
              width:
                rowIndent - branchLeft +
                (hasChildren ? 1 : 0),
              borderTop:
                "1px solid rgba(142, 182, 216, 0.82)",
              transform: "translateY(-0.5px)",
            }}
          />
        )}

        {hasChildren && (
          <button
            type="button"
            aria-label={`${node.name} ${expanded ? "접기" : "펼치기"}`}
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
              border:
                "1px solid rgba(142, 182, 216, 0.72)",
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
                  height: isMain ? 14 : 6,
                  borderLeft:
                    "1px solid rgba(142, 182, 216, 0.82)",
                  transform: "translateX(-0.5px)",
                  pointerEvents: "none",
                }}
              />
            )}
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 4h4" />
              {!expanded && <path d="M4 2v4" />}
            </svg>
          </button>
        )}

        <button
          onClick={() => onSelectNode(node.id)}
          style={{
            flex: 1,
            alignSelf: "stretch",
            minWidth: 0,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            background:
              node.selected && !isMain
                ? "linear-gradient(90deg, rgba(47, 79, 127, 0.88), rgba(42, 64, 91, 0.58))"
                : "transparent",
            color: "#f2f4f5",
            border:
              node.selected && !isMain
                ? "1px solid #4b6685"
                : "1px solid transparent",
            borderRadius:
              node.selected && !isMain ? 5 : 0,
            boxShadow:
              node.selected && !isMain
                ? "inset 0 0 0 1px rgba(111, 157, 204, 0.12)"
                : "none",
            cursor: "pointer",
            textAlign: "left",
            fontSize: isMain ? 12.5 : 12,
            lineHeight: 1.2,
            fontWeight: isMain ? 650 : 500,
          }}
        >
          {isMain ? (
            <PsdFileIcon />
          ) : (
            <span
              style={{
                color: "#8eb6d8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                transform:
                  node.entityKind === "layer"
                    ? "translateY(3px)"
                    : "translateY(1px)",
              }}
            >
              <LayerCompositionIcon
                kind={node.entityKind ?? "layer"}
                size={14}
              />
            </span>
          )}

          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: -0.1,
            }}
          >
            {isMain
              ? node.name.replace(/\.psd$/i, "")
              : node.name}
          </span>

          {node.sourceSyncStatus === "new" && (
            <span
              className="ui-badge ui-badge--new"
            >
              NEW
            </span>
          )}

        </button>

        {node.canRefresh && node.canDelete && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
            <ActionButton
              label={`${node.name} 새로고침`}
              color="#7e9bb2"
              onClick={() => onRefreshMainComp(node.id)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a8.5 8.5 0 0 1-14.6 6" />
                <path d="M3 12A8.5 8.5 0 0 1 17.6 6" />
                <path d="M7 18H4v-3" />
                <path d="M17 6h3v3" />
              </svg>
            </ActionButton>

            <ActionButton
              label={`${node.name} 삭제`}
              color="#9a7171"
              onClick={() => onDeleteMainComp(node.id)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4.8c0-.7.6-1.3 1.3-1.3h5.4c.7 0 1.3.6 1.3 1.3V6" />
                <path d="M7 6l.8 13.2c0 .7.6 1.3 1.3 1.3h5.8c.7 0 1.3-.6 1.3-1.3L17 6" />
                <path d="M10 10.5v6" />
                <path d="M14 10.5v6" />
              </svg>
            </ActionButton>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            padding: isMain ? "0 0 6px" : "0",
            borderTop: "none",
            borderRadius: isMain ? "0 0 7px 7px" : 0,
            background: isMain ? "rgba(18, 21, 24, 0.48)" : "transparent",
          }}
        >
          {node.children.map((child, index) => (
            <PsdTreeNode
              key={child.id}
              node={child}
              isFirstRoot={index === 0}
              draggedMainCompId={draggedMainCompId}
              dropTarget={dropTarget}
              onSelectNode={onSelectNode}
              onRefreshMainComp={onRefreshMainComp}
              onDeleteMainComp={onDeleteMainComp}
              onBeginMainDrag={onBeginMainDrag}
              onDragOverMain={onDragOverMain}
              onDropMain={onDropMain}
              onEndMainDrag={onEndMainDrag}
              parentGuideLeft={childGuideLeft}
              isLastSibling={
                index === node.children.length - 1
              }
            />
          ))}
        </div>
      )}

      {showDropAfter && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            zIndex: 2,
            left: 5,
            right: 5,
            bottom: -4,
            height: 2,
            borderRadius: 999,
            background: "#5d8fcb",
            boxShadow: "0 0 0 1px rgba(93, 143, 203, 0.18), 0 0 8px rgba(93, 143, 203, 0.35)",
          }}
        />
      )}
    </div>
  );
}
