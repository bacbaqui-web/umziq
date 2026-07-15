import type { PsdTreeNodeProps } from "@/features/psdtree/model/psdTreeTypes";

function FolderIcon() {
  return (
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
      <path d="M3.5 7.5h5l1.8 2h9.2a1 1 0 0 1 1 1v7.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V8.9a1.4 1.4 0 0 1 1.4-1.4Z" />
    </svg>
  );
}

export default function PsdTreeNode({
  comp,
  depth,
  isSelected,
  isRoot,
  isFirstRoot,
  draggedMainCompId,
  dropTarget,
  selectedCompId,
  onSelectComp,
  onRefreshMainComp,
  onDeleteMainComp,
  onSetDraggedMainCompId,
  onSetDropTarget,
  onReorderMainComps,
}: PsdTreeNodeProps) {
  const hasChildren = (comp.children?.length ?? 0) > 0;
  const rowIndent = 6 + depth * 12;
  const isDragging = comp.type === "main" && draggedMainCompId === comp.id;
  const showDropBefore =
    comp.type === "main" &&
    dropTarget?.targetId === comp.id &&
    dropTarget.position === "before";
  const showDropAfter =
    comp.type === "main" &&
    dropTarget?.targetId === comp.id &&
    dropTarget.position === "after";

  return (
    <div
      draggable={comp.type === "main"}
      onDragStart={() => {
        if (comp.type !== "main") return;
        onSetDraggedMainCompId(comp.id);
        onSetDropTarget(null);
      }}
      onDragEnd={() => {
        onSetDraggedMainCompId(null);
        onSetDropTarget(null);
      }}
      onDragOver={(event) => {
        if (comp.type !== "main" || !draggedMainCompId || draggedMainCompId === comp.id) return;

        event.preventDefault();

        const bounds = event.currentTarget.getBoundingClientRect();
        const pointerOffset = event.clientY - bounds.top;
        const nextPosition =
          pointerOffset < bounds.height / 2 ? "before" : "after";

        onSetDropTarget({
          targetId: comp.id,
          position: nextPosition,
        });
      }}
      onDrop={() => {
        if (
          comp.type !== "main" ||
          !draggedMainCompId ||
          !dropTarget ||
          dropTarget.targetId !== comp.id
        ) {
          return;
        }

        onReorderMainComps(draggedMainCompId, comp.id, dropTarget.position);
        onSetDraggedMainCompId(null);
        onSetDropTarget(null);
      }}
      style={{
        position: "relative",
        borderRadius: 6,
        marginTop: isRoot && !isFirstRoot ? 8 : 0,
        paddingTop: isRoot && !isFirstRoot ? 6 : 0,
        borderTop: isRoot && !isFirstRoot ? "1px solid #2a2f35" : "none",
        background: isDragging ? "rgba(74, 84, 96, 0.22)" : "transparent",
        opacity: isDragging ? 0.6 : 1,
        transform: isDragging ? "scale(0.992)" : "scale(1)",
        transition: "background 140ms ease, opacity 140ms ease, transform 140ms ease",
      }}
    >
      {showDropBefore && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 4,
            right: 4,
            top: isRoot && !isFirstRoot ? 1 : -2,
            height: 2,
            borderRadius: 999,
            background: "#5d8fcb",
            boxShadow: "0 0 0 1px rgba(93, 143, 203, 0.15)",
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 4,
          minHeight: 22,
          padding: "1px 4px",
          paddingLeft: rowIndent,
          borderRadius: 4,
          background: isSelected ? "#2f4f7f" : "transparent",
          transition: "background 140ms ease",
        }}
      >
        {depth > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: rowIndent - 8,
              top: "50%",
              width: 8,
              borderTop: "1px solid #39424c",
              transform: "translateY(-50%)",
            }}
          />
        )}

        <button
          onClick={() => onSelectComp(comp)}
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            color: "white",
            border: "none",
            textAlign: "left",
            cursor: "pointer",
            fontSize: 12,
            lineHeight: 1.2,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "1px 0",
          }}
        >
          {comp.type === "master" ? (
            <span
              style={{
                color: "#c6b36b",
                fontSize: 10,
                letterSpacing: 0.5,
                fontWeight: 700,
                flex: "0 0 auto",
              }}
            >
              MASTER
            </span>
          ) : comp.type === "main" ? (
            <span
              style={{
                color: "#d96a72",
                fontSize: 10,
                letterSpacing: 0.4,
                fontWeight: 700,
                flex: "0 0 auto",
              }}
            >
              PSD
            </span>
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
            }}
          >
            {comp.name}
          </span>
        </button>

        {comp.type === "main" && (
          <>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onRefreshMainComp(comp.id);
              }}
              aria-label={`${comp.name} 새로고침`}
              style={{
                width: 16,
                height: 16,
                padding: 0,
                background: "transparent",
                color: "#6f8fa8",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.92,
              }}
            >
              <svg
                width="11"
                height="11"
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
            </button>

            <button
              onClick={(event) => {
                event.stopPropagation();
                onDeleteMainComp(comp.id);
              }}
              aria-label={`${comp.name} 삭제`}
              style={{
                width: 16,
                height: 16,
                padding: 0,
                background: "transparent",
                color: "#8d6666",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.9,
              }}
            >
              <svg
                width="11"
                height="11"
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
            </button>
          </>
        )}
      </div>

      {showDropAfter && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 4,
            right: 4,
            bottom: -2,
            height: 2,
            borderRadius: 999,
            background: "#5d8fcb",
            boxShadow: "0 0 0 1px rgba(93, 143, 203, 0.15)",
          }}
        />
      )}

      {hasChildren && (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: rowIndent + 4,
              top: 0,
              bottom: 2,
              borderLeft: "1px solid #303840",
            }}
          />

          {comp.children?.map((child, index) => (
            <PsdTreeNode
              key={child.id}
              comp={child}
              depth={depth + 1}
              isSelected={selectedCompId === child.id}
              isRoot={false}
              isFirstRoot={index === 0}
              draggedMainCompId={draggedMainCompId}
              dropTarget={dropTarget}
              selectedCompId={selectedCompId}
              onSelectComp={onSelectComp}
              onRefreshMainComp={onRefreshMainComp}
              onDeleteMainComp={onDeleteMainComp}
              onSetDraggedMainCompId={onSetDraggedMainCompId}
              onSetDropTarget={onSetDropTarget}
              onReorderMainComps={onReorderMainComps}
            />
          ))}
        </div>
      )}
    </div>
  );
}
