import type { LayerDocumentType, Position, Scale } from "@/models";
import type {
  EditorPlaceholderDescriptor,
} from "@/engines/playback-render/models/editorPlaceholderModel";
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
  layerDocumentId?: string;
  itemId: string;
  renderItemId: string;
  drawableId: string;
  sourceId: string | null;
  sourceResourceCacheKey?: string | null;
  layerResultCacheKey?: string;
  sourceType: LayerDocumentType;
  localFrame: number;
  logicalSize: RenderSize;
  source: RenderDrawableSource;
  transform: EvaluatedRenderTransform;
  opacity: number;
};

export type RenderCompositionCommand = {
  type: "composition";
  layerDocumentId?: string;
  itemId: string;
  renderItemId: string;
  sourceId: string | null;
  sourceType: LayerDocumentType;
  targetCompId: string;
  localFrame: number;
  width: number;
  height: number;
  transform: EvaluatedRenderTransform;
  opacity: number;
  children: RenderCommand[];
};

export type RenderPlaceholderCommand = {
  type: "placeholder";
  layerDocumentId?: string;
  itemId: string;
  renderItemId: null;
  sourceId: string | null;
  sourceType: "drawing" | "text" | "audio";
  localFrame: number;
  logicalSize: RenderSize;
  transform: EvaluatedRenderTransform;
  opacity: number;
  placeholder: EditorPlaceholderDescriptor;
};

export type RenderCommand =
  | RenderDrawableCommand
  | RenderCompositionCommand
  | RenderPlaceholderCommand;

export type RenderFrame = {
  compositionId: string;
  globalFrame: number;
  width: number;
  height: number;
  commands: RenderCommand[];
};
