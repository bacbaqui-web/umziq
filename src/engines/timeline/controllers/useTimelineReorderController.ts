import { useCallback } from "react";
import { reorderCompositionState, type ProjectCommands, type RenderItem } from "@/engines/project";
import type { Composition, TimelineItem } from "@/models";
import {
  findTimelineComposition,
  findTimelineMainComposition,
  flattenTimelineRenderDrawables,
  reorderTimelineItems,
  reorderTimelineRenderItems,
  visitTimelineComposition,
} from "@/engines/timeline/helpers/timelineInteractionHelpers";

type Options = {
  masterCompId: string;
  selectedComp: Composition;
  compositions: Composition[];
  selectedItems: TimelineItem[];
  renderItemsByCompId: Record<string, RenderItem[]>;
  draggedItemId: string | null;
  projectCommands: ProjectCommands;
  historyPush: (id: string) => void;
  setSelectedCompId: (id: string) => void;
  setDraggedItemId: (id: string | null) => void;
};

export function useTimelineReorderController(options: Options) {
  const reorder = useCallback((targetId: string) => {
    if (!options.draggedItemId || options.draggedItemId === targetId) return;
    const items = reorderTimelineItems(options.selectedItems, options.draggedItemId, targetId);
    if (items === options.selectedItems) return;
    options.historyPush(options.selectedComp.id);
    if (options.selectedComp.id === options.masterCompId) {
      const comps = items.map((item) => options.compositions.find((comp) => comp.id === item.sourceId)).filter((comp): comp is Composition => !!comp);
      options.projectCommands.replaceCompositions(comps);
      options.projectCommands.replaceTimelineItemsForComposition(options.masterCompId, items);
      options.setDraggedItemId(null);
      return;
    }
    const render = reorderTimelineRenderItems(options.renderItemsByCompId[options.selectedComp.id] ?? [], items);
    const comps = reorderCompositionState(options.compositions, options.selectedComp.id, items);
    const selectedComp = findTimelineComposition(comps, options.selectedComp.id);
    const renderRecord = { ...options.renderItemsByCompId, [options.selectedComp.id]: render };
    if (options.selectedComp.type === "sub" && options.selectedComp.parentId) {
      const main = findTimelineMainComposition(comps, selectedComp ?? options.selectedComp);
      if (main) visitTimelineComposition(main, (target) => {
        renderRecord[target.id] = (renderRecord[target.id] ?? []).map((item) =>
          item.kind === "subComp" && item.targetCompId
            ? { ...item, drawables: flattenTimelineRenderDrawables(renderRecord, item.targetCompId) }
            : item
        );
      });
    }
    options.projectCommands.replaceTimelineItemsForComposition(options.selectedComp.id, items);
    options.projectCommands.replaceRenderItems(renderRecord);
    options.projectCommands.replaceCompositions(comps);
    options.setSelectedCompId(selectedComp?.id ?? options.masterCompId);
    options.setDraggedItemId(null);
  }, [options]);
  return { reorder, setDraggedItemId: options.setDraggedItemId };
}
