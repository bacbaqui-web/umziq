import { useCallback } from "react";
import { flushSync } from "react-dom";
import { getKeyframeGlobalFrame, type SelectedKeyframe } from "@/engines/animation";
import type { AnimatableProperty, TimelineItem } from "@/models";
import type { TimelineKeyframeMoveSession } from "@/engines/timeline/models/timelineInteractionModel";
import type { TimelineSelection } from "@/engines/timeline/models/timelineViewModel";
import { resolveTimelineKeyframeMove } from "@/engines/timeline/helpers/timelineInteractionHelpers";

type Options = {
  compId: string;
  items: TimelineItem[];
  pxPerFrame: number;
  setSelectedKeyframe: (value: SelectedKeyframe) => void;
  setDraggingKeyframe: (value: SelectedKeyframe) => void;
  applySelection: (id: string, selection: TimelineSelection) => void;
  seekFrame: (frame: number) => void;
  moveKeyframe: (target: { kind: "layer" | "composition"; id: string }, property: AnimatableProperty, from: number, to: number) => void;
  removeKeyframe: (target: { kind: "layer" | "composition"; id: string }, property: AnimatableProperty, frame: number) => void;
  history: { push: (id: string) => void; begin: (id: string) => void; markDirty: (id: string) => void; commit: (id: string) => void };
};

export function useTimelineKeyframeController(options: Options) {
  const select = useCallback((targetKind: "layer" | "composition", targetId: string, frame: number, property: AnimatableProperty) => {
    const owner = options.items.find((item) => item.sourceId === targetId);
    options.applySelection(options.compId, { sourceId: targetId, kind: targetKind === "layer" ? "layer" : "subComp" });
    options.seekFrame(getKeyframeGlobalFrame(frame, owner));
    options.setSelectedKeyframe({ targetKind, targetId, frame, property });
  }, [options]);
  const createMoveSession = useCallback((targetKind: "layer" | "composition", targetId: string, frame: number, property: AnimatableProperty, clientX: number): TimelineKeyframeMoveSession => {
    options.history.begin(options.compId);
    options.setDraggingKeyframe({ targetKind, targetId, originFrame: frame, frame, property });
    return { type: "move-keyframe", compId: options.compId, targetKind, targetId, originalFrame: frame, frame, property, startClientX: clientX };
  }, [options]);
  const move = useCallback((session: TimelineKeyframeMoveSession, clientX: number) => {
    if (!options.items.some((item) => item.sourceId === session.targetId)) return;
    const frame = resolveTimelineKeyframeMove(session.frame, clientX, session.startClientX, options.pxPerFrame);
    if (frame === session.frame) return;
    options.history.markDirty(session.compId);
    const selected = { targetKind: session.targetKind, targetId: session.targetId, originFrame: session.originalFrame, frame, property: session.property };
    options.setSelectedKeyframe(selected);
    options.setDraggingKeyframe(selected);
    return { ...session, frame, startClientX: clientX };
  }, [options]);
  const endMove = useCallback((session: TimelineKeyframeMoveSession) => {
    flushSync(() => {
      if (session.frame !== session.originalFrame) options.moveKeyframe({ kind: session.targetKind, id: session.targetId }, session.property, session.originalFrame, session.frame);
      options.setSelectedKeyframe({ targetKind: session.targetKind, targetId: session.targetId, frame: session.frame, property: session.property });
      options.setDraggingKeyframe(null);
    });
    options.history.commit(session.compId);
  }, [options]);
  const remove = useCallback((keyframe: NonNullable<SelectedKeyframe>) => {
    options.history.push(options.compId);
    options.removeKeyframe({ kind: keyframe.targetKind, id: keyframe.targetId }, keyframe.property, keyframe.frame);
    options.setSelectedKeyframe(null);
    options.setDraggingKeyframe(null);
  }, [options]);
  return { select, createMoveSession, move, endMove, remove };
}
