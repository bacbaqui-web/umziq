import { useCallback } from "react";
import type { TimelineItem } from "@/models";
import type { ProjectCommands, RenderItem } from "@/engines/project";
import type { TimelineSelection } from "@/engines/timeline/models/timelineViewModel";
import { findTimelineSelectionIndex } from "@/engines/timeline/helpers/timelineInteractionHelpers";

type Options = { compId: string; items: TimelineItem[]; selection: TimelineSelection; projectCommands: ProjectCommands; historyPush: (id: string) => void; applySelection: (id: string, selection: TimelineSelection) => void };

export function useTimelineDuplicateController(options: Options) {
  const duplicate = useCallback(() => {
    const index = findTimelineSelectionIndex(options.items, options.selection);
    if (index < 0) return;
    const source = options.items[index];
    const id = `${source.id}-copy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const copy = { ...source, id };
    options.historyPush(options.compId);
    options.projectCommands.updateTimelineItems((record) => {
      const items = record[options.compId] ?? [];
      const insert = items.findIndex((item) => item.id === source.id);
      return insert < 0 ? record : { ...record, [options.compId]: [...items.slice(0, insert + 1), copy, ...items.slice(insert + 1)] };
    });
    options.projectCommands.updateRenderItems((record) => {
      const items = record[options.compId];
      if (!items?.length) return record;
      const sourceRender = items[index] ?? items.find((item) => item.sourceId === source.sourceId && item.kind === source.kind);
      if (!sourceRender) return record;
      const copyRender: RenderItem = { ...sourceRender, id: `${sourceRender.id}-copy-${id}` };
      const insert = Math.min(index + 1, items.length);
      return { ...record, [options.compId]: [...items.slice(0, insert), copyRender, ...items.slice(insert)] };
    });
    options.applySelection(options.compId, { itemId: copy.id, sourceId: copy.sourceId, kind: copy.kind });
  }, [options]);
  return { duplicate };
}
