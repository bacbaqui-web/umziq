import type {
  LayerDocumentProject,
  LayerDocumentProjectCanvasSettings,
  LayerDocumentSelection,
  LayerDocumentTransaction,
  LibrarySourceSelection,
  SourceRegistryRefreshStatus,
} from "@/models";
import type {
  LayerDocumentSourceTransaction,
  SourceRegistryCacheInvalidationDescriptor,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

export interface LayerDocumentNexusSession {
  readonly layerSelection: LayerDocumentSelection | null;
  readonly sourceSelection: LibrarySourceSelection | null;
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
export interface LayerDocumentNexusRuntimeSession {
  readonly selectedTransformKeyframe:
    LayerDocumentTransformKeyframeSelection | null;
  readonly acknowledgedSourceStatuses?:
    readonly LayerDocumentSourceStatusIdentity[];
}

/** History snapshots contain canonical Project Data only. */
export type LayerDocumentNexusHistorySnapshot =
  LayerDocumentProject;

export interface LayerDocumentNexusHistoryEntry {
  readonly origin: "layer-transaction" | "source-transaction" | "canvas-settings";
  readonly label: string;
  readonly affectedLayerDocumentIds: readonly string[];
  readonly affectedSourceIds: readonly string[];
  readonly before: LayerDocumentNexusHistorySnapshot;
  readonly after: LayerDocumentNexusHistorySnapshot;
}

export interface LayerDocumentNexusState {
  readonly currentProject: LayerDocumentProject;
  readonly session: LayerDocumentNexusSession;
  readonly runtimeSession: LayerDocumentNexusRuntimeSession;
  readonly undoStack: readonly LayerDocumentNexusHistoryEntry[];
  readonly redoStack: readonly LayerDocumentNexusHistoryEntry[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export type LayerDocumentNexusRuntimeCachePolicy =
  | "preserve"
  | "apply-source-invalidations"
  | "invalidate-all";

/**
 * Runtime effects are returned by a transition and are never stored in the
 * Project, session, or History snapshots.
 */
export interface LayerDocumentNexusEffect {
  readonly clearDraft: boolean;
  readonly resetLocalUi: boolean;
  readonly stopPlayback: boolean;
  readonly recomputeRender: boolean;
  readonly runtimeCachePolicy: LayerDocumentNexusRuntimeCachePolicy;
  readonly cacheInvalidations:
    readonly SourceRegistryCacheInvalidationDescriptor[];
  readonly sourceInvalidationIds:
    readonly string[];
  readonly sourceRestorationIds:
    readonly string[];
  readonly sourceDisposalIds:
    readonly string[];
}

export type LayerDocumentNexusAction =
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
      readonly kind: "commit-canvas-settings";
      readonly settings: LayerDocumentProjectCanvasSettings;
      readonly label: string;
    }
  | {
      readonly kind: "set-layer-selection";
      readonly selection: LayerDocumentSelection | null;
    }
  | {
      readonly kind: "set-source-selection";
      readonly selection: LibrarySourceSelection | null;
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

export type LayerDocumentNexusErrorCode =
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

export type LayerDocumentNexusTransitionResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly state: LayerDocumentNexusState;
      readonly effect: LayerDocumentNexusEffect;
    }
  | {
      readonly ok: false;
      readonly state: LayerDocumentNexusState;
      readonly error: {
        readonly code: LayerDocumentNexusErrorCode;
        readonly message: string;
      };
    };

export type LayerDocumentNexusInitializationResult =
  | {
      readonly ok: true;
      readonly state: LayerDocumentNexusState;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: Extract<
          LayerDocumentNexusErrorCode,
          "invalid-initial-state" | "invalid-session" | "non-plain-data"
        >;
        readonly message: string;
      };
    };

export interface CreateLayerDocumentNexusOptions {
  readonly project: LayerDocumentProject;
  readonly layerSelection?: LayerDocumentSelection | null;
  readonly sourceSelection?: LibrarySourceSelection | null;
  readonly activeGroupLayerDocumentId?: string | null;
}

export interface NexusProjectReadPort {
  readonly state: LayerDocumentNexusState;
}

export interface NexusTransactionPort {
  readonly commitLayerTransaction: (
    transaction: LayerDocumentTransaction,
    selectTransformKeyframe?: LayerDocumentTransformKeyframeSelection
  ) => LayerDocumentNexusTransitionResult;
  readonly commitSourceTransaction: (
    transaction: LayerDocumentSourceTransaction
  ) => LayerDocumentNexusTransitionResult;
  readonly commitCanvasSettings: (
    settings: LayerDocumentProjectCanvasSettings,
    label: string
  ) => LayerDocumentNexusTransitionResult;
}

export interface NexusReplacePort {
  readonly replaceProject: (
    project: LayerDocumentProject
  ) => LayerDocumentNexusTransitionResult;
}

export interface NexusHistoryPort {
  readonly undo: () => LayerDocumentNexusTransitionResult;
  readonly redo: () => LayerDocumentNexusTransitionResult;
}

export interface NexusSelectionPort {
  readonly selectLayer: (
    selection: LayerDocumentSelection | null
  ) => LayerDocumentNexusTransitionResult;
  readonly selectSource: (
    selection: LibrarySourceSelection | null
  ) => LayerDocumentNexusTransitionResult;
  readonly setActiveGroup: (
    layerDocumentId: string
  ) => LayerDocumentNexusTransitionResult;
  readonly selectTransformKeyframe: (
    selection: LayerDocumentTransformKeyframeSelection | null
  ) => LayerDocumentNexusTransitionResult;
  readonly acknowledgeSourceStatus: (
    sourceId: string
  ) => LayerDocumentNexusTransitionResult;
}

export interface LayerDocumentNexusPort
  extends NexusProjectReadPort,
    NexusTransactionPort,
    NexusReplacePort,
    NexusHistoryPort,
    NexusSelectionPort {
  readonly transition: (
    action: LayerDocumentNexusAction
  ) => LayerDocumentNexusTransitionResult;
}
