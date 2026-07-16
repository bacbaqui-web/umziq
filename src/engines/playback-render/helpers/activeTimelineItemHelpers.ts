import type { TimelineItem } from "@/models";
import type { RenderDrawable, RenderItem } from "@/engines/project";
import { isFrameInsideTimelineItem } from "@/engines/animation";

export function getActiveTimelineItems(
  timelineItems: readonly TimelineItem[],
  globalFrame: number
) {
  return timelineItems.filter((item) =>
    isFrameInsideTimelineItem(globalFrame, item)
  );
}

export function getActiveRenderItems(
  renderItems: readonly RenderItem[],
  timelineItems: readonly TimelineItem[],
  globalFrame: number
) {
  const activeSourceIds = new Set(
    getActiveTimelineItems(timelineItems, globalFrame).map(
      (item) => item.sourceId
    )
  );

  return renderItems.filter((item) => activeSourceIds.has(item.sourceId));
}

export function flattenRenderItemsToDrawables(
  renderItemsByCompId: Record<string, RenderItem[]>,
  compId: string
): RenderDrawable[] {
  return (renderItemsByCompId[compId] ?? []).flatMap((item) =>
    item.kind === "subComp" && item.targetCompId
      ? flattenRenderItemsToDrawables(renderItemsByCompId, item.targetCompId)
      : item.drawables
  );
}
