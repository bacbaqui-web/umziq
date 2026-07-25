import type {
  EditorPlaceholderDescriptor,
} from "@/engines/playback-render/models/editorPlaceholderModel";
import type {
  EvaluatedSceneSize,
  EvaluatedSceneTransform,
} from "@/engines/playback-render/models/evaluatedSceneModel";
import type { LayerDocumentType } from "@/models";

export type PreviewNodeKind = "layer" | "composition" | "placeholder";

export type BasePreviewNode = {
  readonly id: string;
  readonly kind: PreviewNodeKind;
  readonly layerDocumentId?: string;
  readonly itemId: string;
  readonly sourceId: string | null;
  readonly sourceResourceCacheKey?: string | null;
  readonly layerResultCacheKey?: string;
  readonly sourceType: LayerDocumentType;
  readonly renderItemId: string | null;
  readonly parentId: string | null;
  readonly children: PreviewNode[];
  readonly transform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly visible: boolean;
  readonly order: number;
  readonly localFrame: number;
  readonly globalFrame: number;
  readonly logicalSize: EvaluatedSceneSize;
};

export type LayerPreviewNode = BasePreviewNode & {
  readonly kind: "layer";
  readonly renderItemId: string;
  readonly drawableId: string;
  readonly layerId?: string;
  readonly children: [];
};

export type CompositionPreviewNode = BasePreviewNode & {
  readonly kind: "composition";
  readonly renderItemId: string;
  readonly targetCompId: string;
  readonly children: PreviewNode[];
};

export type PlaceholderPreviewNode = BasePreviewNode & {
  readonly kind: "placeholder";
  readonly sourceType: "drawing" | "text" | "audio";
  readonly renderItemId: null;
  readonly placeholder: EditorPlaceholderDescriptor;
  readonly children: [];
};

export type PreviewNode =
  | LayerPreviewNode
  | CompositionPreviewNode
  | PlaceholderPreviewNode;

export type PreviewScene = {
  readonly compositionId: string;
  readonly globalFrame: number;
  readonly logicalSize: EvaluatedSceneSize;
  readonly nodes: PreviewNode[];
};
