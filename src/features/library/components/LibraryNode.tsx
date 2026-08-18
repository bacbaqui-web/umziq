import { useState, type ReactNode } from "react";
import type { LibraryNodeProps } from "@/engines/library";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

type Props = LibraryNodeProps & {
  readonly parentGuideLeft?: number;
  readonly isLastSibling?: boolean;
  readonly projectRootChild?: boolean;
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

function AudioIcon({ provenance }: { provenance: "imported" | "recorded" | null }) {
  return (
    <span
      aria-label={provenance === "recorded" ? "움직에서 녹음" : "불러온 오디오"}
      style={{
        width: 14, height: 14, display: "inline-flex", alignItems: "center",
        justifyContent: "center", flex: "0 0 auto", color: "#65c98a",
      }}
    >
      {provenance === "recorded" ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
          <rect x="5" y="1.5" width="6" height="9" rx="3" />
          <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5M5.5 14.5h5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.5 11V2.2c2.9.35 4.2 1.65 4.2 3.55-1.05-.85-2.3-1.25-4.2-1.25" />
          <ellipse cx="7" cy="11.5" rx="2.6" ry="2" transform="rotate(-18 7 11.5)" />
        </svg>
      )}
    </span>
  );
}

function ActionButton({
  label,
  color,
  onClick,
  children,
  compact = false,
}: {
  label: string;
  color: string;
  onClick: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      draggable={false}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onDragStart={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      style={{
        width: compact ? 17 : 22,
        height: compact ? 17 : 22,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered ? "#2a3036" : "rgba(24, 28, 32, 0.45)",
        color,
        border: hovered ? "1px solid #46515b" : "1px solid #343a40",
        borderRadius: compact ? 4 : 6,
        cursor: "pointer",
        opacity: hovered ? 1 : 0.86,
        transition: "background 140ms ease, border-color 140ms ease, opacity 140ms ease",
      }}
    >
      {children}
    </button>
  );
}

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
  const isProject = node.type === "project";
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

      {!isMain && !usesOuterProjectConnector && (
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
        onMouseMove={(event) => {
          if (node.preview && !editing && !isProject) {
            const preview = node.preview();
            if (preview) onPreviewMove(preview, event.clientX, event.clientY);
          }
        }}
        onMouseLeave={() => {
          setRowHovered(false);
          onPreviewEnd();
        }}
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
        {usesOuterProjectConnector && (
          <>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: -7,
                height: 17,
                borderLeft: "1px solid rgba(142, 182, 216, 0.82)",
                transform: "translateX(-0.5px)",
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 10,
                width: 3,
                borderTop: "1px solid rgba(142, 182, 216, 0.82)",
                transform: "translateY(-0.5px)",
              }}
            />
          </>
        )}
        {!isMain && !usesOuterProjectConnector && (
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
          {isMain ? (
            <PsdFileIcon />
          ) : node.contentKind === "audio" ? (
            <AudioIcon provenance={node.audioProvenance} />
          ) : (
            <span
              style={{
                color: "#8eb6d8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                position: "relative",
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
              {hasChildren && expanded && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "calc(100% + 2px)",
                    height: 2,
                    borderLeft:
                      "1px solid rgba(142, 182, 216, 0.82)",
                    transform: "translateX(-0.5px)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </span>
          )}

          {editing && !isMain && !isProject ? (
            <input
              autoFocus
              value={nameDraft}
              aria-label={`${node.name} 이름 수정`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setNameDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  setNameDraft(node.name);
                  setEditing(false);
                }
              }}
              onBlur={() => {
                const name = nameDraft.trim();
                if (name) onRenameNode(node.id, name);
                else setNameDraft(node.name);
                setEditing(false);
              }}
              style={{
                minWidth: 0,
                flex: 1,
                height: 18,
                boxSizing: "border-box",
                padding: "0 4px",
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
          )}

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
              onClick={() => node.sourceId && onRefreshMainComp(node.sourceId)}
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
              onClick={() => node.sourceId && onDeleteMainComp(node.sourceId)}
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

        {!isMain && !isProject && (
          <div style={{ display: "flex", alignItems: "center", gap: 1, flex: "0 0 auto" }}>
            <ActionButton
              label={node.contentKind === "audio"
                ? `${node.name} ${node.playing ? "재생 정지" : "재생"}`
                : `${node.name} ${node.locked ? "잠금 해제" : "잠금"}`}
              color={node.contentKind === "audio"
                ? node.playing ? "#73d99a" : "#6f9d7d"
                : node.locked ? "#9fc5e5" : "#657785"}
              onClick={() => node.contentKind === "audio"
                ? onToggleNodePlayback(node.id)
                : onToggleNodeLock(node.id)}
              compact
            >
              {node.contentKind === "audio" ? (
                node.playing
                  ? <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx="1" /></svg>
                  : <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 2l7 4-7 4Z" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  {node.locked ? <path d="M8 10V7a4 4 0 0 1 8 0v3" /> : <path d="M8 10V7a4 4 0 0 1 7.5-2" />}
                </svg>
              )}
            </ActionButton>
            <ActionButton
              label={node.contentKind === "audio"
                ? `${node.name} ${node.muted ? "음소거 해제" : "음소거"}`
                : `${node.name} ${node.visible ? "숨기기" : "보이기"}`}
              color={node.contentKind === "audio"
                ? node.muted ? "#657785" : "#73d99a"
                : node.visible ? "#9fc5e5" : "#657785"}
              onClick={() => onToggleNodeVisibility(node.id)}
              compact
            >
              {node.contentKind === "audio" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 10v4h4l5 4V6L8 10H4Z" />
                  {node.muted ? <path d="m17 9 4 6M21 9l-4 6" /> : <path d="M16 9.5a4 4 0 0 1 0 5" />}
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {node.visible ? (
                  <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>
                ) : (
                  <><path d="m3 3 18 18" /><path d="M10.6 6.1A11 11 0 0 1 12 6c6.5 0 10 6 10 6a15.7 15.7 0 0 1-2.2 2.8M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3.4-.6" /></>
                )}
                </svg>
              )}
            </ActionButton>
            <ActionButton
              label={`${node.name} 이름 수정`}
              color="#8199ad"
              onClick={() => {
                setNameDraft(node.name);
                setEditing(true);
              }}
              compact
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
              </svg>
            </ActionButton>
            <ActionButton
              label={`${node.name} 삭제`}
              color="#9a7171"
              onClick={() => onDeleteNode(node.id)}
              compact
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4.8c0-.7.6-1.3 1.3-1.3h5.4c.7 0 1.3.6 1.3 1.3V6" />
                <path d="M7 6l.8 13.2c0 .7.6 1.3 1.3 1.3h5.8c.7 0 1.3-.6 1.3-1.3L17 6" />
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
