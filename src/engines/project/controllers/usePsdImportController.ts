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
import { findCompositionById } from "@/engines/project/helpers/projectModelHelpers";
import {
  buildRootComps,
  importPsdSourcesIntoProject,
  rebuildMasterTimelineItems,
  resolveTimelineSelection,
} from "@/engines/project/helpers/psd/psdImportProjectHelpers";

type UsePsdImportControllerOptions = {
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
  registerSource: (compId: string, source: StoredPsdSource) => void;
  removeSource: (compId: string) => void;
};

export function usePsdImportController({
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
  registerSource,
  removeSource,
}: UsePsdImportControllerOptions) {
  const getRootComps = useCallback(
    (sceneComps: Composition[]) =>
      buildRootComps(sceneComps, masterEnabledProperties, {
        masterCompId,
        masterWidth,
        masterHeight,
      }),
    [masterCompId, masterEnabledProperties, masterHeight, masterWidth]
  );

  const importPsdFiles = useCallback(
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
          if (replacedCompId) removeSource(replacedCompId);
          registerSource(compId, { fileName, fileHandle });
        }
      );
      projectCommands.replaceProjectRecords({
        comps: importedProject.comps,
        metaByCompId: importedProject.metaByCompId,
        timelineItemsByCompId: nextTimeline,
        renderItemsByCompId: importedProject.renderItemsByCompId,
      });

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
      clearAllCompositionHistories,
      comps,
      getRootComps,
      lastSelectedItemByCompId,
      masterCompId,
      metaByCompId,
      nextImportIndex,
      projectCommands,
      registerSource,
      removeSource,
      renderItemsByCompId,
      selectedCompId,
      setImportError,
      setImportNotice,
      setNextImportIndex,
      setSelectedCompId,
      timelineItemsByCompId,
    ]
  );

  return { importPsdFiles };
}
