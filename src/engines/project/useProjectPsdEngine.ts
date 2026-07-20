import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import type {
  Composition,
  CompositionMeta,
  PropertyTrackState,
  TimelineItem,
} from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type { StoredPsdSource } from "@/engines/project/models/psdSourceRuntimeModel";
import type { TimelineSelection } from "@/models";
import type { ProjectCommandPort } from "@/engines/project/models/projectCommandModel";
import { useProjectNavigationController } from "@/engines/project/controllers/useProjectNavigationController";
import { usePsdImportController } from "@/engines/project/controllers/usePsdImportController";
import { usePsdLibraryController } from "@/engines/project/controllers/usePsdLibraryController";
import { usePsdRefreshController } from "@/engines/project/controllers/usePsdRefreshController";
import { usePsdSourceController } from "@/engines/project/controllers/usePsdSourceController";
import { usePsdSourceSyncController } from "@/engines/project/controllers/usePsdSourceSyncController";

type UseProjectPsdEngineOptions = {
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
  projectCommands: ProjectCommandPort;
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

export function useProjectPsdEngine(options: UseProjectPsdEngineOptions) {
  const source = usePsdSourceController({
    sourceEntriesRef: options.psdSourceEntriesRef,
  });
  const navigation = useProjectNavigationController(options);
  const importer = usePsdImportController({
    ...options,
    registerSource: source.registerSource,
    removeSource: source.removeSource,
  });
  const refresher = usePsdRefreshController({
    ...options,
    resolveLatestSource: source.resolveLatestSource,
    registerSource: source.registerSource,
  });
  const library = usePsdLibraryController({
    ...options,
    removeSource: source.removeSource,
  });
  const sourceSync = usePsdSourceSyncController(options);

  return {
    enterComposition: navigation.enterComposition,
    preparePsdImport: importer.preparePsdImport,
    confirmPsdImport: importer.confirmPsdImport,
    cancelPsdImport: importer.cancelPsdImport,
    handleRefreshMainComp: refresher.refreshMainComp,
    handleDeleteMainComp: library.deleteMainComp,
    handleReorderMainComps: library.reorderMainComps,
    handleAcknowledgeTimelineSourceStatus: sourceSync.acknowledgeSourceStatus,
    handleResolveTimelineSourceDelete: sourceSync.resolveSourceDelete,
  };
}
