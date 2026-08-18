import type { LayerModifier } from "@/models/layerDocumentModel";
import type { LayerDocumentTransformProperty } from "@/models/layerDocumentTransactionModel";

export type LayerDocumentTimelineIntent =
  | {
      kind: "set-modifiers";
      layerDocumentId: string;
      modifiers: LayerModifier[];
    }
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
