import { memo } from "react";
import PsdTreeNode from "@/features/psdtree/components/PsdTreeNode";
import PsdImportPreviewDialog from "@/features/psdtree/components/PsdImportPreviewDialog";
import PsdRefreshSummaryCard from "@/features/psdtree/components/PsdRefreshSummaryCard";
import type { PsdTreeViewProps } from "@/engines/psd-tree";

function PsdTree({
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
  onScaleImport,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <PsdImportPreviewDialog
        plan={importPlan}
        status={importPreviewStatus}
        error={importPreviewError}
        onCancel={onCancelImport}
        onConfirm={onConfirmImport}
        onMoveNode={onMoveImportNode}
        onScale={onScaleImport}
      />
      <button
        className="psd-import-button"
        onClick={onImportClick}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: -0.1,
          }}
        >
          PSD 불러오기
        </span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flex: "0 0 auto" }}
        >
          <path d="M12 5v14M5 12h14" />
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

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
            isLastSibling={index === nodes.length - 1}
            {...nodeHandlers}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(PsdTree);
