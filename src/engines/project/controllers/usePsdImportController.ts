import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  Composition,
  CompositionMeta,
  PropertyTrackState,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { PsdImportSource, StoredPsdSource } from "@/engines/project/models/psdSourceRuntimeModel";
import type { PsdImportPlan } from "@/engines/project/models/psdImportPlanModel";
import type { TimelineSelection } from "@/models";
import type { ProjectCommandPort } from "@/engines/project/models/projectCommandModel";
import { findCompositionById } from "@/engines/project/helpers/projectModelHelpers";
import {
  buildRootComps,
  importPreparedPsdPlanIntoProject,
  rebuildMasterTimelineItems,
  resolveTimelineSelection,
} from "@/engines/project/helpers/psd/psdImportProjectHelpers";
import { preparePsdImportSource } from "@/engines/project/import/psdImportAnalyzer";
import { createPreparedPsdImportStore } from "@/engines/project/state/preparedPsdImportStore";

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
  const preparedStoreRef = useRef(createPreparedPsdImportStore());
  const tokenSequenceRef = useRef(0);

  useEffect(() => {
    const store = preparedStoreRef.current;
    return () => store.clear();
  }, []);
  const getRootComps = useCallback(
    (sceneComps: Composition[]) =>
      buildRootComps(sceneComps, masterEnabledProperties, {
        masterCompId,
        masterWidth,
        masterHeight,
      }),
    [masterCompId, masterEnabledProperties, masterHeight, masterWidth]
  );

  const applyImportedProject = useCallback(
    (importedProject: ReturnType<typeof importPreparedPsdPlanIntoProject>) => {
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
      getRootComps,
      lastSelectedItemByCompId,
      masterCompId,
      projectCommands,
      registerSource,
      removeSource,
      selectedCompId,
      setImportError,
      setImportNotice,
      setNextImportIndex,
      setSelectedCompId,
    ]
  );

  const preparePsdImport = useCallback(
    async (importSources: PsdImportSource[]): Promise<PsdImportPlan> => {
      const sources = importSources
        .filter((source) => source.file.name.toLowerCase().endsWith(".psd"))
        .sort((a, b) =>
          a.file.name.localeCompare(b.file.name, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );
      const entries: PsdImportPlan["entries"] = [];
      const failedFiles: string[] = [];

      for (const source of sources) {
        try {
          tokenSequenceRef.current += 1;
          const token = `psd-import-${Date.now()}-${tokenSequenceRef.current}`;
          const result = await preparePsdImportSource(source, token);
          preparedStoreRef.current.register(result.prepared);
          entries.push(result.planEntry);
        } catch (error) {
          console.error("PSD PREPARE ERROR:", source.file.name, error);
          failedFiles.push(source.file.name);
        }
      }

      setImportError(
        failedFiles.length > 0
          ? `분석하지 못한 PSD: ${failedFiles.join(", ")}`
          : null
      );
      setImportNotice(null);
      return { entries };
    },
    [setImportError, setImportNotice]
  );

  const cancelPsdImport = useCallback((plan: PsdImportPlan) => {
    preparedStoreRef.current.discard(plan.entries.map((entry) => entry.token));
  }, []);

  const confirmPsdImport = useCallback(
    async (plan: PsdImportPlan) => {
      const importedProject = importPreparedPsdPlanIntoProject(
        plan,
        preparedStoreRef.current,
        { comps, metaByCompId, timelineItemsByCompId, renderItemsByCompId, nextImportIndex }
      );
      try {
        if (importedProject.importedSources.length > 0) {
          applyImportedProject(importedProject);
        } else if (importedProject.failedFiles.length > 0) {
          setImportError(`불러오지 못한 PSD: ${importedProject.failedFiles.join(", ")}`);
        }
      } finally {
        cancelPsdImport(plan);
      }
      return {
        importedCount: importedProject.importedSources.length,
        failedFiles: importedProject.failedFiles,
      };
    },
    [
      applyImportedProject,
      cancelPsdImport,
      comps,
      metaByCompId,
      nextImportIndex,
      renderItemsByCompId,
      setImportError,
      timelineItemsByCompId,
    ]
  );

  return { preparePsdImport, confirmPsdImport, cancelPsdImport };
}
