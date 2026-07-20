import { loadPsd } from "@/engines/project/import/psdLoader";
import { parsePsdToComposition } from "@/engines/project/import/psdCompositionBuilder";
import type {
  PsdImportPlan,
  PreparedPsdImportStore,
} from "@/engines/project/models/psdImportPlanModel";
import type { PsdImportSource } from "@/engines/project/models/psdSourceRuntimeModel";
import type {
  Composition,
  CompositionMeta,
  PropertyTrackState,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { TimelineSelection } from "@/models";
import {
  buildMasterComposition,
  buildMasterTimelineItems,
  removeCompDataFromRecord,
  resolveTimelineSelectionForComposition,
} from "@/engines/project/helpers/projectModelHelpers";

type MasterProjectOptions = {
  masterCompId: string;
  masterWidth: number;
  masterHeight: number;
};

type ProjectImportState = {
  comps: Composition[];
  metaByCompId: Record<string, CompositionMeta>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  renderItemsByCompId: Record<string, RenderItem[]>;
  nextImportIndex: number;
};

type ImportedPsdSourceBinding = {
  compId: string;
  fileName: string;
  fileHandle: PsdImportSource["fileHandle"];
  replacedCompId: string | null;
};

export function buildRootComps(
  sceneComps: Composition[],
  masterEnabledProperties: PropertyTrackState,
  options: MasterProjectOptions
) {
  return [
    buildMasterComposition(sceneComps, masterEnabledProperties, {
      masterCompId: options.masterCompId,
      masterWidth: options.masterWidth,
      masterHeight: options.masterHeight,
    }),
  ];
}

export function getTimelineItemsForCompId(
  compId: string,
  sceneComps: Composition[],
  timelineItemsByCompId: Record<string, TimelineItem[]>,
  metaByCompId: Record<string, CompositionMeta>,
  masterCompId: string
) {
  return compId === masterCompId
    ? buildMasterTimelineItems(
        sceneComps,
        timelineItemsByCompId[masterCompId] ?? [],
        metaByCompId,
        { masterCompId }
      )
    : timelineItemsByCompId[compId] ?? [];
}

export function resolveTimelineSelection(
  compId: string,
  sceneComps: Composition[],
  timelineItemsByCompId: Record<string, TimelineItem[]>,
  metaByCompId: Record<string, CompositionMeta>,
  lastSelectedItemByCompId: Record<string, NonNullable<TimelineSelection>>,
  masterCompId: string
) {
  return resolveTimelineSelectionForComposition(
    compId,
    getTimelineItemsForCompId(
      compId,
      sceneComps,
      timelineItemsByCompId,
      metaByCompId,
      masterCompId
    ),
    lastSelectedItemByCompId
  );
}

export function rebuildMasterTimelineItems(
  sceneComps: Composition[],
  timelineItemsByCompId: Record<string, TimelineItem[]>,
  metaByCompId: Record<string, CompositionMeta>,
  masterCompId: string
) {
  return {
    ...timelineItemsByCompId,
    [masterCompId]: buildMasterTimelineItems(
      sceneComps,
      timelineItemsByCompId[masterCompId] ?? [],
      metaByCompId,
      { masterCompId }
    ),
  };
}

export async function importPsdSourcesIntoProject(
  importSources: PsdImportSource[],
  currentState: ProjectImportState
) {
  const sources = importSources.filter((source) =>
    source.file.name.toLowerCase().endsWith(".psd")
  );
  const sortedSources = [...sources].sort((a, b) =>
    a.file.name.localeCompare(b.file.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
  let nextComps = [...currentState.comps];
  let nextMeta = { ...currentState.metaByCompId };
  let nextTimeline = { ...currentState.timelineItemsByCompId };
  let nextRender = { ...currentState.renderItemsByCompId };
  const failedFiles: string[] = [];
  const replacedFiles: string[] = [];
  const importedSources: ImportedPsdSourceBinding[] = [];
  let importOffset = currentState.nextImportIndex;

  for (const source of sortedSources) {
    const { file, fileHandle } = source;

    try {
      const existingComp = nextComps.find((comp) => comp.name === file.name);
      const replacedCompId = existingComp?.id ?? null;

      if (existingComp) {
        nextComps = nextComps.filter((comp) => comp.id !== existingComp.id);
        nextMeta = removeCompDataFromRecord(nextMeta, existingComp);
        nextTimeline = removeCompDataFromRecord(nextTimeline, existingComp);
        nextRender = removeCompDataFromRecord(nextRender, existingComp);
        replacedFiles.push(file.name);
      }

      const parsed = await loadPsd(file, importOffset);
      importOffset += 1;
      nextComps = [...nextComps, parsed.composition];
      Object.assign(nextMeta, parsed.metaByCompId);
      Object.assign(nextTimeline, parsed.timelineItemsByCompId);
      Object.assign(nextRender, parsed.renderItemsByCompId);
      importedSources.push({
        compId: parsed.composition.id,
        fileName: file.name,
        fileHandle,
        replacedCompId,
      });
    } catch (error) {
      console.error("PSD LOAD ERROR:", file.name, error);
      failedFiles.push(file.name);
    }
  }

  return {
    comps: nextComps,
    metaByCompId: nextMeta,
    timelineItemsByCompId: nextTimeline,
    renderItemsByCompId: nextRender,
    nextImportIndex: importOffset,
    failedFiles,
    replacedFiles,
    importedSources,
  };
}

export function importPreparedPsdPlanIntoProject(
  plan: PsdImportPlan,
  preparedStore: PreparedPsdImportStore,
  currentState: ProjectImportState
) {
  let nextComps = [...currentState.comps];
  let nextMeta = { ...currentState.metaByCompId };
  let nextTimeline = { ...currentState.timelineItemsByCompId };
  let nextRender = { ...currentState.renderItemsByCompId };
  const failedFiles: string[] = [];
  const replacedFiles: string[] = [];
  const importedSources: ImportedPsdSourceBinding[] = [];
  let importOffset = currentState.nextImportIndex;

  plan.entries.forEach((entry) => {
    const prepared = preparedStore.get(entry.token);
    if (!prepared) {
      failedFiles.push(entry.analysis.fileName);
      return;
    }

    try {
      const fileName = entry.analysis.fileName;
      const existingComp = nextComps.find(
        (comp) =>
          comp.type === "main" &&
          (comp.sourceIdentity?.sourceFileName === fileName ||
            (!comp.sourceIdentity && comp.name === fileName))
      );
      const replacedCompId = existingComp?.id ?? null;
      if (existingComp) {
        nextComps = nextComps.filter((comp) => comp.id !== existingComp.id);
        nextMeta = removeCompDataFromRecord(nextMeta, existingComp);
        nextTimeline = removeCompDataFromRecord(nextTimeline, existingComp);
        nextRender = removeCompDataFromRecord(nextRender, existingComp);
        replacedFiles.push(fileName);
      }

      const parsed = parsePsdToComposition(
        prepared.parsedPsd,
        fileName,
        importOffset,
        { nodes: entry.tree, sourceNodeByKey: prepared.sourceNodeByKey },
        entry.settings
      );
      importOffset += 1;
      nextComps = [...nextComps, parsed.composition];
      Object.assign(nextMeta, parsed.metaByCompId);
      Object.assign(nextTimeline, parsed.timelineItemsByCompId);
      Object.assign(nextRender, parsed.renderItemsByCompId);
      importedSources.push({
        compId: parsed.composition.id,
        fileName,
        fileHandle: prepared.source.fileHandle,
        replacedCompId,
      });
    } catch (error) {
      console.error("PSD IMPORT CONFIRM ERROR:", entry.analysis.fileName, error);
      failedFiles.push(entry.analysis.fileName);
    }
  });

  return {
    comps: nextComps,
    metaByCompId: nextMeta,
    timelineItemsByCompId: nextTimeline,
    renderItemsByCompId: nextRender,
    nextImportIndex: importOffset,
    failedFiles,
    replacedFiles,
    importedSources,
  };
}
