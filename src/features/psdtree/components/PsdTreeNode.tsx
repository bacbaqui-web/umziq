import { useState, type ReactNode } from "react";
import type { PsdTreeNodeProps } from "@/engines/psd-tree";

function FolderIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 7.5h5l1.8 2h9.2a1 1 0 0 1 1 1v7.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V8.9a1.4 1.4 0 0 1 1.4-1.4Z" />
    </svg>
  );
}

function PsdFileIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 24,
        height: 28,
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        flex: "0 0 auto",
        color: "#82a7c9",
      }}
    >
      <svg
        width="24"
        height="28"
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
          bottom: 4,
          fontSize: 6.5,
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
        width: 28,
        height: 28,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? "#2a3036" : "rgba(24, 28, 32, 0.45)",
        color,
        border: hovered ? "1px solid #46515b" : "1px solid #343a40",
        borderRadius: 7,
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
}: PsdTreeNodeProps) {
  const [rowHovered, setRowHovered] = useState(false);
  const isRoot = node.depth === 0;
  const isMaster = node.type === "master";
  const isMain = node.type === "main";
  const hasChildren = node.children.length > 0;
  const rowIndent = isMaster ? 10 : isMain ? 14 : 14 + (node.depth - 1) * 14;
  const childGuideLeft = rowIndent + 4;
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
    ? "linear-gradient(90deg, rgba(47, 79, 127, 0.88), rgba(42, 64, 91, 0.58))"
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
        marginTop: isRoot && !isFirstRoot ? 10 : isMain ? 4 : 0,
        border: isMain
          ? node.selected ? "1px solid #4b6685" : "1px solid #343a40"
          : "none",
        borderRadius: isMain ? 12 : 7,
        background: isMain
          ? "linear-gradient(145deg, #20252a 0%, #1a1e22 100%)"
          : isDragging ? "rgba(74, 84, 96, 0.22)" : "transparent",
        boxShadow: isMain
          ? node.selected
            ? "0 10px 28px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(86, 126, 168, 0.08)"
            : "0 8px 24px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255,255,255,0.025)"
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

      <div
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: isMain ? 52 : isMaster ? 40 : 34,
          padding: isMain ? "6px 9px" : "2px 8px",
          paddingLeft: rowIndent,
          borderRadius: isMain ? (hasChildren ? "11px 11px 0 0" : 11) : 7,
          background: rowBackground,
          boxShadow: node.selected ? "inset 0 0 0 1px rgba(111, 157, 204, 0.16)" : "none",
          transition: "background 140ms ease, box-shadow 140ms ease",
        }}
      >
        {node.selected && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: isMain ? 9 : 6,
              bottom: isMain ? 9 : 6,
              width: 2,
              borderRadius: "0 2px 2px 0",
              background: "#6f9dcc",
              boxShadow: "0 0 8px rgba(111, 157, 204, 0.35)",
            }}
          />
        )}

        {!isMaster && !isMain && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: rowIndent - 10,
              top: "50%",
              width: 10,
              borderTop: "1px solid #343c44",
              transform: "translateY(-50%)",
            }}
          />
        )}

        <button
          onClick={() => onSelectNode(node.id)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: isMain ? 9 : 8,
            background: "transparent",
            color: "#f2f4f5",
            border: "1px solid transparent",
            borderRadius: 0,
            cursor: "pointer",
            textAlign: "left",
            fontSize: isMain ? 13 : 12.5,
            lineHeight: 1.2,
            fontWeight: isMain ? 650 : 500,
          }}
        >
          {isMaster ? (
            <span
              style={{
                color: "#c6b36b",
                fontSize: 10.5,
                letterSpacing: 0.85,
                fontWeight: 800,
                flex: "0 0 auto",
              }}
            >
              MASTER
            </span>
          ) : isMain ? (
            <PsdFileIcon />
          ) : (
            <span
              style={{
                color: "#8eb6d8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              <FolderIcon />
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
            {node.name}
          </span>

          {node.sourceSyncStatus === "new" && (
            <span
              className="ui-badge ui-badge--new"
            >
              NEW
            </span>
          )}

          {isMain && (
            <span
              style={{
                padding: "3px 7px",
                color: "#aab2b9",
                background: "#2c3238",
                border: "1px solid #3b434b",
                borderRadius: 999,
                fontSize: 9,
                lineHeight: 1,
                fontWeight: 700,
                letterSpacing: 0.45,
                flex: "0 0 auto",
              }}
            >
              PSD
            </span>
          )}
        </button>

        {node.canRefresh && node.canDelete && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: "0 0 auto" }}>
            <ActionButton
              label={`${node.name} 새로고침`}
              color="#7e9bb2"
              onClick={() => onRefreshMainComp(node.id)}
            >
              <svg
                width="14"
                height="14"
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
                width="14"
                height="14"
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

      {hasChildren && (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: isMaster ? 10 : 2,
            padding: isMain ? "7px 7px 9px" : isMaster ? "2px 0 0" : "0",
            borderTop: isMain ? "1px solid #2d3339" : "none",
            borderRadius: isMain ? "0 0 11px 11px" : 0,
            background: isMain ? "rgba(18, 21, 24, 0.48)" : "transparent",
          }}
        >
          {!isMaster && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: childGuideLeft,
                top: isMain ? 8 : 0,
                bottom: 17,
                borderLeft: "1px solid #303840",
              }}
            />
          )}

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
