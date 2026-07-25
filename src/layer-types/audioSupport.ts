import type {
  LayerDocumentProject,
  LayerDocumentType,
} from "@/models";

export type LayerDocumentAudioQueryResult =
  | {
      readonly status: "ready";
      readonly layerDocumentId: string;
      readonly dataSchema: "empty";
      readonly domainEditing: "future";
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

export interface LayerDocumentAudioFutureCommand {
  readonly layerDocumentId: string;
  readonly operation: "domain-update";
}

export interface LayerDocumentAudioUnsupportedPreparation {
  readonly ok: false;
  readonly status: "unsupported";
  readonly reason: "audio-domain-data-empty";
  readonly layerDocumentId: string;
  readonly project: LayerDocumentProject;
  readonly projectUpdateCount: 0;
  readonly transactionCount: 0;
  readonly historyEntryCount: 0;
}

export interface LayerDocumentAudioPreparationPort {
  readonly query: (
    project: LayerDocumentProject,
    layerDocumentId: string
  ) => LayerDocumentAudioQueryResult;
  readonly prepareFutureCommand: (
    project: LayerDocumentProject,
    command: LayerDocumentAudioFutureCommand
  ) => LayerDocumentAudioUnsupportedPreparation;
}

export function queryLayerDocumentAudio(
  project: LayerDocumentProject,
  layerDocumentId: string
): LayerDocumentAudioQueryResult {
  const layer =
    project.payload.layerDocumentsById[layerDocumentId];
  if (!layer) {
    return { status: "not-found", layerDocumentId };
  }
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
  prepareFutureCommand:
    prepareLayerDocumentAudioFutureCommand,
};
