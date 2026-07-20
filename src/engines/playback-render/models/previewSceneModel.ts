import type {
  EvaluatedSceneSize,
  EvaluatedSceneTransform,
} from "@/engines/playback-render/models/evaluatedSceneModel";

export type PreviewNodeKind = "layer" | "composition";

export type BasePreviewNode = {
  readonly id: string;
  readonly kind: PreviewNodeKind;
  readonly sourceId: string;
  readonly renderItemId: string;
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
  readonly drawableId: string;
  readonly layerId?: string;
  readonly children: [];
};

export type CompositionPreviewNode = BasePreviewNode & {
  readonly kind: "composition";
  readonly targetCompId: string;
  readonly children: PreviewNode[];
};

export type PreviewNode = LayerPreviewNode | CompositionPreviewNode;

export type PreviewScene = {
  readonly compositionId: string;
  readonly globalFrame: number;
  readonly logicalSize: EvaluatedSceneSize;
  readonly nodes: PreviewNode[];
};
