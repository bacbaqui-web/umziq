import {
  buildUpdateLayerDocumentDomainTransaction,
  type DrawingLayerData,
  type LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentDrawingPreparationPort,
  LayerDocumentDrawingQueryResult,
  ReplaceLayerDocumentDrawingCommand,
} from "@/engines/drawing/models/layerDocumentDrawingPreparationModel";

function cloneDrawingData(data: DrawingLayerData): DrawingLayerData {
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
  const layer = project.payload.layerDocumentsById[layerDocumentId];
  if (!layer) return { status: "not-found", layerDocumentId };
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
