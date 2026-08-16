import type {
  LayerDocument,
  LayerDocumentProject,
  LayerDocumentSelectionChange,
  PsdDocumentSourceRecord,
  PsdNodeSourceRecord,
  PsdTreeSourceSelection,
  SourceRegistryKind,
  SourceRegistryRecord,
} from "@/models";
import type {
  LayerDocumentSourceRuntimeResolutionReadPort,
  LayerDocumentSourceRuntimeResolutionStatus,
} from "@/engines/project/models/layerDocumentSourceRuntimeResolutionModel";

export type SourceRegistryTreeNonPsdPolicy =
  | "resource-leaf"
  | "preserved-resource-leaf";

export interface SourceRegistryTreeMetadata {
  readonly sourceId: string;
  readonly kind: SourceRegistryKind;
  readonly displayName: string;
  readonly path: string | null;
  readonly resolutionStatus:
    LayerDocumentSourceRuntimeResolutionStatus;
  readonly reconciliationStatus:
    | "normal"
    | "updated"
    | "new"
    | "deletePending";
  readonly refreshStatus:
    | "normal"
    | "updated"
    | "new"
    | "deletePending"
    | "missing";
}

export interface PsdSourceTreeNode extends SourceRegistryTreeMetadata {
  readonly kind: "psd-node";
  readonly entityKind: "layer" | "composition";
  readonly documentSourceId: string;
  readonly sourcePath: string;
  readonly children: readonly PsdSourceTreeNode[];
  readonly orphanReason:
    | "missing-document"
    | "missing-parent"
    | "ambiguous-parent"
    | null;
}

export interface PsdSourceTreeDocument extends SourceRegistryTreeMetadata {
  readonly kind: "psd-document";
  readonly children: readonly PsdSourceTreeNode[];
}

export interface NonPsdSourceTreeItem extends SourceRegistryTreeMetadata {
  readonly kind: "audio" | "video" | "unknown";
  readonly treePolicy: SourceRegistryTreeNonPsdPolicy;
}

export interface PsdSourceTreeReadModel {
  readonly selectionKind: "psd-tree-source";
  readonly selectedSourceId: string | null;
  readonly selectionStatus: "none" | "selected" | "stale";
  readonly documents: readonly PsdSourceTreeDocument[];
  readonly orphanNodes: readonly PsdSourceTreeNode[];
  readonly nonPsdSources: readonly NonPsdSourceTreeItem[];
}

export type PsdTreeSourceSelectionChange =
  | {
      readonly kind: "select";
      readonly selection: PsdTreeSourceSelection;
    }
  | {
      readonly kind: "clear-if-selected";
      readonly sourceId: string;
    }
  | {
      readonly kind: "preserve";
    };

export type SourceRegistryHistoryPolicy =
  | "record-entry"
  | "clear-history";

export interface SourceRegistryHistoryEntry {
  readonly label: string;
  readonly affectedSourceIds: readonly string[];
  readonly affectedLayerDocumentIds: readonly string[];
}

export interface SourceRegistryCacheInvalidationContext {
  readonly globalFrame: number;
  readonly localFrameByLayerDocumentId: Readonly<Record<string, number>>;
  readonly quality: string;
  readonly draftIdentityByLayerDocumentId?: Readonly<
    Record<string, string | null>
  >;
}

export interface SourceRegistryCacheInvalidationDescriptor {
  readonly sourceId: string;
  readonly layerDocumentId: string;
  readonly layerRevisionBefore: number;
  readonly layerRevisionAfter: number;
  readonly sourceResourceCacheKeyBefore: string;
  readonly sourceResourceCacheKeyAfter: string;
  readonly layerResultCacheKeyBefore: string;
  readonly layerResultCacheKeyAfter: string;
}

export type LayerDocumentSourceTransactionKind =
  | "import-sources-and-layers"
  | "refresh-source"
  | "refresh-psd-document"
  | "reconnect-source"
  | "discover-psd-nodes"
  | "delete-source";

export interface LayerDocumentSourceTransaction {
  readonly kind: LayerDocumentSourceTransactionKind;
  readonly before: LayerDocumentProject;
  readonly after: LayerDocumentProject;
  readonly sourceSelectionChange: PsdTreeSourceSelectionChange;
  readonly layerSelectionChange: LayerDocumentSelectionChange;
  readonly historyPolicy: SourceRegistryHistoryPolicy;
  readonly historyEntry: SourceRegistryHistoryEntry | null;
  readonly historyEntryCount: 0 | 1;
  readonly clearHistory: boolean;
  readonly createdSourceIds: readonly string[];
  readonly deletedSourceIds: readonly string[];
  readonly createdLayerDocumentIds: readonly string[];
  readonly deletedLayerDocumentIds: readonly string[];
  readonly cacheInvalidations:
    readonly SourceRegistryCacheInvalidationDescriptor[];
}

export type LayerDocumentSourceTransactionErrorCode =
  | "invalid-before"
  | "invalid-input"
  | "invalid-output"
  | "no-change"
  | "source-not-found"
  | "source-id-conflict"
  | "source-kind-conflict"
  | "source-reference-conflict"
  | "source-is-referenced"
  | "layer-id-conflict"
  | "layer-transaction-error"
  | "version-not-monotonic"
  | "source-identity-conflict"
  | "internal-invalid-transaction"
  | "invalid-selection";

export type LayerDocumentSourceTransactionResult =
  | {
      readonly ok: true;
      readonly transaction: LayerDocumentSourceTransaction;
    }
  | {
      readonly ok: false;
      readonly project: LayerDocumentProject;
      readonly error: {
        readonly code: LayerDocumentSourceTransactionErrorCode;
        readonly message: string;
      };
    };

export interface ImportSourceRegistryCommand {
  readonly sources: readonly SourceRegistryRecord[];
  readonly layers: readonly LayerDocument[];
  readonly selectSourceId: string;
  readonly selectLayerDocumentId: string | null;
}

export interface RefreshSourceRegistryCommand {
  readonly source: SourceRegistryRecord;
  readonly cacheContext: SourceRegistryCacheInvalidationContext;
}

export interface ReconnectSourceRegistryCommand {
  readonly source: SourceRegistryRecord;
  readonly cacheContext: SourceRegistryCacheInvalidationContext;
}

export interface RefreshPsdSourceRegistryCommand {
  readonly documentSource: PsdDocumentSourceRecord;
  readonly nodeSources: readonly PsdNodeSourceRecord[];
  readonly cacheContext: SourceRegistryCacheInvalidationContext;
}

export interface DiscoverPsdSourceNodesCommand {
  readonly sources: readonly SourceRegistryRecord[];
}

export interface DeleteSourceRegistryCommand {
  readonly sourceId: string;
}

export interface LayerDocumentSourcePreparationPort {
  readonly query: {
    readonly readTree: (options: {
      project: LayerDocumentProject;
      selection: PsdTreeSourceSelection | null;
      resolution: LayerDocumentSourceRuntimeResolutionReadPort;
    }) => PsdSourceTreeReadModel;
  };
  readonly commands: {
    readonly prepareImport: (
      project: LayerDocumentProject,
      command: ImportSourceRegistryCommand
    ) => LayerDocumentSourceTransactionResult;
    readonly prepareRefresh: (
      project: LayerDocumentProject,
      command: RefreshSourceRegistryCommand
    ) => LayerDocumentSourceTransactionResult;
    /**
     * Official PSD product refresh preparation. Applies one document and all
     * supplied node updates/discoveries/status changes atomically.
     */
    readonly preparePsdRefresh: (
      project: LayerDocumentProject,
      command: RefreshPsdSourceRegistryCommand
    ) => LayerDocumentSourceTransactionResult;
    readonly prepareReconnect: (
      project: LayerDocumentProject,
      command: ReconnectSourceRegistryCommand
    ) => LayerDocumentSourceTransactionResult;
    readonly prepareDiscovery: (
      project: LayerDocumentProject,
      command: DiscoverPsdSourceNodesCommand
    ) => LayerDocumentSourceTransactionResult;
    readonly prepareDelete: (
      project: LayerDocumentProject,
      command: DeleteSourceRegistryCommand
    ) => LayerDocumentSourceTransactionResult;
  };
}
