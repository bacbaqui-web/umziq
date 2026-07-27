import type { Position, Scale } from "@/models";
import type {
  LayerDocumentDraftInteractionPreparation,
  LayerDocumentRuntimeInput,
  LayerDocumentEditorFrameReadModelResult,
  LayerDocumentRuntimeTarget,
  LayerDocumentRuntimeTargetReadModel,
  LayerDocumentSourceSamplingQuality,
  PreviewScene,
  PreviewSceneTransformPatch,
  RenderDrawableSource,
  RenderNodeVisualResolver,
  RuntimeMetricRecordPort,
} from "@/render";
import type {
  CanvasSelectionProjection,
} from "@/engines/canvas/models/canvasDirectSelectionModel";
import type {
  CanvasSelectionReadModel,
  CanvasSize,
} from "@/engines/canvas/models/canvasEngineModel";
import type {
  SelectionSourceAlphaDescriptor,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";
import type {
  PreviewMotionPathPoint,
} from "@/engines/canvas/models/canvasViewModel";
import type {
  ResolvedPreviewQuality,
} from "@/engines/canvas/models/previewQualityModel";

export interface LayerDocumentCanvasRenderAsset {
  readonly source: RenderDrawableSource;
  readonly alphaCanvas: HTMLCanvasElement | null;
  readonly sourceVisualIdentity: string;
}

export interface LayerDocumentCanvasRenderAssetRequest {
  readonly layerDocumentId: string;
  readonly sourceId: string;
  readonly sourceResourceCacheKey: string;
  readonly renderItemId: string;
  readonly drawableId: string;
  readonly logicalSize: CanvasSize;
}

export interface LayerDocumentCanvasRenderAssetPort {
  readonly resolve: (
    request: LayerDocumentCanvasRenderAssetRequest
  ) => LayerDocumentCanvasRenderAsset | null;
}

export type LayerDocumentCanvasDirectSelectionCandidate =
  | {
      readonly status: "ready";
      readonly sceneNodeIndex: number;
      readonly layerDocumentId: string;
      readonly targetKind: "layer" | "group";
      readonly sourceId: string | null;
      readonly sourceResourceCacheKey: string | null;
      readonly target: LayerDocumentRuntimeTarget;
      readonly projection: CanvasSelectionProjection;
      readonly descriptor: SelectionSourceAlphaDescriptor;
    }
  | {
      readonly status: "blocked";
      readonly reason:
        | "missing-runtime-target"
        | "missing-render-asset";
      readonly sceneNodeIndex: number;
      readonly layerDocumentId: string;
      readonly targetKind: "layer" | "group";
      readonly sourceId: string | null;
      readonly sourceResourceCacheKey: string | null;
      readonly target: LayerDocumentRuntimeTarget | null;
      readonly projection: CanvasSelectionProjection;
    };

export type LayerDocumentCanvasDirectSelectionHit =
  | {
      readonly status: "hit";
      readonly candidate: Extract<
        LayerDocumentCanvasDirectSelectionCandidate,
        { status: "ready" }
      >;
    }
  | {
      readonly status: "blocked";
      readonly candidate: LayerDocumentCanvasDirectSelectionCandidate;
    }
  | { readonly status: "none" };

export type LayerDocumentCanvasDirectSelectionIntent =
  | { readonly type: "drag"; readonly layerDocumentId: string }
  | { readonly type: "select"; readonly layerDocumentId: string }
  | { readonly type: "clear" }
  | { readonly type: "preserve" };

export interface LayerDocumentCanvasViewportInput {
  readonly previewSize: CanvasSize;
  readonly viewportScale: number;
  readonly viewportOffset: Position;
}

export interface LayerDocumentCanvasSceneDescriptor {
  readonly layerDocumentId: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly frameRate: number;
  readonly durationFrames: number;
}

export interface LayerDocumentCanvasReadInput {
  readonly activeScene: LayerDocumentCanvasSceneDescriptor;
  readonly runtime: LayerDocumentEditorFrameReadModelResult;
  readonly selectedLayerDocumentId: string | null;
  readonly previewQuality:
    ResolvedPreviewQuality;
  readonly viewport: LayerDocumentCanvasViewportInput;
  readonly renderAssets: LayerDocumentCanvasRenderAssetPort;
  readonly previousPreviewScene?: PreviewScene | null;
  readonly runtimeMetrics?: RuntimeMetricRecordPort;
}

export interface LayerDocumentCanvasRendererReadModel {
  readonly previewScene: PreviewScene;
  readonly resolveNodeVisual: RenderNodeVisualResolver;
}

export interface LayerDocumentCanvasReadModel {
  readonly activeScene: LayerDocumentCanvasSceneDescriptor;
  readonly viewport: LayerDocumentCanvasViewportInput;
  readonly previewWorkspaceScene: {
    readonly identity: string;
    readonly width: number;
    readonly height: number;
  };
  readonly selectedLayerDocumentId: string | null;
  readonly selectedInput: LayerDocumentRuntimeInput | null;
  readonly selectedTarget: LayerDocumentRuntimeTargetReadModel | null;
  readonly renderer: LayerDocumentCanvasRendererReadModel;
  readonly selection: CanvasSelectionReadModel;
  readonly motionPath: readonly PreviewMotionPathPoint[];
  readonly motionPathCurrentPoint: PreviewMotionPathPoint | null;
  readonly directSelectionCandidates:
    readonly LayerDocumentCanvasDirectSelectionCandidate[];
  readonly selectedHighlightCandidate:
    Extract<
      LayerDocumentCanvasDirectSelectionCandidate,
      { status: "ready" }
    > | null;
  readonly hoverSuppressedDuringTransform: boolean;
  readonly sourceResourceCacheKey: string | null;
  readonly layerResultCacheKey: string | null;
}

export type LayerDocumentCanvasReadResult =
  | {
      readonly ok: true;
      readonly model: LayerDocumentCanvasReadModel;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "runtime-unavailable"
        | "scene-identity-mismatch";
    };

export type LayerDocumentCanvasTransformHandle =
  | "position"
  | "scale-x"
  | "scale-y"
  | "scale-xy"
  | "rotation"
  | "opacity"
  | "anchor"
  | "transform-offset";

export type LayerDocumentCanvasHandleDraft =
  | {
      readonly handle: "position";
      readonly value: Position;
    }
  | {
      readonly handle: "scale-x" | "scale-y" | "scale-xy";
      readonly value: Scale;
    }
  | {
      readonly handle: "rotation" | "opacity";
      readonly value: number;
    }
  | {
      readonly handle: "anchor";
      readonly value: {
        readonly anchor: Position;
        readonly transformOffset: Position;
      };
    }
  | {
      readonly handle: "transform-offset";
      readonly value: Position;
    };

export interface LayerDocumentCanvasSemanticKeyframeCommand {
  readonly kind: "upsert-position-keyframe";
  readonly layerDocumentId: string;
  readonly globalFrame: number;
  readonly localFrame: number;
  readonly value: Position;
}

export interface LayerDocumentCanvasKeyframeSelectionCommand {
  readonly layerDocumentId: string;
  readonly globalFrame: number;
  readonly localFrame: number;
}

export interface LayerDocumentCanvasMotionPathDraftPreparation {
  readonly kind: "motion-path-keyframe-draft";
  readonly layerDocumentId: string;
  readonly globalFrame: number;
  readonly localFrame: number;
  readonly value: Position;
  readonly projectUpdateCount: 0;
  readonly transactionCount: 0;
  readonly historyEntryCount: 0;
}

export interface LayerDocumentCanvasCommandPort<
  TCommitResult = unknown,
  TSelectionResult = unknown,
  TKeyframeResult = unknown,
> {
  readonly pointerMove: (options: {
    layerDocumentId: string;
    patch: PreviewSceneTransformPatch;
    sourceSamplingQuality:
      LayerDocumentSourceSamplingQuality;
  }) => LayerDocumentDraftInteractionPreparation | null;
  readonly pointerUp: () => TCommitResult;
  readonly cancelDraft: () => void;
  readonly directSelect: (
    layerDocumentId: string | null
  ) => TSelectionResult;
  readonly enterGroup: (
    layerDocumentId: string
  ) => TSelectionResult;
  /**
   * Required Canvas-native semantic boundary. A caller must not route this
   * through deprecated animation commands.
   */
  readonly publishMotionPathKeyframeDraft:
    (command: LayerDocumentCanvasSemanticKeyframeCommand) =>
      LayerDocumentCanvasMotionPathDraftPreparation | null;
  readonly commitMotionPathKeyframeDraft: () =>
    TKeyframeResult;
  readonly cancelMotionPathKeyframeDraft: () => void;
  readonly selectMotionPathKeyframe: (
    command: LayerDocumentCanvasKeyframeSelectionCommand
  ) => TSelectionResult;
  readonly seekFrame: (globalFrame: number) => void;
}

export interface LayerDocumentCanvasCommands<
  TCommitResult = unknown,
  TSelectionResult = unknown,
  TKeyframeResult = unknown,
> {
  readonly updateHandleDraft: (
    draft: LayerDocumentCanvasHandleDraft
  ) => LayerDocumentDraftInteractionPreparation | null;
  readonly commitDraft: () => TCommitResult;
  readonly cancelDraft: () => void;
  readonly directSelect: (
    layerDocumentId: string | null
  ) => TSelectionResult;
  readonly enterGroup: (
    layerDocumentId: string
  ) => TSelectionResult;
  readonly publishMotionPathKeyframeDraft:
    (command: LayerDocumentCanvasSemanticKeyframeCommand) =>
      LayerDocumentCanvasMotionPathDraftPreparation | null;
  readonly commitMotionPathKeyframeDraft: () =>
    TKeyframeResult;
  readonly cancelMotionPathKeyframeDraft: () => void;
  readonly selectMotionPathKeyframe: (
    command: LayerDocumentCanvasKeyframeSelectionCommand
  ) => TSelectionResult;
  readonly seekFrame: (globalFrame: number) => void;
}
