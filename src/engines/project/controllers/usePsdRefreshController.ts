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
import { normalizePsdImportSettings } from "@/engines/project/import/psdImportSettingsHelpers";
import type { PsdRefreshCommandResult } from "@/engines/project/models/psdRefreshResultModel";
import { createPsdRefreshSummary } from "@/engines/project/helpers/psd/psdSourceStatusHelpers";

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
    ): Promise<PsdRefreshCommandResult> => {
      const existingMainComp = comps.find(
        (comp) => comp.id === compId && comp.type === "main"
      );
      const sourceToRead = await resolveLatestSource(compId, overrideSource);

      if (!existingMainComp) {
        setImportError("새로고침할 PSD 소스를 찾을 수 없습니다.");
        setImportNotice(null);
        return { status: "completed", summary: null };
      }
      if (!sourceToRead) {
        setImportError(null);
        setImportNotice(`${existingMainComp.name} PSD를 다시 선택해 주세요.`);
        return { status: "needsSource", summary: null };
      }

      try {
        const importSettings = normalizePsdImportSettings(
          existingMainComp.importSettings,
          existingMainComp.name
        );
        const refreshedDocument = await loadPsd(
          sourceToRead.file,
          nextImportIndex,
          importSettings
        );
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
        setImportNotice(null);
        return {
          status: "completed",
          summary: createPsdRefreshSummary(
            existingMainComp.id,
            existingMainComp.name,
            mergedProject.counts
          ),
        };
      } catch (error) {
        console.error("PSD REFRESH ERROR:", sourceToRead.file.name, error);
        setImportError(`PSD 새로고침 실패: ${sourceToRead.file.name}`);
        setImportNotice(null);
        return { status: "completed", summary: null };
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
