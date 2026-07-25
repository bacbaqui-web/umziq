import type {
  LayerDocumentProject,
} from "@/models/layerDocumentModel";
import type {
  LayerDocumentSelection,
  LayerDocumentSelectionNormalization,
  StaleLayerDocumentSelectionPolicy,
} from "@/models/layerDocumentSelectionModel";
import type {
  LayerDocumentTimelineReadModelResult,
  LayerDocumentTimelineRootRowPolicy,
} from "@/models/layerDocumentTimelineReadModel";
import type {
  LayerDocumentTransactionResult,
  LayerDocumentTransformProperty,
} from "@/models/layerDocumentTransactionModel";

export type LayerDocumentTimelineIntent =
  | {
      kind: "set-timing";
      layerDocumentId: string;
      startFrame: number;
      durationFrames: number;
      sourceOffsetFrames: number;
    }
  | {
      kind: "set-visibility";
      layerDocumentId: string;
      visible: boolean;
    }
  | {
      kind: "set-alias";
      layerDocumentId: string;
      alias: string | null;
    }
  | {
      kind: "rename-layer";
      layerDocumentId: string;
      name: string;
    }
  | {
      kind: "delete-layer";
      layerDocumentId: string;
    }
  | {
      kind: "duplicate-layer";
      layerDocumentId: string;
      newLayerDocumentId: string;
    }
  | {
      kind: "move-layer";
      layerDocumentId: string;
      newParentLayerDocumentId: string;
      newOrder: number;
    }
  | {
      kind: "split-layer";
      layerDocumentId: string;
      newLayerDocumentId: string;
      splitGlobalFrame: number;
    }
  | {
      kind: "move-keyframe";
      layerDocumentId: string;
      property: LayerDocumentTransformProperty;
      fromLocalFrame: number;
      toLocalFrame: number;
    }
  | {
      kind: "remove-keyframe";
      layerDocumentId: string;
      property: LayerDocumentTransformProperty;
      localFrame: number;
    }
  | {
      kind: "set-group-duration";
      layerDocumentId: string;
      durationFrames: number;
    };

export interface LayerDocumentTimelineQueryPort {
  readProject: () => LayerDocumentProject;
  readSelection: () => LayerDocumentSelection | null;
}

/**
 * Public Task 9 preparation boundary. Task 5 defines only pure read,
 * selection-normalization, and intent-building contracts; it provides no
 * Store owner, commit method, Runtime projection, or product connection.
 */
export interface LayerDocumentTimelineCutoverPreparationPort {
  query: LayerDocumentTimelineQueryPort;
  normalizeSelection: (
    project: LayerDocumentProject,
    selection: LayerDocumentSelection | null,
    stalePolicy?: StaleLayerDocumentSelectionPolicy
  ) => LayerDocumentSelectionNormalization;
  buildReadModel: (
    project: LayerDocumentProject,
    rootRowPolicy?: LayerDocumentTimelineRootRowPolicy
  ) => LayerDocumentTimelineReadModelResult;
  buildIntentTransaction: (
    project: LayerDocumentProject,
    intent: LayerDocumentTimelineIntent
  ) => LayerDocumentTransactionResult;
}
