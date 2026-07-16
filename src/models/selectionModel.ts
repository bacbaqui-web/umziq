import type { TimelineItemKind } from "@/models/timelineItemModel";

export type TimelineSelection = {
  itemId?: string;
  sourceId: string;
  kind: TimelineItemKind;
} | null;
