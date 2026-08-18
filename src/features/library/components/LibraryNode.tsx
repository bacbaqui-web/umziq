import { useState } from "react";
import type { LibraryNodeProps } from "@/engines/library";
import LibraryNodeActions from "@/features/library/components/LibraryNodeActions";
import LibraryNodeIdentity from "@/features/library/components/LibraryNodeIdentity";
import LibraryNodeRow from "@/features/library/components/LibraryNodeRow";
import {
  LibraryDropIndicator,
  LibraryTreeBranchGuide,
  LibraryTreeConnector,
} from "@/features/library/components/LibraryTreeConnector";

type Props = LibraryNodeProps & {
  readonly parentGuideLeft?: number;
  readonly isLastSibling?: boolean;
  readonly projectRootChild?: boolean;
};

export default function LibraryNode({
  node,
  isFirstRoot,
  draggedMainCompId,
  dropTarget,
  onSelectNode,
  onToggleNodeVisibility,
  onToggleNodeLock,
  onToggleNodePlayback,
  onRenameNode,
  onDeleteNode,
  onRefreshMainComp,
  onDeleteMainComp,
  onBeginMainDrag,
  onDragOverMain,
  onDropMain,
  onEndMainDrag,
  onMoveNodeKeyboard,
  onPreviewMove,
  onPreviewEnd,
  parentGuideLeft,
  isLastSibling = false,
  projectRootChild = false,
}: Props) {
  const [rowHovered, setRowHovered] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(node.name);
  const isRoot = node.depth === 0;
  const isMain = node.type === "main";
  const usesOuterProjectConnector = projectRootChild && !isMain;
  const hasChildren = node.children.length > 0;
  const baseRowIndent = isMain
    ? 3
    : 18 + (node.depth - 1) * 14;
  const branchLeft = parentGuideLeft ?? 0;
  const rowIndent = usesOuterProjectConnector
    ? 3
    : isMain
    ? baseRowIndent
    : node.depth === 1
      ? Math.round(
          branchLeft +
          (baseRowIndent - branchLeft) * 0.75
        )
      : branchLeft + 10;
  const childGuideLeft = isMain ? rowIndent + 5 : rowIndent + 19;
  const isDragging = node.canReorder && draggedMainCompId === node.id;
  const showDropBefore =
    node.canReorder &&
    dropTarget?.targetId === node.id &&
    dropTarget.position === "before";
  const showDropAfter =
    node.canReorder &&
    dropTarget?.targetId === node.id &&
    dropTarget.position === "after";
  const showDropInside =
    node.canReorder &&
    dropTarget?.targetId === node.id &&
    dropTarget.position === "inside";
  const dropGap = isMain ? 37 : 22;

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
      onDragStart={(event) => {
        event.stopPropagation();
        if (node.canReorder) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", node.id);
          onBeginMainDrag(node.id);
        }
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        onEndMainDrag();
      }}
      onDragOver={(event) => {
        if (node.canReorder) event.stopPropagation();
        const bounds = event.currentTarget.getBoundingClientRect();
        if (onDragOverMain(node.id, event.clientY, bounds.top, bounds.height)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropMain(node.id);
      }}
      style={{
        position: "relative",
        marginTop:
          (isRoot && !isFirstRoot ? 6 : isMain ? 2 : 0) +
          (showDropBefore ? dropGap : 0),
        marginBottom: showDropAfter ? dropGap : 0,
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
        outline: showDropInside ? "1px solid #65c98a" : "none",
        outlineOffset: showDropInside ? 2 : 0,
        opacity: isDragging ? 0.62 : 1,
        transform: isDragging ? "scale(0.988)" : "scale(1)",
        transition: "margin 170ms cubic-bezier(.2,.8,.2,1), border-color 150ms ease, box-shadow 150ms ease, opacity 140ms ease, transform 140ms ease",
      }}
    >
      {showDropBefore && <LibraryDropIndicator edge="before" />}

      <LibraryTreeBranchGuide
        isMain={isMain}
        usesOuterProjectConnector={usesOuterProjectConnector}
        branchLeft={branchLeft}
        isLastSibling={isLastSibling}
      />

      <LibraryNodeRow
        node={node}
        isMain={isMain}
        editing={editing}
        hasChildren={hasChildren}
        rowIndent={rowIndent}
        rowBackground={rowBackground}
        onHoveredChange={setRowHovered}
        onPreviewMove={onPreviewMove}
        onPreviewEnd={onPreviewEnd}
      >
        <LibraryTreeConnector
          isMain={isMain}
          usesOuterProjectConnector={usesOuterProjectConnector}
          branchLeft={branchLeft}
          rowIndent={rowIndent}
          hasChildren={hasChildren}
        />

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
            {expanded && isMain && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "100%",
                  height: 14,
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
          onKeyDown={(event) => {
            if (!event.altKey || !node.canReorder) return;
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              onMoveNodeKeyboard(node.id, event.key === "ArrowUp" ? -1 : 1);
            }
          }}
          title={node.canReorder ? "드래그 또는 Alt+위/아래 화살표로 순서 변경" : undefined}
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
          <LibraryNodeIdentity
            node={node}
            hasChildren={hasChildren}
            expanded={expanded}
            editing={editing}
            draft={nameDraft}
            setDraft={setNameDraft}
            onRename={(name) => onRenameNode(node.id, name)}
            onFinish={() => setEditing(false)}
          />

          {node.sourceSyncStatus === "new" && (
            <span
              className="ui-badge ui-badge--new"
            >
              NEW
            </span>
          )}

        </button>

        <LibraryNodeActions
          node={node}
          onToggleVisibility={() => onToggleNodeVisibility(node.id)}
          onToggleLock={() => onToggleNodeLock(node.id)}
          onTogglePlayback={() => onToggleNodePlayback(node.id)}
          onBeginRename={() => {
            setNameDraft(node.name);
            setEditing(true);
          }}
          onDelete={() => onDeleteNode(node.id)}
          onRefresh={() => node.sourceId && onRefreshMainComp(node.sourceId)}
          onDeleteSource={() => node.sourceId && onDeleteMainComp(node.sourceId)}
        />
      </LibraryNodeRow>

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
            <LibraryNode
              key={child.id}
              node={child}
              isFirstRoot={index === 0}
              draggedMainCompId={draggedMainCompId}
              dropTarget={dropTarget}
              onSelectNode={onSelectNode}
              onToggleNodeVisibility={onToggleNodeVisibility}
              onToggleNodeLock={onToggleNodeLock}
              onToggleNodePlayback={onToggleNodePlayback}
              onRenameNode={onRenameNode}
              onDeleteNode={onDeleteNode}
              onRefreshMainComp={onRefreshMainComp}
              onDeleteMainComp={onDeleteMainComp}
              onBeginMainDrag={onBeginMainDrag}
              onDragOverMain={onDragOverMain}
              onDropMain={onDropMain}
              onEndMainDrag={onEndMainDrag}
              onMoveNodeKeyboard={onMoveNodeKeyboard}
              onPreviewMove={onPreviewMove}
              onPreviewEnd={onPreviewEnd}
              parentGuideLeft={childGuideLeft}
              isLastSibling={
                index === node.children.length - 1
              }
            />
          ))}
        </div>
      )}

      {showDropAfter && <LibraryDropIndicator edge="after" />}
    </div>
  );
}
