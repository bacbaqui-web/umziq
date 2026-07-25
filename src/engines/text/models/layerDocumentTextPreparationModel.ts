import type {
  LayerDocumentProject,
  LayerDocumentTransactionResult,
  LayerDocumentType,
  TextLayerData,
} from "@/models";

export type LayerDocumentTextQueryResult =
  | {
      readonly status: "ready";
      readonly layerDocumentId: string;
      readonly data: TextLayerData;
    }
  | {
      readonly status: "not-found";
      readonly layerDocumentId: string;
    }
  | {
      readonly status: "type-mismatch";
      readonly layerDocumentId: string;
      readonly expectedType: "text";
      readonly actualType: LayerDocumentType;
    };

export interface ReplaceLayerDocumentTextCommand {
  readonly layerDocumentId: string;
  readonly data: TextLayerData;
}

export interface LayerDocumentTextPreparationPort {
  readonly query: (
    project: LayerDocumentProject,
    layerDocumentId: string
  ) => LayerDocumentTextQueryResult;
  readonly prepareUpdate: (
    project: LayerDocumentProject,
    command: ReplaceLayerDocumentTextCommand
  ) => LayerDocumentTransactionResult;
}
