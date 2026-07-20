import type { Position, Scale } from "@/models";

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
  readonly renderItemId: string;
  readonly drawableId: string;
  readonly sourceId: string;
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
  readonly renderItemId: string;
  readonly sourceId: string;
  readonly targetCompId: string;
  readonly localFrame: number;
  readonly visible: true;
  readonly order: number;
  readonly size: EvaluatedSceneSize;
  readonly transform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly children: EvaluatedSceneNode[];
};

export type EvaluatedSceneNode =
  | EvaluatedSceneDrawableNode
  | EvaluatedSceneCompositionNode;

export type EvaluatedScene = {
  readonly compositionId: string;
  readonly globalFrame: number;
  readonly size: EvaluatedSceneSize;
  readonly localFrameBySourceId: ReadonlyMap<string, number>;
  readonly nodes: EvaluatedSceneNode[];
};
