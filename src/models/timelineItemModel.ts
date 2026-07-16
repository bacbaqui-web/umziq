export type TimelineItemKind = "layer" | "subComp";

export interface TimelineItem {
  id: string;
  name: string;
  kind: TimelineItemKind;
  visible: boolean;
  compId: string;
  sourceId: string;
  startFrame: number;
  durationFrames: number;
  targetCompId?: string;
}
