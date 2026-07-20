import type { Position, Scale } from "@/models";
import type {
  RenderDrawableSource,
  RenderSize,
} from "@/engines/playback-render/models/renderSourceModel";

export type EvaluatedRenderTransform = {
  position: Position;
  transformOffset: Position;
  anchor: Position;
  scale: Scale;
  rotation: number;
  origin: Position;
};

export type RenderDrawableCommand = {
  type: "drawable";
  renderItemId: string;
  drawableId: string;
  sourceId: string;
  localFrame: number;
  logicalSize: RenderSize;
  source: RenderDrawableSource;
  transform: EvaluatedRenderTransform;
  opacity: number;
};

export type RenderCompositionCommand = {
  type: "composition";
  renderItemId: string;
  sourceId: string;
  targetCompId: string;
  localFrame: number;
  width: number;
  height: number;
  transform: EvaluatedRenderTransform;
  opacity: number;
  children: RenderCommand[];
};

export type RenderCommand = RenderDrawableCommand | RenderCompositionCommand;

export type RenderFrame = {
  compositionId: string;
  globalFrame: number;
  width: number;
  height: number;
  commands: RenderCommand[];
};
