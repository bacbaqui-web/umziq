import type {
  DrawingLayerData,
  LayerDocumentProject,
  LayerDocumentTransactionResult,
  LayerDocumentType,
} from "@/models";

export type LayerDocumentDrawingQueryResult =
  | {
      readonly status: "ready";
      readonly layerDocumentId: string;
      readonly data: DrawingLayerData;
    }
  | {
      readonly status: "not-found";
      readonly layerDocumentId: string;
    }
  | {
      readonly status: "type-mismatch";
      readonly layerDocumentId: string;
      readonly expectedType: "drawing";
      readonly actualType: LayerDocumentType;
    };

export interface ReplaceLayerDocumentDrawingCommand {
  readonly layerDocumentId: string;
  readonly data: DrawingLayerData;
}

export interface LayerDocumentDrawingPreparationPort {
  readonly query: (
    project: LayerDocumentProject,
    layerDocumentId: string
  ) => LayerDocumentDrawingQueryResult;
  readonly prepareUpdate: (
    project: LayerDocumentProject,
    command: ReplaceLayerDocumentDrawingCommand
  ) => LayerDocumentTransactionResult;
}
