import type {
  LayerDocumentProject,
  LayerDocumentSelection,
  LayerDocumentTransaction,
  PsdTreeSourceSelection,
  SourceRegistryRefreshStatus,
} from "@/models";
import type {
  LayerDocumentSourceTransaction,
  SourceRegistryCacheInvalidationDescriptor,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

export interface LayerDocumentOwnerSession {
  readonly layerSelection: LayerDocumentSelection | null;
  readonly sourceSelection: PsdTreeSourceSelection | null;
  readonly activeGroupLayerDocumentId: string;
}

export interface LayerDocumentTransformKeyframeSelection {
  readonly layerDocumentId: string;
  readonly property:
    | "position"
    | "scale"
    | "rotation"
    | "opacity";
  readonly localFrame: number;
  readonly globalFrame: number;
}

export interface LayerDocumentSourceStatusIdentity {
  readonly sourceId: string;
  readonly version: number;
  readonly status: SourceRegistryRefreshStatus;
}

/**
 * Ephemeral editor state owned beside the canonical Project session.
 * It is deliberately excluded from History snapshots.
 */
export interface LayerDocumentOwnerRuntimeSession {
  readonly selectedTransformKeyframe:
    LayerDocumentTransformKeyframeSelection | null;
  readonly acknowledgedSourceStatuses?:
    readonly LayerDocumentSourceStatusIdentity[];
}

/** History snapshots contain canonical Project Data only. */
export type LayerDocumentOwnerHistorySnapshot =
  LayerDocumentProject;

export interface LayerDocumentOwnerHistoryEntry {
  readonly origin: "layer-transaction" | "source-transaction";
  readonly label: string;
  readonly affectedLayerDocumentIds: readonly string[];
  readonly affectedSourceIds: readonly string[];
  readonly before: LayerDocumentOwnerHistorySnapshot;
  readonly after: LayerDocumentOwnerHistorySnapshot;
}

export interface LayerDocumentProjectOwnerState {
  readonly currentProject: LayerDocumentProject;
  readonly session: LayerDocumentOwnerSession;
  readonly runtimeSession: LayerDocumentOwnerRuntimeSession;
  readonly undoStack: readonly LayerDocumentOwnerHistoryEntry[];
  readonly redoStack: readonly LayerDocumentOwnerHistoryEntry[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export type LayerDocumentOwnerRuntimeCachePolicy =
  | "preserve"
  | "apply-source-invalidations"
  | "invalidate-all";

/**
 * Runtime effects are returned by a transition and are never stored in the
 * Project, session, or History snapshots.
 */
export interface LayerDocumentProjectOwnerEffect {
  readonly clearDraft: boolean;
  readonly resetLocalUi: boolean;
  readonly stopPlayback: boolean;
  readonly recomputeRender: boolean;
  readonly runtimeCachePolicy: LayerDocumentOwnerRuntimeCachePolicy;
  readonly cacheInvalidations:
    readonly SourceRegistryCacheInvalidationDescriptor[];
  readonly sourceInvalidationIds:
    readonly string[];
  readonly sourceRestorationIds:
    readonly string[];
  readonly sourceDisposalIds:
    readonly string[];
  readonly suspendedSourceDisposalIds:
    readonly string[];
}

export type LayerDocumentProjectOwnerAction =
  | {
      readonly kind: "replace-project";
      readonly project: LayerDocumentProject;
    }
  | {
      readonly kind: "commit-layer-transaction";
      readonly transaction: LayerDocumentTransaction;
      readonly selectTransformKeyframe?:
        LayerDocumentTransformKeyframeSelection;
    }
  | {
      readonly kind: "commit-source-transaction";
      readonly transaction: LayerDocumentSourceTransaction;
    }
  | {
      readonly kind: "set-layer-selection";
      readonly selection: LayerDocumentSelection | null;
    }
  | {
      readonly kind: "set-source-selection";
      readonly selection: PsdTreeSourceSelection | null;
    }
  | {
      readonly kind: "set-active-group";
      readonly layerDocumentId: string;
    }
  | {
      readonly kind: "set-transform-keyframe-selection";
      readonly selection:
        LayerDocumentTransformKeyframeSelection | null;
    }
  | {
      readonly kind: "acknowledge-source-status";
      readonly sourceId: string;
    }
  | {
      readonly kind: "undo";
    }
  | {
      readonly kind: "redo";
    };

export type LayerDocumentProjectOwnerErrorCode =
  | "invalid-initial-state"
  | "invalid-session"
  | "invalid-replacement"
  | "non-plain-data"
  | "stale-transaction"
  | "invalid-transaction"
  | "invalid-after"
  | "no-change"
  | "undo-empty"
  | "redo-empty";

export type LayerDocumentProjectOwnerTransitionResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly state: LayerDocumentProjectOwnerState;
      readonly effect: LayerDocumentProjectOwnerEffect;
    }
  | {
      readonly ok: false;
      readonly state: LayerDocumentProjectOwnerState;
      readonly error: {
        readonly code: LayerDocumentProjectOwnerErrorCode;
        readonly message: string;
      };
    };

export type LayerDocumentProjectOwnerInitializationResult =
  | {
      readonly ok: true;
      readonly state: LayerDocumentProjectOwnerState;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: Extract<
          LayerDocumentProjectOwnerErrorCode,
          "invalid-initial-state" | "invalid-session" | "non-plain-data"
        >;
        readonly message: string;
      };
    };

export interface CreateLayerDocumentProjectOwnerOptions {
  readonly project: LayerDocumentProject;
  readonly layerSelection?: LayerDocumentSelection | null;
  readonly sourceSelection?: PsdTreeSourceSelection | null;
  readonly activeGroupLayerDocumentId?: string | null;
}

export interface LayerDocumentProjectOwnerPort {
  readonly state: LayerDocumentProjectOwnerState;
  readonly transition: (
    action: LayerDocumentProjectOwnerAction
  ) => LayerDocumentProjectOwnerTransitionResult;
}
