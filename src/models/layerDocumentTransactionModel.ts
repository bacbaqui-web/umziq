import type {
  DrawingLayerData,
  GroupLayerData,
  LayerAnimation,
  LayerDocument,
  LayerDocumentProject,
  LayerEffect,
  LayerModifier,
  LayerTransform,
  ShapeLayerData,
  TextLayerData,
  UnknownLayerData,
} from "@/models/layerDocumentModel";
import type {
  Position,
  Scale,
} from "@/models/transformModel";
import type {
  LayerDocumentValidationIssue,
} from "@/models/layerDocumentValidation";

export type LayerDocumentTransactionKind =
  | "create-layer"
  | "delete-layer"
  | "duplicate-layer"
  | "replace-source"
  | "move-group"
  | "move-layer"
  | "split-layer"
  | "set-name"
  | "update-common"
  | "update-domain";

export type LayerDocumentSelectionChange =
  | {
      kind: "select";
      layerDocumentId: string;
    }
  | {
      kind: "clear";
    }
  | {
      kind: "preserve";
    };

export interface LayerDocumentHistoryEntry {
  label: string;
  /**
   * Deterministic, duplicate-free IDs for every created, deleted, or
   * semantically modified Layer. Derived at transaction completion.
   */
  affectedLayerDocumentIds: string[];
}

export interface LayerDocumentTransaction {
  kind: LayerDocumentTransactionKind;
  before: LayerDocumentProject;
  after: LayerDocumentProject;
  selectionChange: LayerDocumentSelectionChange;
  /** One user command produces exactly this one Plain Data history outcome. */
  historyEntry: LayerDocumentHistoryEntry;
  createdLayerDocumentIds: string[];
  deletedLayerDocumentIds: string[];
}

/**
 * A command whose normalized stored Layer values equal the input fails with
 * no-change. It produces no transaction and therefore no History entry.
 */
export type LayerDocumentTransactionErrorCode =
  | "invalid-before"
  | "invalid-after"
  | "invalid-command"
  | "no-change"
  | "layer-not-found"
  | "parent-group-not-found"
  | "layer-id-conflict"
  | "root-operation-forbidden"
  | "target-not-group"
  | "cycle-detected"
  | "source-not-found"
  | "domain-type-mismatch";

export interface LayerDocumentTransactionError {
  code: LayerDocumentTransactionErrorCode;
  message: string;
  validationIssues: LayerDocumentValidationIssue[];
}

export type LayerDocumentTransactionResult =
  | {
      ok: true;
      transaction: LayerDocumentTransaction;
    }
  | {
      ok: false;
      project: LayerDocumentProject;
      error: LayerDocumentTransactionError;
    };

export interface CreateLayerDocumentCommand {
  /**
   * A complete new Layer Document. Its Placement parent/order is treated as
   * insertion intent and normalized with the target siblings.
   */
  layer: LayerDocument;
}

export interface DeleteLayerDocumentCommand {
  layerDocumentId: string;
}

export interface DuplicateLayerDocumentCommand {
  layerDocumentId: string;
  /**
   * The duplicate root uses this ID; descendant IDs are derived without
   * collisions. Every duplicated Layer starts a new revision line at zero.
   */
  newLayerDocumentId: string;
}

export interface ReplaceLayerDocumentSourceCommand {
  layerDocumentId: string;
  /**
   * Only common.source changes. A successful replacement increments the
   * target Layer revision by one and leaves Source Registry records untouched.
   */
  sourceId: string | null;
}

export interface MoveGroupLayerDocumentCommand {
  layerDocumentId: string;
  newParentLayerDocumentId: string;
  newOrder: number;
}

export interface MoveLayerDocumentCommand {
  layerDocumentId: string;
  newParentLayerDocumentId: string;
  newOrder: number;
}

export interface SplitLayerDocumentCommand {
  layerDocumentId: string;
  newLayerDocumentId: string;
  splitGlobalFrame: number;
}

export type LayerDocumentTransformProperty =
  | "position"
  | "scale"
  | "rotation"
  | "opacity";

export interface MoveLayerDocumentKeyframeCommand {
  layerDocumentId: string;
  property: LayerDocumentTransformProperty;
  fromLocalFrame: number;
  toLocalFrame: number;
}

export interface RemoveLayerDocumentKeyframeCommand {
  layerDocumentId: string;
  property: LayerDocumentTransformProperty;
  localFrame: number;
}

export interface SetLayerDocumentNameCommand {
  layerDocumentId: string;
  /**
   * The transaction trims this Layer-owned edit name and rejects an empty
   * result. Placement alias remains unchanged and continues to override name
   * only at display time.
   */
  name: string;
}

export type LayerDocumentCommonUpdate =
  | {
      kind: "set-transform";
      transform: LayerTransform;
    }
  | {
      /**
       * Applies one visible transform edit atomically. Enabled properties
       * upsert a keyframe at localFrame; disabled properties update the base
       * transform. Anchor and transformOffset are always base values.
       */
      kind: "commit-transform";
      localFrame: number;
      patch: {
        position?: Position;
        transformOffset?: Position;
        anchor?: Position;
        scale?: Scale;
        rotation?: number;
        opacity?: number;
      };
    }
  | {
      /**
       * Motion Path semantic edit: always owns a position keyframe at the
       * requested local frame and enables the position track.
       */
      kind: "upsert-position-keyframe";
      localFrame: number;
      value: Position;
    }
  | {
      kind: "set-placement-timing";
      startFrame: number;
      durationFrames: number;
      sourceOffsetFrames: number;
    }
  | {
      kind: "set-visibility";
      visible: boolean;
    }
  | {
      kind: "set-lock";
      locked: boolean;
    }
  | {
      kind: "set-alias";
      alias: string | null;
    }
  | {
      kind: "set-animation";
      animation: LayerAnimation;
    }
  | {
      kind: "set-effects";
      effects: LayerEffect[];
    }
  | {
      kind: "set-modifiers";
      modifiers: LayerModifier[];
    };

export interface UpdateLayerDocumentCommonCommand {
  layerDocumentId: string;
  /** Successful semantic common updates increment revision by one. */
  update: LayerDocumentCommonUpdate;
}

export type LayerDocumentDomainUpdate =
  | {
      kind: "replace-drawing-document";
      data: DrawingLayerData;
    }
  | {
      kind: "replace-text-document";
      data: TextLayerData;
    }
  | {
      kind: "replace-shape-document";
      data: ShapeLayerData;
    }
  | {
      kind: "set-group-composition-metadata";
      data: Omit<GroupLayerData, "role">;
    }
  | {
      kind: "replace-unknown-payload";
      data: UnknownLayerData;
    };

export interface UpdateLayerDocumentDomainCommand {
  layerDocumentId: string;
  /** Successful type-matched domain updates increment revision by one. */
  update: LayerDocumentDomainUpdate;
}
