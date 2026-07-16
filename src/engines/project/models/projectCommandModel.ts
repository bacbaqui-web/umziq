import type { Composition, CompositionMeta, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project/models/runtimeRenderModel";

export type ProjectRecords = {
  comps: Composition[];
  metaByCompId: Record<string, CompositionMeta>;
  timelineItemsByCompId: Record<string, TimelineItem[]>;
  renderItemsByCompId: Record<string, RenderItem[]>;
};

export type ProjectCommandPort = {
  replaceProjectRecords: (records: ProjectRecords) => void;
  replaceCompositions: (nextComps: Composition[]) => void;
  updateCompositions: (
    updater: (current: Composition[]) => Composition[]
  ) => void;
  updateCompositionMeta: (
    updater: (
      current: Record<string, CompositionMeta>
    ) => Record<string, CompositionMeta>
  ) => void;
  replaceTimelineItems: (
    nextItems: Record<string, TimelineItem[]>
  ) => void;
  updateTimelineItems: (
    updater: (
      current: Record<string, TimelineItem[]>
    ) => Record<string, TimelineItem[]>
  ) => void;
  replaceTimelineItemsForComposition: (
    compId: string,
    items: TimelineItem[]
  ) => void;
  updateTimelineItem: (
    compId: string,
    itemId: string,
    updater: (item: TimelineItem) => TimelineItem
  ) => void;
  replaceRenderItems: (nextItems: Record<string, RenderItem[]>) => void;
  updateRenderItems: (
    updater: (
      current: Record<string, RenderItem[]>
    ) => Record<string, RenderItem[]>
  ) => void;
};
