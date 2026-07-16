import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { Composition, CompositionMeta, TimelineItem } from "@/models";
import type { TimelineSelection } from "@/models";
import { resolveTimelineSelection } from "@/engines/project/helpers/psd/psdImportProjectHelpers";

type UseProjectNavigationControllerOptions = {
  masterCompId: string;
  comps: Composition[];
  metaByCompId: Record<string, CompositionMeta>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  lastSelectedItemByCompId: Record<string, NonNullable<TimelineSelection>>;
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
  setSelectedCompId,
  applySelectionForComposition,
}: UseProjectNavigationControllerOptions) {
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

  return { enterComposition };
}
