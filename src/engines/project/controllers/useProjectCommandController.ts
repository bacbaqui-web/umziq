import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { Composition, CompositionMeta, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";
import type {
  ProjectCommandPort,
  ProjectRecords,
} from "@/engines/project/models/projectCommandModel";

type ProjectRecordSetters = {
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setMetaByCompId: Dispatch<SetStateAction<Record<string, CompositionMeta>>>;
  setTimelineItemsByCompId: Dispatch<
    SetStateAction<Record<string, TimelineItem[]>>
  >;
  setRenderItemsByCompId: Dispatch<SetStateAction<Record<string, RenderItem[]>>>;
};

export function useProjectCommandController({
  setComps,
  setMetaByCompId,
  setTimelineItemsByCompId,
  setRenderItemsByCompId,
}: ProjectRecordSetters): ProjectCommandPort {
  const replaceProjectRecords = useCallback(
    (records: ProjectRecords) => {
      setComps(records.comps);
      setMetaByCompId(records.metaByCompId);
      setTimelineItemsByCompId(records.timelineItemsByCompId);
      setRenderItemsByCompId(records.renderItemsByCompId);
    },
    [setComps, setMetaByCompId, setRenderItemsByCompId, setTimelineItemsByCompId]
  );

  const replaceCompositions = useCallback(
    (nextComps: Composition[]) => setComps(nextComps),
    [setComps]
  );

  const updateCompositions = useCallback(
    (updater: (current: Composition[]) => Composition[]) => setComps(updater),
    [setComps]
  );

  const updateCompositionMeta = useCallback(
    (
      updater: (
        current: Record<string, CompositionMeta>
      ) => Record<string, CompositionMeta>
    ) => setMetaByCompId(updater),
    [setMetaByCompId]
  );

  const replaceTimelineItems = useCallback(
    (nextItems: Record<string, TimelineItem[]>) => setTimelineItemsByCompId(nextItems),
    [setTimelineItemsByCompId]
  );

  const updateTimelineItems = useCallback(
    (
      updater: (
        current: Record<string, TimelineItem[]>
      ) => Record<string, TimelineItem[]>
    ) => setTimelineItemsByCompId(updater),
    [setTimelineItemsByCompId]
  );

  const replaceTimelineItemsForComposition = useCallback(
    (compId: string, items: TimelineItem[]) => {
      setTimelineItemsByCompId((current) => ({ ...current, [compId]: items }));
    },
    [setTimelineItemsByCompId]
  );

  const updateTimelineItem = useCallback(
    (
      compId: string,
      itemId: string,
      updater: (item: TimelineItem) => TimelineItem
    ) => {
      setTimelineItemsByCompId((current) => ({
        ...current,
        [compId]: (current[compId] ?? []).map((item) =>
          item.id === itemId ? updater(item) : item
        ),
      }));
    },
    [setTimelineItemsByCompId]
  );

  const replaceRenderItems = useCallback(
    (nextItems: Record<string, RenderItem[]>) => setRenderItemsByCompId(nextItems),
    [setRenderItemsByCompId]
  );

  const updateRenderItems = useCallback(
    (
      updater: (
        current: Record<string, RenderItem[]>
      ) => Record<string, RenderItem[]>
    ) => setRenderItemsByCompId(updater),
    [setRenderItemsByCompId]
  );

  return useMemo(
    () => ({
      replaceProjectRecords,
      replaceCompositions,
      updateCompositions,
      updateCompositionMeta,
      replaceTimelineItems,
      updateTimelineItems,
      replaceTimelineItemsForComposition,
      updateTimelineItem,
      replaceRenderItems,
      updateRenderItems,
    }),
    [
      replaceCompositions,
      replaceProjectRecords,
      replaceRenderItems,
      replaceTimelineItems,
      replaceTimelineItemsForComposition,
      updateCompositionMeta,
      updateCompositions,
      updateRenderItems,
      updateTimelineItem,
      updateTimelineItems,
    ]
  );
}
