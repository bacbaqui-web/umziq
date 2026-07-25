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
