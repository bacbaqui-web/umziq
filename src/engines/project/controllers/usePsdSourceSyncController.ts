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
  acknowledgeTimelineSourceStatus,
  deleteTimelineSourceFromProject,
  markTimelineSourceMissing,
} from "@/engines/project/helpers/psd/psdSourceCleanupHelpers";
import {
  buildRootComps,
  rebuildMasterTimelineItems,
  resolveTimelineSelection,
} from "@/engines/project/helpers/psd/psdImportProjectHelpers";
import { findCompositionById } from "@/engines/project/helpers/projectModelHelpers";

type UsePsdSourceSyncControllerOptions = {
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
  pushCompositionHistorySnapshot: (compId: string) => void;
  applySelectionForComposition: (
    compId: string,
    nextSelection: TimelineSelection
  ) => void;
};

export function usePsdSourceSyncController({
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
  pushCompositionHistorySnapshot,
  applySelectionForComposition,
}: UsePsdSourceSyncControllerOptions) {
  const getRootComps = useCallback(
    (sceneComps: Composition[]) =>
      buildRootComps(sceneComps, masterEnabledProperties, {
        masterCompId,
        masterWidth,
        masterHeight,
      }),
    [masterCompId, masterEnabledProperties, masterHeight, masterWidth]
  );

  const acknowledgeSourceStatus = useCallback(
    (item: TimelineItem) => {
      projectCommands.replaceCompositions(
        acknowledgeTimelineSourceStatus(comps, item)
      );
    },
    [comps, projectCommands]
  );

  const resolveSourceDelete = useCallback(
    (item: TimelineItem, decision: "delete" | "keep") => {
      pushCompositionHistorySnapshot(item.compId);
      if (decision === "keep") {
        projectCommands.replaceCompositions(markTimelineSourceMissing(comps, item));
        return;
      }

      const nextProject = deleteTimelineSourceFromProject(
        { comps, metaByCompId, timelineItemsByCompId, renderItemsByCompId },
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
      const nextSelectedCompId =
        findCompositionById(getRootComps(nextProject.comps), selectedCompId)?.id ??
        masterCompId;
      const nextSelection = resolveTimelineSelection(
        nextSelectedCompId,
        nextProject.comps,
        nextTimeline,
        nextProject.metaByCompId,
        lastSelectedItemByCompId,
        masterCompId
      );

      projectCommands.replaceProjectRecords({
        comps: nextProject.comps,
        metaByCompId: nextProject.metaByCompId,
        timelineItemsByCompId: nextTimeline,
        renderItemsByCompId: nextProject.renderItemsByCompId,
      });
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
      projectCommands,
      pushCompositionHistorySnapshot,
      renderItemsByCompId,
      selectedCompId,
      setSelectedCompId,
      timelineItemsByCompId,
    ]
  );

  return { acknowledgeSourceStatus, resolveSourceDelete };
}
