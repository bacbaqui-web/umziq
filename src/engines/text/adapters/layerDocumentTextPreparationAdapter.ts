import {
  buildUpdateLayerDocumentDomainTransaction,
  type LayerDocumentProject,
  type TextLayerData,
} from "@/models";
import type {
  LayerDocumentTextPreparationPort,
  LayerDocumentTextQueryResult,
  ReplaceLayerDocumentTextCommand,
} from "@/engines/text/models/layerDocumentTextPreparationModel";

function cloneTextData(data: TextLayerData): TextLayerData {
  return {
    text: data.text,
    style: { ...data.style },
  };
}

export function queryLayerDocumentText(
  project: LayerDocumentProject,
  layerDocumentId: string
): LayerDocumentTextQueryResult {
  const layer = project.payload.layerDocumentsById[layerDocumentId];
  if (!layer) return { status: "not-found", layerDocumentId };
  if (layer.type !== "text") {
    return {
      status: "type-mismatch",
      layerDocumentId,
      expectedType: "text",
      actualType: layer.type,
    };
  }
  return {
    status: "ready",
    layerDocumentId,
    data: cloneTextData(layer.data),
  };
}

export function prepareLayerDocumentTextUpdate(
  project: LayerDocumentProject,
  command: ReplaceLayerDocumentTextCommand
) {
  return buildUpdateLayerDocumentDomainTransaction(project, {
    layerDocumentId: command.layerDocumentId,
    update: {
      kind: "replace-text-document",
      data: command.data,
    },
  });
}

export const LAYER_DOCUMENT_TEXT_PREPARATION_PORT:
LayerDocumentTextPreparationPort = {
  query: queryLayerDocumentText,
  prepareUpdate: prepareLayerDocumentTextUpdate,
};
