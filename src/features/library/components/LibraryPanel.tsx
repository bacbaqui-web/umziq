import { memo } from "react";
import type { LibraryViewProps } from "@/engines/library";
import type { SourceResourceReference } from "@/gateway";
import LibraryAssetCopyDialog from "@/features/library/components/LibraryAssetCopyDialog";
import LibraryHoverPreviewCard from "@/features/library/components/LibraryHoverPreviewCard";
import LibraryProjectHeader from "@/features/library/components/LibraryProjectHeader";
import LibraryRecordingReview from "@/features/library/components/LibraryRecordingReview";
import LibraryTree from "@/features/library/components/LibraryTree";
import PsdImportPreviewDialog from "@/features/library/components/PsdImportPreviewDialog";
import PsdRefreshSummaryCard from "@/features/library/components/PsdRefreshSummaryCard";

export type LibraryPanelProps = LibraryViewProps & {
  readonly registerSourceFiles: (
    files: readonly File[]
  ) => readonly SourceResourceReference[];
};

function LibraryPanel({
  projectIdentity = "project",
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
  audioRecordingPreview,
  audioRecordingLiveWaveform,
  audioRecordingProcessing,
  audioRecordingChangingProcessing,
  audioRecordingProcessingError,
  audioRecordingError,
  audioRecordingCanCancel,
  audioRecordingCanRetry,
  audioRecordingCanConfirm,
  enumerateMicrophoneDevices,
  subscribeMicrophoneDevices,
  assetCopyPrompt,
  hoverPreview,
  refreshSummary,
  missingSources,
  onReconnectSource,
  onImportClick,
  onFileInputChange,
  onAudioImportClick,
  onAudioFileInputChange,
  onStartAudioRecording,
  onCreateDrawingLayer,
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
  onSelectNodeForContextMenu,
  onToggleNodeVisibility,
  onToggleNodeLock,
  onToggleNodePlayback,
  onRenameNode,
  onDeleteNode,
  onDuplicateNode,
  onConvertNodeToDrawing,
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
  registerSourceFiles,
}: LibraryPanelProps) {
  const projectNode = nodes.find((node) => node.type === "project") ?? null;
  const libraryNodes = nodes.filter((node) => node.type !== "project");
  const nodeHandlers = {
    draggedMainCompId,
    dropTarget,
    onSelectNode,
    onSelectNodeForContextMenu,
    onToggleNodeVisibility,
    onToggleNodeLock,
    onToggleNodePlayback,
    onRenameNode,
    onDeleteNode,
    onDuplicateNode,
    onConvertNodeToDrawing,
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
      {missingSources.length > 0 && (
        <details className="project-missing-sources">
          <summary>연결 필요 {missingSources.length}</summary>
          {missingSources.map((source) => (
            <button className="ui-button" key={source.sourceId} onClick={() => onReconnectSource(source.sourceId)}>
              {source.displayName} 재연결
            </button>
          ))}
        </details>
      )}
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
          preview={audioRecordingPreview}
          readLiveWaveform={audioRecordingLiveWaveform}
          audioProcessing={audioRecordingProcessing}
          changingAudioProcessing={audioRecordingChangingProcessing}
          audioProcessingError={audioRecordingProcessingError}
          error={audioRecordingError}
          canCancel={audioRecordingCanCancel}
          canRetry={audioRecordingCanRetry}
          canConfirm={audioRecordingCanConfirm}
          enumerateDevices={enumerateMicrophoneDevices}
          subscribeDevices={subscribeMicrophoneDevices}
          onBegin={onBeginAudioRecording}
          onStop={onStopAudioRecording}
          onSetAudioProcessing={onSetAudioRecordingProcessing}
          onRetry={onRetryAudioRecording}
          onCancel={onCancelAudioRecording}
          onConfirm={onConfirmAudioRecording}
        />
      )}
      <input ref={fileInputRef} type="file" accept=".psd" multiple style={{ display: "none" }} onChange={(event) => {
        if (event.currentTarget.files) {
          onFileInputChange(registerSourceFiles(Array.from(event.currentTarget.files)));
        }
        event.currentTarget.value = "";
      }} />
      <input ref={audioFileInputRef} type="file" accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac" multiple style={{ display: "none" }} onChange={(event) => {
        if (event.currentTarget.files) {
          onAudioFileInputChange(registerSourceFiles(Array.from(event.currentTarget.files)));
        }
        event.currentTarget.value = "";
      }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {projectNode && (
          <LibraryProjectHeader key={`project-add:${projectIdentity}`} node={projectNode} onSelect={() => onSelectNode(projectNode.id)} onImportPsd={onImportClick} onCreateDrawing={onCreateDrawingLayer} onImportAudio={onAudioImportClick} onRecordAudio={onStartAudioRecording} />
        )}
        <LibraryTree key={`library-tree:${projectIdentity}`} nodes={libraryNodes} handlers={nodeHandlers} />
      </div>
      {hoverPreview && <LibraryHoverPreviewCard state={hoverPreview} />}
    </div>
  );
}

export default memo(LibraryPanel);
