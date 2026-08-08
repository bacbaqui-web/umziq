import type { TimelineItemKind } from "@/models/offlineMigration/timelineItemModel";

export type TimelineSelection = {
  itemId?: string;
  sourceId: string;
  kind: TimelineItemKind;
} | null;
