import { useCallback, type Dispatch, type SetStateAction } from "react";
import type {
  Composition,
  CompositionMeta,
  PropertyTrackState,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { TimelineSelection } from "@/models";
import type { ProjectCommandPort } from "@/engines/project/models/projectCommandModel";
import {
  buildRootComps,
  rebuildMasterTimelineItems,
  resolveTimelineSelection,
} from "@/engines/project/helpers/psd/psdImportProjectHelpers";
import {
  findCompositionById,
  removeCompDataFromRecord,
  reorderItemsWithPosition,
} from "@/engines/project/helpers/projectModelHelpers";

type UsePsdLibraryControllerOptions = {
  masterCompId: string;
  masterWidth: number;
  masterHeight: number;
  comps: Composition[];
  metaByCompId: Record<string, CompositionMeta>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  renderItemsByCompId: Record<string, RenderItem[]>;
  masterEnabledProperties: PropertyTrackState;
  selectedCompId: string;
  lastSelectedItemByCompId: Record<string, NonNullable<TimelineSelection>>;
  projectCommands: ProjectCommandPort;
  setSelectedCompId: Dispatch<SetStateAction<string>>;
  clearAllCompositionHistories: () => void;
  applySelectionForComposition: (
    compId: string,
    nextSelection: TimelineSelection
  ) => void;
  removeSource: (compId: string) => void;
};

export function usePsdLibraryController({
  masterCompId,
  masterWidth,
  masterHeight,
  comps,
  metaByCompId,
  timelineItemsByCompId,
  renderItemsByCompId,
  masterEnabledProperties,
  selectedCompId,
  lastSelectedItemByCompId,
  projectCommands,
  setSelectedCompId,
  clearAllCompositionHistories,
  applySelectionForComposition,
  removeSource,
}: UsePsdLibraryControllerOptions) {
  const getRootComps = useCallback(
    (sceneComps: Composition[]) =>
      buildRootComps(sceneComps, masterEnabledProperties, {
        masterCompId,
        masterWidth,
        masterHeight,
      }),
    [masterCompId, masterEnabledProperties, masterHeight, masterWidth]
  );

  const deleteMainComp = useCallback(
    (compId: string) => {
      const compToDelete = comps.find((comp) => comp.id === compId);
      if (!compToDelete) return;

      const nextComps = comps.filter((comp) => comp.id !== compId);
      const nextMeta = removeCompDataFromRecord(metaByCompId, compToDelete);
      const nextTimeline = rebuildMasterTimelineItems(
        nextComps,
        removeCompDataFromRecord(timelineItemsByCompId, compToDelete),
        nextMeta,
        masterCompId
      );
      const nextRender = removeCompDataFromRecord(renderItemsByCompId, compToDelete);
      const nextRoot = getRootComps(nextComps);
      const previousSelection = findCompositionById(getRootComps(comps), selectedCompId);
      const nextSelectedCompId =
        previousSelection &&
        (previousSelection.id === compToDelete.id ||
          previousSelection.parentId === compToDelete.id)
          ? masterCompId
          : findCompositionById(nextRoot, selectedCompId)?.id ?? masterCompId;
      const nextSelection = resolveTimelineSelection(
        nextSelectedCompId,
        nextComps,
        nextTimeline,
        nextMeta,
        lastSelectedItemByCompId,
        masterCompId
      );

      clearAllCompositionHistories();
      removeSource(compId);
      projectCommands.replaceProjectRecords({
        comps: nextComps,
        metaByCompId: nextMeta,
        timelineItemsByCompId: nextTimeline,
        renderItemsByCompId: nextRender,
      });
      setSelectedCompId(nextSelectedCompId);
      applySelectionForComposition(nextSelectedCompId, nextSelection);
    },
    [
      applySelectionForComposition,
      clearAllCompositionHistories,
      comps,
      getRootComps,
      lastSelectedItemByCompId,
      masterCompId,
      metaByCompId,
      projectCommands,
      removeSource,
      renderItemsByCompId,
      selectedCompId,
      setSelectedCompId,
      timelineItemsByCompId,
    ]
  );

  const reorderMainComps = useCallback(
    (draggedId: string, targetId: string, position: "before" | "after") => {
      const reorderedComps = reorderItemsWithPosition(
        comps,
        draggedId,
        targetId,
        position
      );
      if (reorderedComps === comps) return;

      clearAllCompositionHistories();
      projectCommands.replaceCompositions(reorderedComps);
      projectCommands.updateTimelineItems((current) =>
        rebuildMasterTimelineItems(reorderedComps, current, metaByCompId, masterCompId)
      );
      const nextSelectedCompId =
        findCompositionById(getRootComps(reorderedComps), selectedCompId)?.id ??
        masterCompId;
      setSelectedCompId(nextSelectedCompId);
      applySelectionForComposition(nextSelectedCompId, null);
    },
    [
      applySelectionForComposition,
      clearAllCompositionHistories,
      comps,
      getRootComps,
      masterCompId,
      metaByCompId,
      projectCommands,
      selectedCompId,
      setSelectedCompId,
    ]
  );

  return { deleteMainComp, reorderMainComps };
}
