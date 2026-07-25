import type { LayerDocumentType, Position, Scale } from "@/models";
import type {
  EditorPlaceholderDescriptor,
} from "@/engines/playback-render/models/editorPlaceholderModel";

export type EvaluatedSceneSize = {
  readonly width: number;
  readonly height: number;
};

export type EvaluatedSceneTransform = {
  readonly position: Position;
  readonly transformOffset: Position;
  readonly anchor: Position;
  readonly scale: Scale;
  readonly rotation: number;
};

export type EvaluatedSceneDrawableNode = {
  readonly type: "drawable";
  readonly identityKind?: "canonical-placement";
  readonly layerDocumentId?: string;
  readonly itemId: string;
  readonly renderItemId: string;
  readonly drawableId: string;
  readonly sourceId: string | null;
  readonly sourceResourceCacheKey?: string | null;
  readonly layerResultCacheKey?: string;
  readonly sourceType: LayerDocumentType;
  readonly layerId?: string;
  readonly localFrame: number;
  readonly visible: true;
  readonly order: number;
  readonly logicalSize: EvaluatedSceneSize;
  readonly transform: EvaluatedSceneTransform;
  readonly opacity: number;
};

export type EvaluatedSceneCompositionNode = {
  readonly type: "composition";
  readonly identityKind?: "canonical-placement";
  readonly layerDocumentId?: string;
  readonly itemId: string;
  readonly renderItemId: string;
  readonly sourceId: string | null;
  readonly sourceResourceCacheKey?: string | null;
  readonly layerResultCacheKey?: string;
  readonly sourceType: LayerDocumentType;
  readonly targetCompId: string;
  readonly localFrame: number;
  readonly visible: true;
  readonly order: number;
  readonly size: EvaluatedSceneSize;
  readonly transform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly children: EvaluatedSceneNode[];
};

export type EvaluatedScenePlaceholderNode = {
  readonly type: "placeholder";
  readonly identityKind?: "canonical-placement";
  readonly layerDocumentId?: string;
  readonly itemId: string;
  readonly renderItemId: null;
  readonly sourceId: string | null;
  readonly sourceResourceCacheKey?: string | null;
  readonly layerResultCacheKey?: string;
  readonly sourceType: "drawing" | "text" | "audio";
  readonly localFrame: number;
  readonly visible: true;
  readonly order: number;
  readonly logicalSize: EvaluatedSceneSize;
  readonly transform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly placeholder: EditorPlaceholderDescriptor;
};

export type EvaluatedSceneNode =
  | EvaluatedSceneDrawableNode
  | EvaluatedSceneCompositionNode
  | EvaluatedScenePlaceholderNode;

export type EvaluatedScene = {
  readonly compositionId: string;
  readonly globalFrame: number;
  readonly size: EvaluatedSceneSize;
  readonly localFrameBySourceId: ReadonlyMap<string, number>;
  readonly localFrameByItemId: ReadonlyMap<string, number>;
  readonly nodes: EvaluatedSceneNode[];
};
