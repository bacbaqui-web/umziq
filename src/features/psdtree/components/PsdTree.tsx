import PsdTreeNode from "@/features/psdtree/components/PsdTreeNode";
import type { PsdTreeViewProps } from "@/engines/psd-tree";

export default function PsdTree({
  nodes,
  fileInputRef,
  draggedMainCompId,
  dropTarget,
  onImportClick,
  onFileInputChange,
  onSelectNode,
  onRefreshMainComp,
  onDeleteMainComp,
  onBeginMainDrag,
  onDragOverMain,
  onDropMain,
  onEndMainDrag,
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
      <div style={{ fontSize: 18, fontWeight: 700 }}>PSD Tree</div>

      <button
        onClick={onImportClick}
        style={{
          padding: "7px 9px",
          background: "#2d2d2d",
          color: "white",
          border: "1px solid #555",
          borderRadius: 6,
          cursor: "pointer",
          textAlign: "left",
          fontSize: 13,
          lineHeight: 1.2,
        }}
      >
        PSD 불러오기
      </button>

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

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {nodes.length === 0 && (
          <div style={{ color: "#aaa", fontSize: 13 }}>
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
