import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  acknowledgeTimelineSourceStatus,
  deleteTimelineSourceFromProject,
  markTimelineSourceMissing,
  mergeRefreshedMainCompIntoProject,
} from "@/editor/actions/psdRefreshHelpers";
import type {
  PsdImportSource,
  StoredPsdSource,
} from "@/editor/types/psdSourceTypes";
import type {
  Composition,
  CompositionMeta,
  PropertyTrackState,
  RenderItem,
  TimelineItem,
} from "@/editor/types/types";
import type { TimelineSelection } from "@/editor/types/editorViewTypes";
import { loadPsd } from "@/editor/import/psdLoader";
import {
  findCompositionById,
  removeCompDataFromRecord,
  reorderItemsWithPosition,
} from "@/editor/models/projectModelHelpers";
import {
  buildRootComps,
  importPsdSourcesIntoProject,
  rebuildMasterTimelineItems,
  resolveTimelineSelection,
} from "@/editor/actions/projectActionHelpers";

type UseProjectActionsOptions = {
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
  nextImportIndex: number;
  psdSourceEntriesRef: MutableRefObject<Record<string, StoredPsdSource>>;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMetaByCompId: Dispatch<SetStateAction<Record<string, CompositionMeta>>>;
  setTimelineItemsByCompId: Dispatch<SetStateAction<Record<string, TimelineItem[]>>>;
  setRenderItemsByCompId: Dispatch<SetStateAction<Record<string, RenderItem[]>>>;
  setSelectedCompId: Dispatch<SetStateAction<string>>;
  setNextImportIndex: Dispatch<SetStateAction<number>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
  setImportNotice: Dispatch<SetStateAction<string | null>>;
  pushCompositionHistorySnapshot: (compId: string) => void;
  clearAllCompositionHistories: () => void;
  applySelectionForComposition: (
    compId: string,
    nextSelection: TimelineSelection
  ) => void;
};

export function useProjectActions({
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
  nextImportIndex,
  psdSourceEntriesRef,
  setComps,
  setMetaByCompId,
  setTimelineItemsByCompId,
  setRenderItemsByCompId,
  setSelectedCompId,
  setNextImportIndex,
  setImportError,
  setImportNotice,
  pushCompositionHistorySnapshot,
  clearAllCompositionHistories,
  applySelectionForComposition,
}: UseProjectActionsOptions) {
  const getRootComps = useCallback(
    (sceneComps: Composition[]) =>
      buildRootComps(sceneComps, masterEnabledProperties, {
        masterCompId,
        masterWidth,
        masterHeight,
      }),
    [masterCompId, masterEnabledProperties, masterHeight, masterWidth]
  );

  const enterComposition = useCallback(
    (compId: string) => {
      const nextSelection = resolveTimelineSelection(
        compId,
        comps,
        timelineItemsByCompId,
        metaByCompId,
        lastSelectedItemByCompId,
        masterCompId
      );

      setSelectedCompId(compId);
      applySelectionForComposition(compId, nextSelection);
    },
    [
      applySelectionForComposition,
      comps,
      lastSelectedItemByCompId,
      masterCompId,
      metaByCompId,
      setSelectedCompId,
      timelineItemsByCompId,
    ]
  );

  const handleImportPsdFiles = useCallback(
    async (importSources: PsdImportSource[]) => {
      const importedProject = await importPsdSourcesIntoProject(importSources, {
        comps,
        metaByCompId,
        timelineItemsByCompId,
        renderItemsByCompId,
        nextImportIndex,
      });
      const nextTimeline = rebuildMasterTimelineItems(
        importedProject.comps,
        importedProject.timelineItemsByCompId,
        importedProject.metaByCompId,
        masterCompId
      );

      clearAllCompositionHistories();

      importedProject.importedSources.forEach(
        ({ compId, fileName, fileHandle, replacedCompId }) => {
        if (replacedCompId) {
          delete psdSourceEntriesRef.current[replacedCompId];
        }

        psdSourceEntriesRef.current[compId] = {
          fileName,
          fileHandle,
        };
        }
      );

      setComps(importedProject.comps);
      setMetaByCompId(importedProject.metaByCompId);
      setTimelineItemsByCompId(nextTimeline);
      setRenderItemsByCompId(importedProject.renderItemsByCompId);

      const nextRoot = getRootComps(importedProject.comps);
      const nextSelectedCompId =
        findCompositionById(nextRoot, selectedCompId)?.id ??
        importedProject.comps.at(-1)?.id ??
        masterCompId;
      const nextSelection = resolveTimelineSelection(
        nextSelectedCompId,
        importedProject.comps,
        nextTimeline,
        importedProject.metaByCompId,
        lastSelectedItemByCompId,
        masterCompId
      );

      setSelectedCompId(nextSelectedCompId);
      applySelectionForComposition(nextSelectedCompId, nextSelection);
      setNextImportIndex(importedProject.nextImportIndex);
      setImportError(
        importedProject.failedFiles.length > 0
          ? `불러오지 못한 PSD: ${importedProject.failedFiles.join(", ")}`
          : null
      );
      setImportNotice(
        importedProject.replacedFiles.length > 0
          ? `같은 이름의 PSD를 다시 불러와 교체했습니다: ${importedProject.replacedFiles.join(", ")}`
          : null
      );
    },
    [
      applySelectionForComposition,
      comps,
      clearAllCompositionHistories,
      getRootComps,
      lastSelectedItemByCompId,
      masterCompId,
      metaByCompId,
      nextImportIndex,
      renderItemsByCompId,
      selectedCompId,
      psdSourceEntriesRef,
      setComps,
      setImportError,
      setImportNotice,
      setMetaByCompId,
      setNextImportIndex,
      setRenderItemsByCompId,
      setSelectedCompId,
      setTimelineItemsByCompId,
      timelineItemsByCompId,
    ]
  );

  const resolveLatestPsdSource = useCallback(
    async (
      compId: string,
      overrideSource?: PsdImportSource | null
    ): Promise<PsdImportSource | null> => {
      if (overrideSource) {
        return overrideSource;
      }

      const storedSource = psdSourceEntriesRef.current[compId];

      if (!storedSource?.fileHandle) {
        return null;
      }

      try {
        return {
          file: await storedSource.fileHandle.getFile(),
          fileHandle: storedSource.fileHandle,
        };
      } catch (error) {
        console.error("PSD SOURCE HANDLE READ ERROR:", storedSource.fileName, error);
        return null;
      }
    },
    [psdSourceEntriesRef]
  );

  const handleRefreshMainComp = useCallback(
    async (
      compId: string,
      overrideSource?: PsdImportSource | null
    ): Promise<"completed" | "needsSource"> => {
      const existingMainComp = comps.find(
        (comp) => comp.id === compId && comp.type === "main"
      );
      const sourceToRead = await resolveLatestPsdSource(compId, overrideSource);

      if (!existingMainComp) {
        setImportError("새로고침할 PSD 소스를 찾을 수 없습니다.");
        setImportNotice(null);
        return "completed";
      }

      if (!sourceToRead) {
        setImportError(null);
        setImportNotice(`${existingMainComp.name} PSD를 다시 선택해 주세요.`);
        return "needsSource";
      }

      try {
        const refreshedDocument = await loadPsd(sourceToRead.file, nextImportIndex);
        const mergedProject = mergeRefreshedMainCompIntoProject(
          {
            comps,
            metaByCompId,
            timelineItemsByCompId,
            renderItemsByCompId,
          },
          existingMainComp,
          refreshedDocument
        );
        const nextTimeline = rebuildMasterTimelineItems(
          mergedProject.comps,
          mergedProject.timelineItemsByCompId,
          mergedProject.metaByCompId,
          masterCompId
        );
        const nextRoot = getRootComps(mergedProject.comps);
        const nextSelectedCompId =
          findCompositionById(nextRoot, selectedCompId)?.id ??
          existingMainComp.id ??
          masterCompId;
        const nextSelection = resolveTimelineSelection(
          nextSelectedCompId,
          mergedProject.comps,
          nextTimeline,
          mergedProject.metaByCompId,
          lastSelectedItemByCompId,
          masterCompId
        );
        const noticeParts: string[] = [];

        if (mergedProject.counts.updated > 0) {
          noticeParts.push(`updated ${mergedProject.counts.updated}`);
        }

        if (mergedProject.counts.added > 0) {
          noticeParts.push(`new ${mergedProject.counts.added}`);
        }

        if (mergedProject.counts.deletePending > 0) {
          noticeParts.push(`delete? ${mergedProject.counts.deletePending}`);
        }

        clearAllCompositionHistories();

        setComps(mergedProject.comps);
        setMetaByCompId(mergedProject.metaByCompId);
        setTimelineItemsByCompId(nextTimeline);
        setRenderItemsByCompId(mergedProject.renderItemsByCompId);
        setSelectedCompId(nextSelectedCompId);
        applySelectionForComposition(nextSelectedCompId, nextSelection);
        setNextImportIndex((prev) => prev + 1);
        psdSourceEntriesRef.current[compId] = {
          fileName: sourceToRead.file.name,
          fileHandle: sourceToRead.fileHandle,
        };
        setImportError(null);
        setImportNotice(
          noticeParts.length > 0
            ? `${existingMainComp.name} 새로고침: ${noticeParts.join(", ")}`
            : `${existingMainComp.name} 변경 사항이 없습니다.`
        );
        return "completed";
      } catch (error) {
        console.error("PSD REFRESH ERROR:", sourceToRead.file.name, error);
        setImportError(`PSD 새로고침 실패: ${sourceToRead.file.name}`);
        setImportNotice(null);
        return "completed";
      }
    },
    [
      applySelectionForComposition,
      clearAllCompositionHistories,
      comps,
      getRootComps,
      lastSelectedItemByCompId,
      masterCompId,
      metaByCompId,
      nextImportIndex,
      psdSourceEntriesRef,
      renderItemsByCompId,
      resolveLatestPsdSource,
      selectedCompId,
      setComps,
      setImportError,
      setImportNotice,
      setMetaByCompId,
      setNextImportIndex,
      setRenderItemsByCompId,
      setSelectedCompId,
      setTimelineItemsByCompId,
      timelineItemsByCompId,
    ]
  );

  const handleDeleteMainComp = useCallback(
    (compId: string) => {
      const compToDelete = comps.find((comp) => comp.id === compId);

      if (!compToDelete) {
        return;
      }

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
      delete psdSourceEntriesRef.current[compId];

      setComps(nextComps);
      setMetaByCompId(nextMeta);
      setTimelineItemsByCompId(nextTimeline);
      setRenderItemsByCompId(nextRender);
      setSelectedCompId(nextSelectedCompId);
      applySelectionForComposition(nextSelectedCompId, nextSelection);
    },
    [
      applySelectionForComposition,
      comps,
      clearAllCompositionHistories,
      getRootComps,
      lastSelectedItemByCompId,
      masterCompId,
      metaByCompId,
      psdSourceEntriesRef,
      renderItemsByCompId,
      selectedCompId,
      setComps,
      setMetaByCompId,
      setRenderItemsByCompId,
      setSelectedCompId,
      setTimelineItemsByCompId,
      timelineItemsByCompId,
    ]
  );

  const handleAcknowledgeTimelineSourceStatus = useCallback(
    (item: TimelineItem) => {
      setComps(acknowledgeTimelineSourceStatus(comps, item));
    },
    [comps, setComps]
  );

  const handleResolveTimelineSourceDelete = useCallback(
    (item: TimelineItem, decision: "delete" | "keep") => {
      if (decision === "keep") {
        pushCompositionHistorySnapshot(item.compId);
        setComps(markTimelineSourceMissing(comps, item));
        return;
      }

      pushCompositionHistorySnapshot(item.compId);

      const nextProject = deleteTimelineSourceFromProject(
        {
          comps,
          metaByCompId,
          timelineItemsByCompId,
          renderItemsByCompId,
        },
        item
      );
      const nextTimeline =
        item.compId === masterCompId
          ? rebuildMasterTimelineItems(
              nextProject.comps,
              nextProject.timelineItemsByCompId,
              nextProject.metaByCompId,
              masterCompId
            )
          : nextProject.timelineItemsByCompId;
      const nextRoot = getRootComps(nextProject.comps);
      const nextSelectedCompId =
        findCompositionById(nextRoot, selectedCompId)?.id ?? masterCompId;
      const nextSelection = resolveTimelineSelection(
        nextSelectedCompId,
        nextProject.comps,
        nextTimeline,
        nextProject.metaByCompId,
        lastSelectedItemByCompId,
        masterCompId
      );

      setComps(nextProject.comps);
      setMetaByCompId(nextProject.metaByCompId);
      setTimelineItemsByCompId(nextTimeline);
      setRenderItemsByCompId(nextProject.renderItemsByCompId);
      setSelectedCompId(nextSelectedCompId);
      applySelectionForComposition(nextSelectedCompId, nextSelection);
    },
    [
      applySelectionForComposition,
      comps,
      getRootComps,
      lastSelectedItemByCompId,
      masterCompId,
      metaByCompId,
      pushCompositionHistorySnapshot,
      renderItemsByCompId,
      selectedCompId,
      setComps,
      setMetaByCompId,
      setRenderItemsByCompId,
      setSelectedCompId,
      setTimelineItemsByCompId,
      timelineItemsByCompId,
    ]
  );

  const handleReorderMainComps = useCallback(
    (draggedId: string, targetId: string, position: "before" | "after") => {
      const reorderedComps = reorderItemsWithPosition(comps, draggedId, targetId, position);

      if (reorderedComps === comps) {
        return;
      }

      clearAllCompositionHistories();

      setComps(reorderedComps);
      setTimelineItemsByCompId((prev) =>
        rebuildMasterTimelineItems(reorderedComps, prev, metaByCompId, masterCompId)
      );

      const nextSelectedCompId =
        findCompositionById(getRootComps(reorderedComps), selectedCompId)?.id ?? masterCompId;
      setSelectedCompId(nextSelectedCompId);
      applySelectionForComposition(nextSelectedCompId, null);
    },
    [
      applySelectionForComposition,
      comps,
      clearAllCompositionHistories,
      getRootComps,
      masterCompId,
      metaByCompId,
      selectedCompId,
      setComps,
      setSelectedCompId,
      setTimelineItemsByCompId,
    ]
  );

  return {
    enterComposition,
    handleImportPsdFiles,
    handleRefreshMainComp,
    handleDeleteMainComp,
    handleReorderMainComps,
    handleAcknowledgeTimelineSourceStatus,
    handleResolveTimelineSourceDelete,
  };
}
