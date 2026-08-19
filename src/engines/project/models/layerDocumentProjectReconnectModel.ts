import type {
  LayerDocumentProject,
  LinkedSourceContentFingerprint,
} from "@/models";
import type { LayerDocumentProjectLinkedSourcePreparationPort } from "@/engines/project/models/layerDocumentProjectOpenModel";
import type {
  SourceAccessPort,
  SourceResourceReference,
} from "@/gateway/contracts/sourceAccessGateway";
import type {
  LayerDocumentSourceRuntimeResolutionPort,
  LayerDocumentSourceRuntimeResolutionStatus,
} from "@/engines/project/models/layerDocumentSourceRuntimeResolutionModel";
import type {
  LayerDocumentSourceRuntimeResourcePort,
} from "@/render";
import type {
  LayerDocumentAudioRuntimePort,
} from "@/engines/project/models/layerDocumentAudioRuntimeModel";

export interface LayerDocumentProjectReconnectCommitPort {
  readonly commitAvailable: (options: {
    readonly projectId: string;
    readonly locatorId: string;
    readonly source: SourceResourceReference;
    readonly sourceIds: readonly string[];
  }) => void;
}

export interface LayerDocumentProjectReconnectReadItem {
  readonly sourceId: string;
  readonly displayName: string;
  readonly suggestedFileName: string;
  readonly status: Extract<
    LayerDocumentSourceRuntimeResolutionStatus,
    "missing" | "error"
  >;
  readonly fingerprintPolicy:
    "verified" | "legacy-unverified";
  readonly dependentSourceIds: readonly string[];
  readonly dependentLayerDocumentIds:
    readonly string[];
}

export interface LayerDocumentProjectReconnectReadModel {
  readonly items:
    readonly LayerDocumentProjectReconnectReadItem[];
}

export type LayerDocumentProjectReconnectResult =
  | {
      readonly ok: true;
      readonly status: "reconnected";
      readonly sourceId: string;
      readonly availableSourceIds:
        readonly string[];
      readonly missingSourceIds:
        readonly string[];
    }
  | {
      readonly ok: true;
      readonly status: "confirmation-required";
      readonly sourceId: string;
      readonly reason:
        | "fingerprint-mismatch"
        | "legacy-unverified-fingerprint";
      readonly expectedFingerprint:
        LinkedSourceContentFingerprint | null;
      readonly actualFingerprint:
        LinkedSourceContentFingerprint;
      readonly choices:
        readonly ["refresh-source", "replace-source"];
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          | "source-not-found"
          | "source-not-linked-document"
          | "cancelled"
          | "permission-denied"
          | "read-failed"
          | "parse-failed"
          | "runtime-registration-failed"
          | "stale-operation";
        readonly message: string;
      };
    };

export interface LayerDocumentProjectReconnectController {
  readonly read: () =>
    LayerDocumentProjectReconnectReadModel;
  readonly reconnect: (
    sourceId: string
  ) => Promise<
    LayerDocumentProjectReconnectResult
  >;
}

export interface CreateLayerDocumentProjectReconnectControllerOptions {
  readonly readProject: () =>
    LayerDocumentProject;
  readonly sourceAccess:
    SourceAccessPort;
  readonly preparation:
    LayerDocumentProjectLinkedSourcePreparationPort;
  readonly sourceRuntime:
    LayerDocumentSourceRuntimeResourcePort;
  readonly audioRuntime?:
    LayerDocumentAudioRuntimePort;
  readonly sourceResolution:
    LayerDocumentSourceRuntimeResolutionPort;
  readonly reconnectCommit:
    LayerDocumentProjectReconnectCommitPort;
}
