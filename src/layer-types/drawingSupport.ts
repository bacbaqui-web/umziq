import {
  buildUpdateLayerDocumentDomainTransaction,
  type DrawingLayerData,
  type LayerDocumentProject,
  type LayerDocumentTransactionResult,
  type LayerDocumentType,
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

function cloneDrawingData(
  data: DrawingLayerData
): DrawingLayerData {
  return {
    documentVersion: data.documentVersion,
    elements: data.elements.map((element) =>
      JSON.parse(JSON.stringify(element))
    ),
  };
}

export function queryLayerDocumentDrawing(
  project: LayerDocumentProject,
  layerDocumentId: string
): LayerDocumentDrawingQueryResult {
  const layer =
    project.payload.layerDocumentsById[layerDocumentId];
  if (!layer) {
    return { status: "not-found", layerDocumentId };
  }
  if (layer.type !== "drawing") {
    return {
      status: "type-mismatch",
      layerDocumentId,
      expectedType: "drawing",
      actualType: layer.type,
    };
  }
  return {
    status: "ready",
    layerDocumentId,
    data: cloneDrawingData(layer.data),
  };
}

export function prepareLayerDocumentDrawingUpdate(
  project: LayerDocumentProject,
  command: ReplaceLayerDocumentDrawingCommand
) {
  return buildUpdateLayerDocumentDomainTransaction(project, {
    layerDocumentId: command.layerDocumentId,
    update: {
      kind: "replace-drawing-document",
      data: command.data,
    },
  });
}

export const LAYER_DOCUMENT_DRAWING_PREPARATION_PORT:
LayerDocumentDrawingPreparationPort = {
  query: queryLayerDocumentDrawing,
  prepareUpdate: prepareLayerDocumentDrawingUpdate,
};
