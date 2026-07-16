import { useCallback } from "react";
import type { TimelineItem } from "@/models";
import type { ProjectCommands } from "@/engines/project";
import type { TimelineSelection } from "@/engines/timeline/models/timelineViewModel";
import { findTimelineSelectionIndex, splitTimelineItem } from "@/engines/timeline/helpers/timelineInteractionHelpers";

type Options = { compId: string; currentFrame: number; items: TimelineItem[]; selection: TimelineSelection; projectCommands: ProjectCommands; historyPush: (id: string) => void; applySelection: (id: string, selection: TimelineSelection) => void };

export function useTimelineSplitController(options: Options) {
  const split = useCallback(() => {
    const index = findTimelineSelectionIndex(options.items, options.selection);
    if (index < 0) return;
    const source = options.items[index];
    const id = `${source.id}-split-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const result = splitTimelineItem(source, options.currentFrame, id);
    if (!result) return;
    options.historyPush(options.compId);
    options.projectCommands.updateTimelineItems((record) => {
      const items = record[options.compId] ?? [];
      const insert = items.findIndex((item) => item.id === source.id);
      return insert < 0 ? record : { ...record, [options.compId]: [...items.slice(0, insert), result.right, result.left, ...items.slice(insert + 1)] };
    });
    options.applySelection(options.compId, { itemId: result.right.id, sourceId: result.right.sourceId, kind: result.right.kind });
  }, [options]);
  return { split };
}
