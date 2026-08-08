import type {
  AudioLayerData,
  DrawingLayerData,
  GroupLayerData,
  LayerAnimation,
  LayerDocumentProject,
  LayerDocumentTransaction,
  LayerDocumentTransactionErrorCode,
  LayerDocumentType,
  LayerEffect,
  LayerModifier,
  LayerTransform,
  Position,
  PsdLayerData,
  ShapeLayerData,
  SourceRegistryKind,
  SourceRegistryRefreshStatus,
  TextLayerData,
  UnknownLayerData,
  VideoLayerData,
} from "@/models";
import type {
  LayerDocumentTransformCommitIntent,
} from "@/render";

export type LayerDocumentPropertiesCapabilityStatus =
  | "editable"
  | "read-only"
  | "unsupported"
  | "future";

export interface LayerDocumentPropertiesCapability {
  readonly status: LayerDocumentPropertiesCapabilityStatus;
  readonly reason: string;
}

export interface LayerDocumentPropertiesCapabilities {
  readonly transform: LayerDocumentPropertiesCapability;
  readonly transformInputs: {
    readonly position: LayerDocumentPropertiesCapability;
    readonly scale: LayerDocumentPropertiesCapability;
    readonly rotation: LayerDocumentPropertiesCapability;
    readonly opacity: LayerDocumentPropertiesCapability;
    readonly anchor: LayerDocumentPropertiesCapability;
  };
  readonly placement: LayerDocumentPropertiesCapability;
  readonly animation: LayerDocumentPropertiesCapability;
  readonly effects: LayerDocumentPropertiesCapability;
  readonly modifiers: LayerDocumentPropertiesCapability;
  readonly domain: LayerDocumentPropertiesCapability & {
    readonly type: LayerDocumentType;
  };
}

export type LayerDocumentPropertiesSourceDescriptor =
  | {
      readonly referenceStatus: "none";
      readonly sourceId: null;
      readonly resolutionStatus: null;
      readonly displayName: null;
      readonly path: null;
      readonly kind: null;
      readonly refreshStatus: null;
    }
  | {
      readonly referenceStatus: "unresolved";
      readonly sourceId: string;
      readonly resolutionStatus: "missing";
      readonly displayName: null;
      readonly path: null;
      readonly kind: null;
      readonly refreshStatus: null;
    }
  | {
      readonly referenceStatus: "resolved";
      readonly sourceId: string;
      readonly resolutionStatus:
        | "unresolved"
        | "resolving"
        | "available"
        | "missing"
        | "error";
      readonly displayName: string;
      readonly path: string | null;
      readonly kind: SourceRegistryKind;
      readonly refreshStatus: SourceRegistryRefreshStatus;
    };

export type LayerDocumentPropertiesTypeData =
  | { readonly kind: "psd"; readonly data: PsdLayerData }
  | { readonly kind: "drawing"; readonly data: DrawingLayerData }
  | { readonly kind: "text"; readonly data: TextLayerData }
  | {
      readonly kind: "audio";
      readonly data: AudioLayerData;
      readonly dataSchema: "empty";
    }
  | {
      readonly kind: "video";
      readonly data: VideoLayerData;
      readonly dataSchema: "empty";
    }
  | { readonly kind: "shape"; readonly data: ShapeLayerData }
  | { readonly kind: "group"; readonly data: GroupLayerData }
  | { readonly kind: "unknown"; readonly data: UnknownLayerData };

export interface LayerDocumentPropertiesPlacementSummary {
  readonly parentLayerDocumentId: string | null;
  readonly order: number;
  readonly startFrame: number;
  readonly durationFrames: number;
  readonly endFrameExclusive: number;
  readonly sourceOffsetFrames: number;
  readonly visible: boolean;
}

export interface LayerDocumentPropertiesDescriptor {
  readonly selectedLayerDocumentId: string;
  readonly layerDocumentId: string;
  readonly revision: number;
  readonly type: LayerDocumentType;
  readonly isProjectRoot: boolean;
  readonly name: string;
  readonly alias: string | null;
  readonly displayName: string;
  readonly source: LayerDocumentPropertiesSourceDescriptor;
  readonly transform: LayerTransform;
  readonly placement: LayerDocumentPropertiesPlacementSummary;
  readonly animation: LayerAnimation;
  readonly effects: LayerEffect[];
  readonly modifiers: LayerModifier[];
  readonly typeData: LayerDocumentPropertiesTypeData;
  readonly capabilities: LayerDocumentPropertiesCapabilities;
}

export type LayerDocumentPropertiesDescriptorResult =
  | {
      readonly status: "ready";
      readonly selectedLayerDocumentId: string;
      readonly descriptor: LayerDocumentPropertiesDescriptor;
    }
  | {
      readonly status: "empty";
      readonly selectedLayerDocumentId: string | null;
      readonly reason: "no-selection" | "layer-not-found";
      readonly descriptor: null;
    };

export type LayerDocumentPropertiesCommand =
  | {
      readonly kind: "commit-transform";
      readonly intent: LayerDocumentTransformCommitIntent;
    }
  | {
      readonly kind: "upsert-position-keyframe";
      readonly layerDocumentId: string;
      readonly localFrame: number;
      readonly value: Position;
    }
  | {
      readonly kind: "set-scale-linked";
      readonly layerDocumentId: string;
      readonly scaleLinked: boolean;
    }
  | {
      readonly kind: "set-name";
      readonly layerDocumentId: string;
      readonly name: string;
    }
  | {
      readonly kind: "set-alias";
      readonly layerDocumentId: string;
      readonly alias: string | null;
    }
  | {
      readonly kind: "set-placement-timing";
      readonly layerDocumentId: string;
      readonly startFrame: number;
      readonly durationFrames: number;
      readonly sourceOffsetFrames: number;
    }
  | {
      readonly kind: "set-visibility";
      readonly layerDocumentId: string;
      readonly visible: boolean;
    }
  | {
      readonly kind: "set-animation";
      readonly layerDocumentId: string;
      readonly animation: LayerAnimation;
    }
  | {
      readonly kind: "set-effects";
      readonly layerDocumentId: string;
      readonly effects: LayerEffect[];
    }
  | {
      readonly kind: "set-modifiers";
      readonly layerDocumentId: string;
      readonly modifiers: LayerModifier[];
    }
  | {
      readonly kind: "replace-drawing-document";
      readonly layerDocumentId: string;
      readonly data: DrawingLayerData;
    }
  | {
      readonly kind: "replace-text-document";
      readonly layerDocumentId: string;
      readonly data: TextLayerData;
    }
  | {
      readonly kind: "request-future-domain-update";
      readonly layerDocumentId: string;
      readonly domain: "audio" | "video" | "shape";
    };

export type LayerDocumentPropertiesCommandRejectReason =
  | "no-selection"
  | "layer-not-found"
  | "selection-mismatch"
  | "root-operation-forbidden"
  | "type-mismatch"
  | "unsupported-capability"
  | "no-change"
  | "transaction-error";

export type LayerDocumentPropertiesCommandPreparation =
  | {
      readonly ok: true;
      readonly status: "prepared";
      readonly selectedLayerDocumentId: string;
      readonly layerDocumentId: string;
      readonly transaction: LayerDocumentTransaction;
      readonly projectUpdateCount: 0;
      readonly transactionCount: 1;
      readonly historyEntryCount: 1;
    }
  | {
      readonly ok: false;
      readonly status: "rejected";
      readonly selectedLayerDocumentId: string | null;
      readonly layerDocumentId: string | null;
      readonly reason: LayerDocumentPropertiesCommandRejectReason;
      readonly errorCode: LayerDocumentTransactionErrorCode | null;
      readonly message: string;
      readonly project: LayerDocumentProject;
      readonly projectUpdateCount: 0;
      readonly transactionCount: 0;
      readonly historyEntryCount: 0;
    };
