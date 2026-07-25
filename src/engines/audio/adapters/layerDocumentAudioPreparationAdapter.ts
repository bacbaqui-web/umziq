import type {
  LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentAudioFutureCommand,
  LayerDocumentAudioPreparationPort,
  LayerDocumentAudioQueryResult,
  LayerDocumentAudioUnsupportedPreparation,
} from "@/engines/audio/models/layerDocumentAudioPreparationModel";

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
    dataSchema: "empty",
    domainEditing: "future",
  };
}

export function prepareLayerDocumentAudioFutureCommand(
  project: LayerDocumentProject,
  command: LayerDocumentAudioFutureCommand
): LayerDocumentAudioUnsupportedPreparation {
  return {
    ok: false,
    status: "unsupported",
    reason: "audio-domain-data-empty",
    layerDocumentId: command.layerDocumentId,
    project,
    projectUpdateCount: 0,
    transactionCount: 0,
    historyEntryCount: 0,
  };
}

export const LAYER_DOCUMENT_AUDIO_PREPARATION_PORT:
LayerDocumentAudioPreparationPort = {
  query: queryLayerDocumentAudio,
  prepareFutureCommand: prepareLayerDocumentAudioFutureCommand,
};
