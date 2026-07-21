import { useCallback, useMemo } from "react";
import { usePsdPickerController } from "@/engines/psd-tree/controllers/usePsdPickerController";
import { usePsdImportDialogController } from "@/engines/psd-tree/controllers/usePsdImportDialogController";
import { useSourceActionController } from "@/engines/psd-tree/controllers/useSourceActionController";
import { useTreeReorderController } from "@/engines/psd-tree/controllers/useTreeReorderController";
import { useTreeSelectionController } from "@/engines/psd-tree/controllers/useTreeSelectionController";
import {
  buildPsdRefreshSummaryViewModel,
  buildPsdTreeViewModel,
} from "@/engines/psd-tree/helpers/psdTreeViewModelHelpers";
import type {
  PsdTreeProjectCommandPort,
  PsdTreeProjectReadPort,
  PsdTreeSelectionPort,
  PsdTreeViewProps,
} from "@/engines/psd-tree/models/psdTreeModel";
import { usePsdTreeState } from "@/engines/psd-tree/state/usePsdTreeState";

type UsePsdTreeEngineOptions = {
  project: PsdTreeProjectReadPort & PsdTreeProjectCommandPort;
  selection: PsdTreeSelectionPort;
};

export function usePsdTreeEngine({ project, selection }: UsePsdTreeEngineOptions) {
  const state = usePsdTreeState();
  const { setRefreshSummary } = state;
  const selectionPort = useMemo(
    () => ({ selectComposition: selection.selectComposition }),
    [selection.selectComposition]
  );
  const projectPort = useMemo(
    () => ({
      preparePsdImport: project.preparePsdImport,
      confirmPsdImport: project.confirmPsdImport,
      cancelPsdImport: project.cancelPsdImport,
      refreshMainComposition: project.refreshMainComposition,
      removeMainComposition: project.removeMainComposition,
      reorderMainCompositions: project.reorderMainCompositions,
    }),
    [
      project.cancelPsdImport,
      project.confirmPsdImport,
      project.preparePsdImport,
      project.refreshMainComposition,
      project.removeMainComposition,
      project.reorderMainCompositions,
    ]
  );
  const selectionController = useTreeSelectionController(selectionPort);
  const sourceActions = useSourceActionController({ ...projectPort, state });
  const importDialog = usePsdImportDialogController({ project: projectPort, state });
  const picker = usePsdPickerController({
    preparePsdSources: importDialog.prepare,
    refreshWithSource: sourceActions.refreshWithSource,
    state,
  });
  const { selectNode } = selectionController;
  const { requestRefresh: requestSourceRefresh, removeMain } = sourceActions;
  const { cancel: cancelImport, confirm: confirmImport, moveNode: moveImportNode } = importDialog;
  const { importFromPicker, refreshFromPicker, handleFileInputChange } = picker;
  const mainCompositionIds = useMemo(
    () =>
      project.rootCompositions
        .filter((composition) => composition.type === "main")
        .map((composition) => composition.id),
    [project.rootCompositions]
  );
  const reorder = useTreeReorderController({
    mainCompositionIds,
    reorderMainCompositions: projectPort.reorderMainCompositions,
    state,
  });
  const nodes = useMemo(
    () => buildPsdTreeViewModel(project.rootCompositions, project.selectedCompId),
    [project.rootCompositions, project.selectedCompId]
  );
  const refreshSummary = useMemo(
    () => state.refreshSummary
      ? buildPsdRefreshSummaryViewModel(state.refreshSummary)
      : null,
    [state.refreshSummary]
  );

  const requestRefresh = useCallback(
    async (compId: string) => {
      const result = await requestSourceRefresh(compId);
      if (result === "needsSource") await refreshFromPicker(compId);
    },
    [refreshFromPicker, requestSourceRefresh]
  );
  const dismissRefreshSummary = useCallback(
    () => setRefreshSummary(null),
    [setRefreshSummary]
  );

  const onImportClick = useCallback(() => void importFromPicker(), [importFromPicker]);
  const onRefreshMainComp = useCallback((compId: string) => void requestRefresh(compId), [requestRefresh]);
  const onConfirmImport = useCallback(() => void confirmImport(), [confirmImport]);
  const viewProps: PsdTreeViewProps = useMemo(() => ({
    nodes,
    fileInputRef: state.fileInputRef,
    draggedMainCompId: state.draggedMainCompId,
    dropTarget: state.dropTarget,
    importPlan: state.importPlan,
    importPreviewStatus: state.importPreviewStatus,
    importPreviewError: state.importPreviewError,
    refreshSummary,
    onImportClick,
    onFileInputChange: handleFileInputChange,
    onSelectNode: selectNode,
    onRefreshMainComp,
    onDeleteMainComp: removeMain,
    onBeginMainDrag: reorder.beginDrag,
    onDragOverMain: reorder.dragOver,
    onDropMain: reorder.drop,
    onEndMainDrag: reorder.endDrag,
    onCancelImport: cancelImport,
    onConfirmImport,
    onMoveImportNode: moveImportNode,
    onDismissRefreshSummary: dismissRefreshSummary,
  }), [
    dismissRefreshSummary,
    cancelImport,
    handleFileInputChange,
    moveImportNode,
    nodes,
    onConfirmImport,
    onImportClick,
    onRefreshMainComp,
    refreshSummary,
    reorder.beginDrag,
    reorder.dragOver,
    reorder.drop,
    reorder.endDrag,
    removeMain,
    selectNode,
    state.draggedMainCompId,
    state.dropTarget,
    state.fileInputRef,
    state.importPlan,
    state.importPreviewError,
    state.importPreviewStatus,
  ]);

  return { viewProps };
}
