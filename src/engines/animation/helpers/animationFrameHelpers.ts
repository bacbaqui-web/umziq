import type { TimelineItem } from "@/models";

export function globalFrameToLocalFrame(globalFrame: number, startFrame: number) {
  return globalFrame - startFrame;
}

export function localFrameToGlobalFrame(localFrame: number, startFrame: number) {
  return startFrame + localFrame;
}

export function isFrameInsideTimelineItem(globalFrame: number, item: TimelineItem) {
  return globalFrame >= item.startFrame && globalFrame < item.startFrame + item.durationFrames;
}

export function resolveSelectedTransformLocalFrame(
  globalFrame: number,
  selectedTimelineItem: TimelineItem | null
) {
  return selectedTimelineItem && isFrameInsideTimelineItem(globalFrame, selectedTimelineItem)
    ? globalFrameToLocalFrame(globalFrame, selectedTimelineItem.startFrame)
    : globalFrame;
}

export function getKeyframeGlobalFrame(localFrame: number, ownerItem?: TimelineItem | null) {
  return ownerItem ? localFrameToGlobalFrame(localFrame, ownerItem.startFrame) : localFrame;
}

export function buildLocalFrameBySourceId(timelineItems: TimelineItem[], globalFrame: number) {
  const result = new Map<string, number>();

  timelineItems.forEach((item) => {
    if (isFrameInsideTimelineItem(globalFrame, item)) {
      result.set(item.sourceId, globalFrameToLocalFrame(globalFrame, item.startFrame));
    }
  });

  return result;
}
