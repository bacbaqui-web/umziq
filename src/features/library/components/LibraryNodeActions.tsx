import { useState, type ReactNode } from "react";
import type { LibraryNodeViewModel } from "@/engines/library";

function ActionButton({
  label,
  color,
  onClick,
  children,
  compact = false,
}: {
  readonly label: string;
  readonly color: string;
  readonly onClick: () => void;
  readonly children: ReactNode;
  readonly compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      draggable={false}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
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

export default function LibraryNodeActions({
  node,
  onToggleVisibility,
  onToggleLock,
  onTogglePlayback,
  onBeginRename,
  onDelete,
  onRefresh,
  onDeleteSource,
}: {
  readonly node: LibraryNodeViewModel;
  readonly onToggleVisibility: () => void;
  readonly onToggleLock: () => void;
  readonly onTogglePlayback: () => void;
  readonly onBeginRename: () => void;
  readonly onDelete: () => void;
  readonly onRefresh: () => void;
  readonly onDeleteSource: () => void;
}) {
  if (node.canRefresh && node.canDelete) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: "0 0 auto" }}>
        <ActionButton label={`${node.name} 새로고침`} color="#7e9bb2" onClick={onRefresh}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8.5 8.5 0 0 1-14.6 6" /><path d="M3 12A8.5 8.5 0 0 1 17.6 6" /><path d="M7 18H4v-3" /><path d="M17 6h3v3" />
          </svg>
        </ActionButton>
        <ActionButton label={`${node.name} 삭제`} color="#9a7171" onClick={onDeleteSource}>
          <TrashIcon size={12} full />
        </ActionButton>
      </div>
    );
  }
  if (node.type === "main" || node.type === "project") return null;
  const isAudio = node.contentKind === "audio";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1, flex: "0 0 auto" }}>
      <ActionButton
        label={isAudio ? `${node.name} ${node.playing ? "재생 정지" : "재생"}` : `${node.name} ${node.locked ? "잠금 해제" : "잠금"}`}
        color={isAudio ? node.playing ? "#73d99a" : "#6f9d7d" : node.locked ? "#9fc5e5" : "#657785"}
        onClick={isAudio ? onTogglePlayback : onToggleLock}
        compact
      >
        {isAudio ? (
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
        label={isAudio ? `${node.name} ${node.muted ? "음소거 해제" : "음소거"}` : `${node.name} ${node.visible ? "숨기기" : "보이기"}`}
        color={isAudio ? node.muted ? "#657785" : "#73d99a" : node.visible ? "#9fc5e5" : "#657785"}
        onClick={onToggleVisibility}
        compact
      >
        {isAudio ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10v4h4l5 4V6L8 10H4Z" />
            {node.muted ? <path d="m17 9 4 6M21 9l-4 6" /> : <path d="M16 9.5a4 4 0 0 1 0 5" />}
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {node.visible ? <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></> : <><path d="m3 3 18 18" /><path d="M10.6 6.1A11 11 0 0 1 12 6c6.5 0 10 6 10 6a15.7 15.7 0 0 1-2.2 2.8M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3.4-.6" /></>}
          </svg>
        )}
      </ActionButton>
      <ActionButton label={`${node.name} 이름 수정`} color="#8199ad" onClick={onBeginRename} compact>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </svg>
      </ActionButton>
      <ActionButton label={`${node.name} 삭제`} color="#9a7171" onClick={onDelete} compact>
        <TrashIcon size={11} />
      </ActionButton>
    </div>
  );
}

function TrashIcon({ size, full = false }: { readonly size: number; readonly full?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" /><path d="M8 6V4.8c0-.7.6-1.3 1.3-1.3h5.4c.7 0 1.3.6 1.3 1.3V6" /><path d="M7 6l.8 13.2c0 .7.6 1.3 1.3 1.3h5.8c.7 0 1.3-.6 1.3-1.3L17 6" />
      {full && <><path d="M10 10.5v6" /><path d="M14 10.5v6" /></>}
    </svg>
  );
}
