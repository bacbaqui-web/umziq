import PsdTreeNode from "@/features/psdtree/components/PsdTreeNode";
import PsdImportPreviewDialog from "@/features/psdtree/components/PsdImportPreviewDialog";
import PsdRefreshSummaryCard from "@/features/psdtree/components/PsdRefreshSummaryCard";
import type { PsdTreeViewProps } from "@/engines/psd-tree";

function ImportPsdIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 34,
        height: 40,
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        flex: "0 0 auto",
        color: "#8da9c3",
      }}
    >
      <svg
        width="34"
        height="40"
        viewBox="0 0 34 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      >
        <path d="M7 2.8h13.8L29 11v25.2a1.8 1.8 0 0 1-1.8 1.8H7a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z" />
        <path d="M20.5 3v8.4H29" />
      </svg>
      <span
        style={{
          position: "absolute",
          bottom: 6,
          fontSize: 8,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: 0.4,
        }}
      >
        PSD
      </span>
    </span>
  );
}

export default function PsdTree({
  nodes,
  fileInputRef,
  draggedMainCompId,
  dropTarget,
  importPlan,
  importPreviewStatus,
  importPreviewError,
  refreshSummary,
  onImportClick,
  onFileInputChange,
  onSelectNode,
  onRefreshMainComp,
  onDeleteMainComp,
  onBeginMainDrag,
  onDragOverMain,
  onDropMain,
  onEndMainDrag,
  onCancelImport,
  onConfirmImport,
  onMoveImportNode,
  onDismissRefreshSummary,
}: PsdTreeViewProps) {
  const nodeHandlers = {
    draggedMainCompId,
    dropTarget,
    onSelectNode,
    onRefreshMainComp,
    onDeleteMainComp,
    onBeginMainDrag,
    onDragOverMain,
    onDropMain,
    onEndMainDrag,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PsdImportPreviewDialog
        plan={importPlan}
        status={importPreviewStatus}
        error={importPreviewError}
        onCancel={onCancelImport}
        onConfirm={onConfirmImport}
        onMoveNode={onMoveImportNode}
      />
      <button
        className="psd-import-button"
        onClick={onImportClick}
      >
        <ImportPsdIcon />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 14,
              lineHeight: 1.3,
              fontWeight: 700,
              letterSpacing: -0.1,
            }}
          >
            PSD 불러오기
          </span>
          <span
            style={{
              display: "block",
              marginTop: 4,
              color: "#8f979f",
              fontSize: 11,
              lineHeight: 1.35,
              fontWeight: 400,
            }}
          >
            PSD 파일을 프로젝트에 추가하세요
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#78828b"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flex: "0 0 auto" }}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      {refreshSummary && (
        <PsdRefreshSummaryCard
          summary={refreshSummary}
          onDismiss={onDismissRefreshSummary}
        />
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {nodes.length === 0 && (
          <div
            className="psd-empty-state"
          >
            아직 불러온 PSD가 없습니다.
          </div>
        )}

        {nodes.map((node, index) => (
          <PsdTreeNode
            key={node.id}
            node={node}
            isFirstRoot={index === 0}
            {...nodeHandlers}
          />
        ))}
      </div>
    </div>
  );
}
