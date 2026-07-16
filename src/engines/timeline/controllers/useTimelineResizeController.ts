import { useCallback } from "react";
import type { CompositionMeta, TimelineItem } from "@/models";
import type { ProjectCommands } from "@/engines/project";
import type { TimelineItemResizeSession } from "@/engines/timeline/models/timelineInteractionModel";
import { resolveTimelineDragDelta, resolveTimelineResizeEnd, resolveTimelineResizeStart } from "@/engines/timeline/helpers/timelineInteractionHelpers";

type Options = {
  compId: string;
  selectedMeta: CompositionMeta | null;
  selectedItems: TimelineItem[];
  pxPerFrame: number;
  projectCommands: ProjectCommands;
  history: { begin: (id: string) => void; markDirty: (id: string) => void; commit: (id: string) => void };
};

export function useTimelineResizeController(options: Options) {
  const createResizeSession = useCallback((item: TimelineItem, clientX: number, edge: "start" | "end"): TimelineItemResizeSession => {
    options.history.begin(options.compId);
    return { type: edge === "start" ? "resize-start" : "resize-end", itemId: item.id, compId: options.compId, startClientX: clientX, initialStartFrame: item.startFrame, initialDurationFrames: item.durationFrames };
  }, [options.compId, options.history]);
  const resizeItem = useCallback((session: TimelineItemResizeSession, clientX: number) => {
    const delta = resolveTimelineDragDelta(clientX, session.startClientX, options.pxPerFrame);
    const timelineDuration = options.selectedMeta?.durationFrames ?? session.initialStartFrame + session.initialDurationFrames;
    const current = options.selectedItems.find((item) => item.id === session.itemId);
    const next = session.type === "resize-start"
      ? resolveTimelineResizeStart(session.initialStartFrame, session.initialDurationFrames, delta, timelineDuration)
      : { startFrame: current?.startFrame ?? session.initialStartFrame, durationFrames: resolveTimelineResizeEnd(session.initialDurationFrames, delta, current?.startFrame ?? session.initialStartFrame, timelineDuration) };
    let changed = false;
    options.projectCommands.updateTimelineItem(session.compId, session.itemId, (item) => {
      if (item.startFrame === next.startFrame && item.durationFrames === next.durationFrames) return item;
      changed = true;
      return { ...item, ...next };
    });
    if (changed) options.history.markDirty(session.compId);
  }, [options.history, options.projectCommands, options.pxPerFrame, options.selectedItems, options.selectedMeta?.durationFrames]);
  const endResize = useCallback((session: TimelineItemResizeSession) => options.history.commit(session.compId), [options.history]);
  return { createResizeSession, resizeItem, endResize };
}
