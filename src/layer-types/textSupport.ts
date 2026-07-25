import {
  buildUpdateLayerDocumentDomainTransaction,
  type LayerDocumentProject,
  type LayerDocumentTransactionResult,
  type LayerDocumentType,
  type TextLayerData,
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
  const layer =
    project.payload.layerDocumentsById[layerDocumentId];
  if (!layer) {
    return { status: "not-found", layerDocumentId };
  }
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
