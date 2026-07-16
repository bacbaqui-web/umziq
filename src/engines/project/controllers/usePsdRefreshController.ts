import { useCallback, type Dispatch, type SetStateAction } from "react";
import type {
  Composition,
  CompositionMeta,
  PropertyTrackState,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { PsdImportSource, StoredPsdSource } from "@/engines/project/models/psdSourceRuntimeModel";
import type { TimelineSelection } from "@/models";
import type { ProjectCommandPort } from "@/engines/project/models/projectCommandModel";
import { loadPsd } from "@/engines/project/import/psdLoader";
import { mergeRefreshedMainCompIntoProject } from "@/engines/project/helpers/psd/psdCompositionMergeHelpers";
import {
  buildRootComps,
  rebuildMasterTimelineItems,
  resolveTimelineSelection,
} from "@/engines/project/helpers/psd/psdImportProjectHelpers";
import { findCompositionById } from "@/engines/project/helpers/projectModelHelpers";

type UsePsdRefreshControllerOptions = {
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
  projectCommands: ProjectCommandPort;
  setSelectedCompId: Dispatch<SetStateAction<string>>;
  setNextImportIndex: Dispatch<SetStateAction<number>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
  setImportNotice: Dispatch<SetStateAction<string | null>>;
  clearAllCompositionHistories: () => void;
  applySelectionForComposition: (
    compId: string,
    nextSelection: TimelineSelection
  ) => void;
  resolveLatestSource: (
    compId: string,
    overrideSource?: PsdImportSource | null
  ) => Promise<PsdImportSource | null>;
  registerSource: (compId: string, source: StoredPsdSource) => void;
};

export function usePsdRefreshController({
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
  projectCommands,
  setSelectedCompId,
  setNextImportIndex,
  setImportError,
  setImportNotice,
  clearAllCompositionHistories,
  applySelectionForComposition,
  resolveLatestSource,
  registerSource,
}: UsePsdRefreshControllerOptions) {
  const getRootComps = useCallback(
    (sceneComps: Composition[]) =>
      buildRootComps(sceneComps, masterEnabledProperties, {
        masterCompId,
        masterWidth,
        masterHeight,
      }),
    [masterCompId, masterEnabledProperties, masterHeight, masterWidth]
  );

  const refreshMainComp = useCallback(
    async (
      compId: string,
      overrideSource?: PsdImportSource | null
    ): Promise<"completed" | "needsSource"> => {
      const existingMainComp = comps.find(
        (comp) => comp.id === compId && comp.type === "main"
      );
      const sourceToRead = await resolveLatestSource(compId, overrideSource);

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
          { comps, metaByCompId, timelineItemsByCompId, renderItemsByCompId },
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
        projectCommands.replaceProjectRecords({
          comps: mergedProject.comps,
          metaByCompId: mergedProject.metaByCompId,
          timelineItemsByCompId: nextTimeline,
          renderItemsByCompId: mergedProject.renderItemsByCompId,
        });
        setSelectedCompId(nextSelectedCompId);
        applySelectionForComposition(nextSelectedCompId, nextSelection);
        setNextImportIndex((current) => current + 1);
        registerSource(compId, {
          fileName: sourceToRead.file.name,
          fileHandle: sourceToRead.fileHandle,
        });
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
      projectCommands,
      registerSource,
      renderItemsByCompId,
      resolveLatestSource,
      selectedCompId,
      setImportError,
      setImportNotice,
      setNextImportIndex,
      setSelectedCompId,
      timelineItemsByCompId,
    ]
  );

  return { refreshMainComp };
}
