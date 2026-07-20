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
  const selectionController = useTreeSelectionController(selection);
  const sourceActions = useSourceActionController({ ...project, state });
  const importDialog = usePsdImportDialogController({ project, state });
  const picker = usePsdPickerController({
    preparePsdSources: importDialog.prepare,
    refreshWithSource: sourceActions.refreshWithSource,
    state,
  });
  const mainCompositionIds = useMemo(
    () =>
      project.rootCompositions
        .filter((composition) => composition.type === "main")
        .map((composition) => composition.id),
    [project.rootCompositions]
  );
  const reorder = useTreeReorderController({
    mainCompositionIds,
    reorderMainCompositions: project.reorderMainCompositions,
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
      const result = await sourceActions.requestRefresh(compId);
      if (result === "needsSource") await picker.refreshFromPicker(compId);
    },
    [picker, sourceActions]
  );
  const dismissRefreshSummary = useCallback(
    () => setRefreshSummary(null),
    [setRefreshSummary]
  );

  const viewProps: PsdTreeViewProps = {
    nodes,
    fileInputRef: state.fileInputRef,
    draggedMainCompId: state.draggedMainCompId,
    dropTarget: state.dropTarget,
    importPlan: state.importPlan,
    importPreviewStatus: state.importPreviewStatus,
    importPreviewError: state.importPreviewError,
    refreshSummary,
    onImportClick: () => void picker.importFromPicker(),
    onFileInputChange: picker.handleFileInputChange,
    onSelectNode: selectionController.selectNode,
    onRefreshMainComp: (compId) => void requestRefresh(compId),
    onDeleteMainComp: sourceActions.removeMain,
    onBeginMainDrag: reorder.beginDrag,
    onDragOverMain: reorder.dragOver,
    onDropMain: reorder.drop,
    onEndMainDrag: reorder.endDrag,
    onCancelImport: importDialog.cancel,
    onConfirmImport: () => void importDialog.confirm(),
    onMoveImportNode: importDialog.moveNode,
    onDismissRefreshSummary: dismissRefreshSummary,
  };

  return { viewProps };
}
