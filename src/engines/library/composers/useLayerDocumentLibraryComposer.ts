import { useSyncExternalStore } from "react";
import type { LayerDocumentLibraryEngineOptions } from "@/engines/library/models/libraryEngineModel";
import type { LibraryViewProps } from "@/engines/library/models/libraryModel";
import { buildLayerDocumentLibraryNodes } from "@/engines/library/helpers/libraryTreeProjectionHelpers";
import { createLibraryNodeCommandController } from "@/engines/library/controllers/createLibraryNodeCommandController";
import { useLibraryAssetCopyController } from "@/engines/library/controllers/useLibraryAssetCopyController";
import { useLibraryAudioImportController } from "@/engines/library/controllers/useLibraryAudioImportController";
import { useLibraryDragController } from "@/engines/library/controllers/useLibraryDragController";
import { useLibraryHoverPreviewController } from "@/engines/library/controllers/useLibraryHoverPreviewController";
import { useLibraryPsdImportController } from "@/engines/library/controllers/useLibraryPsdImportController";
import { useLibraryRecordingControllerAdapter } from "@/engines/library/adapters/useLibraryRecordingControllerAdapter";

export function useLayerDocumentLibraryComposer(
  options: LayerDocumentLibraryEngineOptions
) {
  const projectIdentity = `${options.controller.readProject().metadata.projectId}:${options.resetRevision}`;
  const assetCopy = useLibraryAssetCopyController(projectIdentity);
  const psdImport = useLibraryPsdImportController({
    engine: options,
    assetCopy: assetCopy.requestPort,
    projectIdentity,
  });
  const audioImport = useLibraryAudioImportController({
    audioImport: options.audioImport,
    assetCopy: assetCopy.requestPort,
    projectIdentity,
  });
  const recording = useLibraryRecordingControllerAdapter({
    audioImport: options.audioImport,
    audioRecording: options.audioRecording,
    assetStore: options.recordingAssetStore,
    projectIdentity,
  });
  const hoverPreview = useLibraryHoverPreviewController(projectIdentity);
  const playingLayerDocumentId = useSyncExternalStore(
    options.audio.subscribe,
    () => {
      const state = options.audio.read();
      return state.status === "playing" ? state.layerDocumentId : null;
    },
    () => null
  );
  const nodes = buildLayerDocumentLibraryNodes(
    options.controller,
    {
      selectedLayerDocumentId: options.audio.readSelectedLayerDocumentId(),
      playingLayerDocumentId,
    },
    options.preview?.read
  );
  const nodeCommands = createLibraryNodeCommandController({
    controller: options.controller,
    audio: options.audio,
    nodes,
    beginRefresh: psdImport.beginRefresh,
  });
  const drag = useLibraryDragController({
    controller: options.controller,
    audio: options.audio,
    nodes,
    projectIdentity,
  });

  const viewProps: LibraryViewProps = {
    nodes,
    fileInputRef: psdImport.fileInputRef,
    audioFileInputRef: audioImport.audioFileInputRef,
    draggedMainCompId: drag.draggedNodeId,
    dropTarget: drag.dropTarget,
    importPlan: psdImport.importPlan,
    importPreviewStatus: psdImport.status,
    importPreviewError:
      psdImport.error ?? audioImport.error,
    refreshSummary: psdImport.summary,
    audioRecordingStatus: recording.status,
    audioRecordingName: recording.name,
    audioRecordingFile: recording.file,
    audioRecordingLiveWaveform: recording.readLiveWaveform,
    audioRecordingProcessing: recording.audioProcessing,
    audioRecordingChangingProcessing: recording.changingAudioProcessing,
    audioRecordingProcessingError: recording.audioProcessingError,
    audioRecordingError: recording.error,
    audioRecordingCanCancel: recording.canCancel,
    audioRecordingCanRetry: recording.canRetry,
    audioRecordingCanConfirm: recording.canConfirm,
    assetCopyPrompt: assetCopy.prompt,
    hoverPreview: hoverPreview.preview,
    onImportClick: psdImport.beginImport,
    onFileInputChange: psdImport.onFileInputChange,
    onAudioImportClick: audioImport.beginImport,
    onAudioFileInputChange: audioImport.onFileInputChange,
    onStartAudioRecording: recording.start,
    onBeginAudioRecording: recording.begin,
    onStopAudioRecording: recording.stop,
    onSetAudioRecordingProcessing: recording.setAudioProcessing,
    onRetryAudioRecording: recording.retry,
    onCancelAudioRecording: recording.cancel,
    onConfirmAudioRecording: recording.confirm,
    onResolveAssetCopy: assetCopy.resolve,
    onPreviewMove: hoverPreview.move,
    onPreviewEnd: hoverPreview.clear,
    onSelectNode: nodeCommands.select,
    onToggleNodeVisibility: nodeCommands.toggleVisibility,
    onToggleNodeLock: nodeCommands.toggleLock,
    onToggleNodePlayback: nodeCommands.togglePlayback,
    onRenameNode: nodeCommands.rename,
    onDeleteNode: nodeCommands.delete,
    onRefreshMainComp: nodeCommands.refresh,
    onDeleteMainComp: nodeCommands.deleteSource,
    onBeginMainDrag: drag.begin,
    onDragOverMain: drag.dragOver,
    onDropMain: drag.drop,
    onEndMainDrag: drag.end,
    onMoveNodeKeyboard: drag.moveKeyboard,
    onCancelImport: psdImport.cancel,
    onConfirmImport: () => {
      void psdImport.confirm();
    },
    onMoveImportNode: psdImport.moveNode,
    onScaleImport: psdImport.scale,
    onRenameImportNode: psdImport.rename,
    onRemoveImportNode: psdImport.remove,
    onDismissRefreshSummary: psdImport.dismissSummary,
  };

  return { viewProps, importFiles: psdImport.importFiles };
}
