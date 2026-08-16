import {
  buildUpdateLayerDocumentDomainTransaction,
  type AudioLayerData,
  type LayerDocumentProject,
  type LayerDocumentTransactionResult,
  type LayerDocumentType,
} from "@/models";

export type LayerDocumentAudioQueryResult =
  | {
      readonly status: "ready";
      readonly layerDocumentId: string;
      readonly data: AudioLayerData;
    }
  | {
      readonly status: "not-found";
      readonly layerDocumentId: string;
    }
  | {
      readonly status: "type-mismatch";
      readonly layerDocumentId: string;
      readonly expectedType: "audio";
      readonly actualType: LayerDocumentType;
    };

export interface ReplaceLayerDocumentAudioCommand {
  readonly layerDocumentId: string;
  readonly data: AudioLayerData;
}

export interface LayerDocumentAudioPreparationPort {
  readonly query: (
    project: LayerDocumentProject,
    layerDocumentId: string
  ) => LayerDocumentAudioQueryResult;
  readonly prepareUpdate: (
    project: LayerDocumentProject,
    command: ReplaceLayerDocumentAudioCommand
  ) => LayerDocumentTransactionResult;
}

function cloneAudioData(data: AudioLayerData): AudioLayerData {
  return {
    gain: data.gain,
    muted: data.muted,
    fadeInFrames: data.fadeInFrames,
    fadeOutFrames: data.fadeOutFrames,
  };
}

export function queryLayerDocumentAudio(
  project: LayerDocumentProject,
  layerDocumentId: string
): LayerDocumentAudioQueryResult {
  const layer = project.payload.layerDocumentsById[layerDocumentId];
  if (!layer) return { status: "not-found", layerDocumentId };
  if (layer.type !== "audio") {
    return {
      status: "type-mismatch",
      layerDocumentId,
      expectedType: "audio",
      actualType: layer.type,
    };
  }
  return {
    status: "ready",
    layerDocumentId,
    data: cloneAudioData(layer.data),
  };
}

export function prepareLayerDocumentAudioUpdate(
  project: LayerDocumentProject,
  command: ReplaceLayerDocumentAudioCommand
): LayerDocumentTransactionResult {
  return buildUpdateLayerDocumentDomainTransaction(project, {
    layerDocumentId: command.layerDocumentId,
    update: {
      kind: "replace-audio-document",
      data: command.data,
    },
  });
}

export const LAYER_DOCUMENT_AUDIO_PREPARATION_PORT:
LayerDocumentAudioPreparationPort = {
  query: queryLayerDocumentAudio,
  prepareUpdate: prepareLayerDocumentAudioUpdate,
};
