import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import type { CompositionMeta, SourceSyncStatus, TimelineItem } from "@/models";
import type { ProjectCommands } from "@/engines/project";
import type { TimelineItemMoveSession } from "@/engines/timeline/models/timelineInteractionModel";
import type { TimelineSelection } from "@/engines/timeline/models/timelineViewModel";
import { resolveTimelineDragDelta, resolveTimelineItemMove } from "@/engines/timeline/helpers/timelineInteractionHelpers";

type Options = {
  compId: string;
  selectedMeta: CompositionMeta | null;
  pxPerFrame: number;
  projectCommands: ProjectCommands;
  history: { begin: (id: string) => void; markDirty: (id: string) => void; commit: (id: string) => void };
  applySelection: (compId: string, selection: TimelineSelection) => void;
  acknowledgeSourceStatus: (item: TimelineItem) => void;
  resolveSourceDelete: (item: TimelineItem, decision: "delete" | "keep") => void;
};

export function useTimelineItemController(options: Options) {
  const [deleteDecisionItemId, setDeleteDecisionItemId] = useState<string | null>(null);
  const createMoveSession = useCallback((item: TimelineItem, clientX: number): TimelineItemMoveSession => {
    options.history.begin(options.compId);
    return { type: "move-item", itemId: item.id, compId: options.compId, startClientX: clientX, initialStartFrame: item.startFrame };
  }, [options]);
  const moveItem = useCallback((session: TimelineItemMoveSession, clientX: number) => {
    const delta = resolveTimelineDragDelta(clientX, session.startClientX, options.pxPerFrame);
    const nextStart = resolveTimelineItemMove(session.initialStartFrame, delta, options.selectedMeta?.durationFrames ?? 1);
    let changed = false;
    flushSync(() => options.projectCommands.updateTimelineItem(session.compId, session.itemId, (item) => {
      if (item.startFrame === nextStart) return item;
      changed = true;
      return { ...item, startFrame: nextStart };
    }));
    if (changed) options.history.markDirty(session.compId);
  }, [options]);
  const endMove = useCallback((session: TimelineItemMoveSession) => {
    options.history.commit(session.compId);
  }, [options]);
  const selectItem = useCallback((item: TimelineItem) => {
    options.applySelection(options.compId, { itemId: item.id, sourceId: item.sourceId, kind: item.kind });
  }, [options]);
  const activateItem = useCallback((item: TimelineItem, status: SourceSyncStatus) => {
    if (status === "updated" || status === "new") options.acknowledgeSourceStatus(item);
    selectItem(item);
    setDeleteDecisionItemId(status === "deletePending" ? item.id : null);
  }, [options, selectItem]);
  const resolveDelete = useCallback((item: TimelineItem, decision: "delete" | "keep") => {
    options.resolveSourceDelete(item, decision);
    setDeleteDecisionItemId(null);
  }, [options]);
  return { deleteDecisionItemId, createMoveSession, moveItem, endMove, selectItem, activateItem, resolveDelete };
}
