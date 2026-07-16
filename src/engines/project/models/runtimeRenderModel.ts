import type { TimelineItemKind } from "@/models";

// Runtime-only render resources. The canvas field is not part of a serializable project document.
export interface RenderDrawable {
  id: string;
  left: number;
  top: number;
  visible: boolean;
  sourceLayerId?: string;
  canvas?: HTMLCanvasElement;
}

export interface RenderItem {
  id: string;
  name: string;
  kind: TimelineItemKind;
  visible: boolean;
  sourceId: string;
  targetCompId?: string;
  drawables: RenderDrawable[];
}
