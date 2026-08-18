import { memo } from "react";
import type { LibraryViewProps } from "@/engines/library";
import LibraryAssetCopyDialog from "@/features/library/components/LibraryAssetCopyDialog";
import LibraryHoverPreviewCard from "@/features/library/components/LibraryHoverPreviewCard";
import LibraryProjectHeader from "@/features/library/components/LibraryProjectHeader";
import LibraryRecordingReview from "@/features/library/components/LibraryRecordingReview";
import LibraryTree from "@/features/library/components/LibraryTree";
import PsdImportPreviewDialog from "@/features/library/components/PsdImportPreviewDialog";
import PsdRefreshSummaryCard from "@/features/library/components/PsdRefreshSummaryCard";

function LibraryPanel({
  nodes,
  fileInputRef,
  audioFileInputRef,
  draggedMainCompId,
  dropTarget,
  importPlan,
  importPreviewStatus,
  importPreviewError,
  audioRecordingStatus,
  audioRecordingName,
  audioRecordingFile,
  audioRecordingLiveWaveform,
  audioRecordingProcessing,
  audioRecordingChangingProcessing,
  audioRecordingProcessingError,
  audioRecordingError,
  audioRecordingCanCancel,
  audioRecordingCanRetry,
  audioRecordingCanConfirm,
  assetCopyPrompt,
  hoverPreview,
  refreshSummary,
  onImportClick,
  onFileInputChange,
  onAudioImportClick,
  onAudioFileInputChange,
  onStartAudioRecording,
  onBeginAudioRecording,
  onStopAudioRecording,
  onSetAudioRecordingProcessing,
  onRetryAudioRecording,
  onCancelAudioRecording,
  onConfirmAudioRecording,
  onResolveAssetCopy,
  onPreviewMove,
  onPreviewEnd,
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
  onCancelImport,
  onConfirmImport,
  onMoveImportNode,
  onScaleImport,
  onRenameImportNode,
  onRemoveImportNode,
  onDismissRefreshSummary,
}: LibraryViewProps) {
  const projectNode = nodes.find((node) => node.type === "project") ?? null;
  const libraryNodes = nodes.filter((node) => node.type !== "project");
  const nodeHandlers = {
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
  };
  return (
    <div aria-label="라이브러리" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <PsdImportPreviewDialog plan={importPlan} status={importPreviewStatus} error={importPreviewError} onCancel={onCancelImport} onConfirm={onConfirmImport} onMoveNode={onMoveImportNode} onScale={onScaleImport} onRenameNode={onRenameImportNode} onRemoveNode={onRemoveImportNode} />
      {assetCopyPrompt && <LibraryAssetCopyDialog prompt={assetCopyPrompt} onResolve={onResolveAssetCopy} />}
      {refreshSummary && <PsdRefreshSummaryCard summary={refreshSummary} onDismiss={onDismissRefreshSummary} />}
      {importPreviewStatus === "idle" && importPreviewError && (
        <div role="alert" style={{ color: "#e69a9a", fontSize: 12, padding: "0 8px" }}>{importPreviewError}</div>
      )}
      {audioRecordingStatus !== "idle" && (
        <LibraryRecordingReview
          status={audioRecordingStatus}
          name={audioRecordingName}
          file={audioRecordingFile}
          readLiveWaveform={audioRecordingLiveWaveform}
          audioProcessing={audioRecordingProcessing}
          changingAudioProcessing={audioRecordingChangingProcessing}
          audioProcessingError={audioRecordingProcessingError}
          error={audioRecordingError}
          canCancel={audioRecordingCanCancel}
          canRetry={audioRecordingCanRetry}
          canConfirm={audioRecordingCanConfirm}
          onBegin={onBeginAudioRecording}
          onStop={onStopAudioRecording}
          onSetAudioProcessing={onSetAudioRecordingProcessing}
          onRetry={onRetryAudioRecording}
          onCancel={onCancelAudioRecording}
          onConfirm={onConfirmAudioRecording}
        />
      )}
      <input ref={fileInputRef} type="file" accept=".psd" multiple style={{ display: "none" }} onChange={(event) => {
        if (event.currentTarget.files) onFileInputChange(event.currentTarget.files);
        event.currentTarget.value = "";
      }} />
      <input ref={audioFileInputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac" multiple style={{ display: "none" }} onChange={(event) => {
        if (event.currentTarget.files) onAudioFileInputChange(event.currentTarget.files);
        event.currentTarget.value = "";
      }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {projectNode && (
          <LibraryProjectHeader node={projectNode} onSelect={() => onSelectNode(projectNode.id)} onImportPsd={onImportClick} onImportAudio={onAudioImportClick} onRecordAudio={onStartAudioRecording} />
        )}
        <LibraryTree nodes={libraryNodes} handlers={nodeHandlers} />
      </div>
      {hoverPreview && <LibraryHoverPreviewCard state={hoverPreview} />}
    </div>
  );
}

export default memo(LibraryPanel);
