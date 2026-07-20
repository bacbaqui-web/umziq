import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Composition, CompositionMeta, TimelineItem } from "@/models";
import type { TimelineSelection } from "@/models";
import { resolveTimelineSelection } from "@/engines/project/helpers/psd/psdImportProjectHelpers";
import type { ProjectCommandPort } from "@/engines/project/models/projectCommandModel";
import { acknowledgeCompositionSourceStatus } from "@/engines/project/helpers/psd/psdSourceCleanupHelpers";

type UseProjectNavigationControllerOptions = {
  masterCompId: string;
  comps: Composition[];
  metaByCompId: Record<string, CompositionMeta>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  lastSelectedItemByCompId: Record<string, NonNullable<TimelineSelection>>;
  projectCommands: ProjectCommandPort;
  setSelectedCompId: Dispatch<SetStateAction<string>>;
  applySelectionForComposition: (
    compId: string,
    nextSelection: TimelineSelection
  ) => void;
};

export function useProjectNavigationController({
  masterCompId,
  comps,
  metaByCompId,
  timelineItemsByCompId,
  lastSelectedItemByCompId,
  projectCommands,
  setSelectedCompId,
  applySelectionForComposition,
}: UseProjectNavigationControllerOptions) {
  const enterComposition = useCallback(
    (compId: string) => {
      const acknowledgedComps = acknowledgeCompositionSourceStatus(comps, compId);
      if (acknowledgedComps !== comps) {
        projectCommands.replaceCompositions(acknowledgedComps);
      }
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
      projectCommands,
      setSelectedCompId,
      timelineItemsByCompId,
    ]
  );

  return { enterComposition };
}
