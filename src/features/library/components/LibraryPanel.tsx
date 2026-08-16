import { memo } from "react";
import LibraryNode from "@/features/library/components/LibraryNode";
import PsdImportPreviewDialog from "@/features/library/components/PsdImportPreviewDialog";
import PsdRefreshSummaryCard from "@/features/library/components/PsdRefreshSummaryCard";
import type { LibraryViewProps } from "@/engines/library";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";

function LibraryPanel({
  nodes,
  fileInputRef,
  audioFileInputRef,
  draggedMainCompId,
  dropTarget,
  importPlan,
  importPreviewStatus,
  importPreviewError,
  refreshSummary,
  onImportClick,
  onFileInputChange,
  onAudioImportClick,
  onAudioFileInputChange,
  onSelectNode,
  onToggleNodeVisibility,
  onToggleNodeLock,
  onRenameNode,
  onDeleteNode,
  onRefreshMainComp,
  onDeleteMainComp,
  onBeginMainDrag,
  onDragOverMain,
  onDropMain,
  onEndMainDrag,
  onCancelImport,
  onConfirmImport,
  onMoveImportNode,
  onScaleImport,
  onRenameImportNode,
  onRemoveImportNode,
  onDismissRefreshSummary,
}: LibraryViewProps) {
  const nodeHandlers = {
    draggedMainCompId,
    dropTarget,
    onSelectNode,
    onToggleNodeVisibility,
    onToggleNodeLock,
    onRenameNode,
    onDeleteNode,
    onRefreshMainComp,
    onDeleteMainComp,
    onBeginMainDrag,
    onDragOverMain,
    onDropMain,
    onEndMainDrag,
  };
  const projectNode = nodes.find((node) => node.type === "project") ?? null;
  const libraryNodes = nodes.filter((node) => node.type !== "project");

  return (
    <div
      aria-label="라이브러리"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <PsdImportPreviewDialog
        plan={importPlan}
        status={importPreviewStatus}
        error={importPreviewError}
        onCancel={onCancelImport}
        onConfirm={onConfirmImport}
        onMoveNode={onMoveImportNode}
        onScale={onScaleImport}
        onRenameNode={onRenameImportNode}
        onRemoveNode={onRemoveImportNode}
      />
      {refreshSummary && (
        <PsdRefreshSummaryCard
          summary={refreshSummary}
          onDismiss={onDismissRefreshSummary}
        />
      )}
      {importPreviewStatus === "idle" && importPreviewError && (
        <div role="alert" style={{ color: "#e69a9a", fontSize: 12, padding: "0 8px" }}>
          {importPreviewError}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".psd"
        multiple
        style={{ display: "none" }}
        onChange={(event) => {
          if (event.currentTarget.files) {
            onFileInputChange(event.currentTarget.files);
          }
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac"
        style={{ display: "none" }}
        onChange={(event) => {
          if (event.currentTarget.files) {
            onAudioFileInputChange(event.currentTarget.files);
          }
          event.currentTarget.value = "";
        }}
      />

      <div style={{ display: "flex", flexDirection: "column" }}>
        {projectNode && (
          <div
            style={{
              height: 44,
              padding: "0 8px 0 9px",
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: projectNode.selected
                ? "1px solid #4b6685"
                : "1px solid #343d45",
              borderRadius: 8,
              background: projectNode.selected
                ? "linear-gradient(90deg, rgba(47, 79, 127, 0.9), rgba(42, 64, 91, 0.62))"
                : "linear-gradient(145deg, #23292f 0%, #1b2025 100%)",
              boxShadow: projectNode.selected
                ? "0 5px 16px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(111, 157, 204, 0.13)"
                : "0 4px 14px rgba(0, 0, 0, 0.18)",
            }}
          >
            <button
              type="button"
              onClick={onAudioImportClick}
              style={{
                height: 27, padding: "0 8px", border: "1px solid #46515b",
                borderRadius: 6, background: "rgba(20, 25, 30, 0.62)",
                color: "#a9d8b6", cursor: "pointer", fontSize: 11.5,
                fontWeight: 650, whiteSpace: "nowrap",
              }}
            >
              + 오디오
            </button>
            <button
              type="button"
              onClick={() => onSelectNode(projectNode.id)}
              style={{
                minWidth: 0,
                flex: 1,
                alignSelf: "stretch",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: 0,
                background: "transparent",
                color: "#f3f5f7",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8eb6d8",
                  flex: "0 0 auto",
                }}
              >
                <LayerCompositionIcon kind="composition" size={18} />
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 15,
                  lineHeight: 1,
                  fontWeight: 750,
                  letterSpacing: -0.2,
                }}
              >
                프로젝트
              </span>
            </button>

            <button
              type="button"
              onClick={onImportClick}
              style={{
                height: 27,
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "1px solid #46515b",
                borderRadius: 6,
                background: "rgba(20, 25, 30, 0.62)",
                color: "#cbd7e1",
                cursor: "pointer",
                fontSize: 11.5,
                fontWeight: 650,
                whiteSpace: "nowrap",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
                <path d="M6 1.5v9M1.5 6h9" />
              </svg>
              PSD 추가
            </button>
          </div>
        )}

        <div
          style={{
            position: "relative",
            marginLeft: 18,
            paddingTop: 7,
          }}
        >
        {libraryNodes.length === 0 && (
          <div
            className="psd-empty-state"
            style={{ marginLeft: 10 }}
          >
            아직 불러온 PSD가 없습니다.
          </div>
        )}

        {libraryNodes.map((node, index) => (
          <div
            key={node.id}
            style={{
              position: "relative",
              paddingLeft: 10,
              paddingBottom: index === libraryNodes.length - 1 ? 0 : 6,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: index === 0 ? -20 : -7,
                height: index === libraryNodes.length - 1
                  ? index === 0 ? 38 : 25
                  : index === 0 ? "calc(100% + 20px)" : "calc(100% + 7px)",
                borderLeft: "1px solid rgba(142, 182, 216, 0.82)",
                transform: "translateX(-0.5px)",
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 18,
                width: 13,
                borderTop: "1px solid rgba(142, 182, 216, 0.82)",
                transform: "translateY(-0.5px)",
              }}
            />
          <LibraryNode
            node={node}
            isFirstRoot={index === 0}
            isLastSibling={index === libraryNodes.length - 1}
            {...nodeHandlers}
          />
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

export default memo(LibraryPanel);
