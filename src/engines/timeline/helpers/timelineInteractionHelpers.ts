import type { Composition, TimelineItem } from "@/models";
import type { RenderDrawable, RenderItem } from "@/engines/project";
import type { TimelineSelection } from "@/engines/timeline/models/timelineViewModel";

export function resolveTimelineDragDelta(clientX: number, startClientX: number, pxPerFrame: number) {
  return Math.round((clientX - startClientX) / Math.max(pxPerFrame, 0.001));
}

export function resolveTimelineItemMove(initialStartFrame: number, deltaFrames: number, durationFrames: number) {
  return Math.min(Math.max(0, durationFrames - 1), Math.max(0, initialStartFrame + deltaFrames));
}

export function resolveTimelineResizeStart(initialStartFrame: number, initialDurationFrames: number, deltaFrames: number, timelineDurationFrames: number) {
  const nextStart = Math.max(0, initialStartFrame + deltaFrames);
  const startFrame = Math.min(nextStart, initialStartFrame + initialDurationFrames - 1);
  const durationFrames = Math.min(
    Math.max(1, initialDurationFrames - (startFrame - initialStartFrame)),
    Math.max(1, timelineDurationFrames - startFrame)
  );
  return { startFrame, durationFrames };
}

export function resolveTimelineResizeEnd(initialDurationFrames: number, deltaFrames: number, itemStartFrame: number, timelineDurationFrames: number) {
  return Math.min(
    Math.max(1, initialDurationFrames + deltaFrames),
    Math.max(1, timelineDurationFrames - itemStartFrame)
  );
}

export function resolveTimelineKeyframeMove(frame: number, clientX: number, startClientX: number, pxPerFrame: number) {
  return Math.max(0, frame + resolveTimelineDragDelta(clientX, startClientX, pxPerFrame));
}

export function resolveTimelineAutoScroll(
  clientX: number,
  viewportLeft: number,
  viewportRight: number,
  threshold: number,
  step: number
) {
  if (clientX < viewportLeft + threshold) return -Math.max(0, step);
  if (clientX > viewportRight - threshold) return Math.max(0, step);
  return 0;
}

export function findTimelineSelectionIndex(items: TimelineItem[], selection: TimelineSelection) {
  if (!selection) return -1;
  return items.findIndex((item) =>
    selection.itemId
      ? item.id === selection.itemId
      : item.sourceId === selection.sourceId && item.kind === selection.kind
  );
}

export function reorderTimelineItems<T extends { id: string }>(items: T[], draggedId: string, targetId: string) {
  const fromIndex = items.findIndex((item) => item.id === draggedId);
  const toIndex = items.findIndex((item) => item.id === targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
  const next = [...items];
  const [dragged] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, dragged);
  return next;
}

export function reorderTimelineRenderItems(renderItems: RenderItem[], timelineItems: TimelineItem[]) {
  const bySource = new Map(renderItems.map((item) => [item.sourceId, item]));
  return timelineItems.map((item) => bySource.get(item.sourceId)).filter((item): item is RenderItem => !!item);
}

export function flattenTimelineRenderDrawables(record: Record<string, RenderItem[]>, compId: string): RenderDrawable[] {
  return (record[compId] ?? []).flatMap((item) =>
    item.kind === "subComp" && item.targetCompId
      ? flattenTimelineRenderDrawables(record, item.targetCompId)
      : item.drawables
  );
}

export function findTimelineComposition(comps: Composition[], id: string): Composition | null {
  for (const comp of comps) {
    if (comp.id === id) return comp;
    const child = findTimelineComposition(comp.children ?? [], id);
    if (child) return child;
  }
  return null;
}

export function findTimelineMainComposition(comps: Composition[], comp: Composition | null): Composition | null {
  if (!comp) return null;
  if (comp.type === "main") return comp;
  return findTimelineMainComposition(comps, findTimelineComposition(comps, comp.parentId ?? ""));
}

export function visitTimelineComposition(comp: Composition, visitor: (target: Composition) => void) {
  visitor(comp);
  (comp.children ?? []).forEach((child) => visitTimelineComposition(child, visitor));
}

export function normalizeTimelineItemName(value: string) {
  return value.trim();
}

export function splitTimelineItem(item: TimelineItem, frame: number, rightItemId: string) {
  const end = item.startFrame + item.durationFrames;
  if (frame <= item.startFrame || frame >= end) return null;
  return {
    left: { ...item, durationFrames: frame - item.startFrame },
    right: { ...item, id: rightItemId, startFrame: frame, durationFrames: end - frame },
  };
}
