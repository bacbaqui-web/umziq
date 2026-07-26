import type {
  LayerDocumentProject,
  LayerDocumentType,
  LayerEffect,
  LayerModifier,
  SourceRegistryKind,
  SourceRegistryRecord,
} from "@/models";
import type {
  EvaluatedScene,
  EvaluatedSceneSize,
  EvaluatedSceneTransform,
} from "@/engines/playback-render/models/evaluatedSceneModel";
import type {
  EditorPlaceholderDescriptor,
} from "@/engines/playback-render/models/editorPlaceholderModel";
import type {
  PreviewSceneTransformPatch,
} from "@/engines/playback-render/helpers/previewSceneUpdateHelpers";
import type {
  MotionPathSample,
} from "@/engines/animation";

export interface LayerDocumentRuntimeTarget {
  readonly kind: "layer-document";
  readonly layerDocumentId: string;
}

export interface LayerDocumentSourceResourceCacheKeyInput {
  readonly sourceId: string;
  readonly sourceKind: SourceRegistryKind;
  readonly visualKeyPolicy: LayerDocumentSourceVisualKeyPolicy;
  readonly sourceVersion: number;
  readonly sourceFingerprint: string | null;
  readonly localFrame: number;
  readonly quality: string;
}

/**
 * Static PSD pixels use one Source visual revision across placement frames and
 * renderer qualities. Future time-varying sources must opt into sampled keys.
 */
export type LayerDocumentSourceVisualKeyPolicy =
  | "static-source-visual-revision"
  | "timed-frame-quality-sample";

export interface LayerDocumentResultCacheKeyInput {
  readonly layerDocumentId: string;
  readonly revision: number;
  readonly globalFrame: number;
  readonly localFrame: number;
  readonly quality: string;
  readonly sourceResourceCacheKey: string | null;
  readonly draftIdentity: string | null;
}

export interface LayerDocumentVisualResultCacheKeyInput {
  readonly layerDocumentId: string;
  readonly sourceType: LayerDocumentType;
  readonly sourceResourceCacheKey: string | null;
  readonly order: number;
  readonly evaluatedTransform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly effects: readonly LayerEffect[];
  readonly modifiers: readonly LayerModifier[];
  readonly contentIdentity: unknown;
}

export interface LayerDocumentPsdSourceResolution {
  readonly renderItemId: string;
  readonly drawableId: string;
  readonly logicalSize: EvaluatedSceneSize;
}

export interface LayerDocumentPsdSourceResolutionRequest {
  readonly sourceId: string;
  readonly source: SourceRegistryRecord;
  readonly localFrame: number;
  readonly quality: string;
  readonly sourceResourceCacheKey: string;
}

export type LayerDocumentPsdSourceResolver = (
  request: LayerDocumentPsdSourceResolutionRequest
) => LayerDocumentPsdSourceResolution | null;

export type LayerDocumentSourceResolutionStatusReader = (
  sourceId: string
) =>
  | "unresolved"
  | "resolving"
  | "available"
  | "missing"
  | "error";

export type LayerDocumentRuntimeContentDescriptor =
  | {
      readonly kind: "drawable";
      readonly resolution: LayerDocumentPsdSourceResolution;
    }
  | {
      readonly kind: "composition";
      readonly size: EvaluatedSceneSize;
    }
  | {
      readonly kind: "placeholder";
      readonly placeholder: EditorPlaceholderDescriptor;
    }
  | {
      readonly kind: "unavailable";
      readonly reason:
        | "missing-source"
        | "source-unavailable"
        | "resolver-miss";
    }
  | {
      readonly kind: "unsupported";
      readonly layerType: "video" | "shape" | "unknown";
    };

export interface LayerDocumentRuntimeInput {
  readonly target: LayerDocumentRuntimeTarget;
  readonly layerDocumentId: string;
  readonly sourceId: string | null;
  readonly type: LayerDocumentType;
  readonly revision: number;
  readonly label: string;
  readonly globalFrame: number;
  readonly localFrame: number;
  readonly order: number;
  readonly evaluatedTransform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly effects: readonly LayerEffect[];
  readonly modifiers: readonly LayerModifier[];
  readonly content: LayerDocumentRuntimeContentDescriptor;
  readonly sourceResourceCacheKey: string | null;
  readonly evaluationIdentity: string;
  readonly layerResultCacheKey: string;
  readonly draftIdentity: string | null;
  readonly draftApplied: boolean;
}

export interface LayerDocumentTransformDraftSnapshot {
  readonly target: LayerDocumentRuntimeTarget;
  readonly layerDocumentId: string;
  readonly globalFrame: number;
  readonly localFrame: number;
  readonly patch: PreviewSceneTransformPatch;
  readonly evaluatedTransform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly identity: string;
}

export interface LayerDocumentTransformCommitIntent {
  readonly kind: "commit-layer-document-transform";
  readonly layerDocumentId: string;
  readonly globalFrame: number;
  readonly localFrame: number;
  readonly patch: PreviewSceneTransformPatch;
}

export type LayerDocumentDraftInteractionPreparation =
  | {
      readonly kind: "pointer-move";
      readonly draft: LayerDocumentTransformDraftSnapshot;
      readonly projectUpdateCount: 0;
      readonly transactionCount: 0;
      readonly historyEntryCount: 0;
    }
  | {
      readonly kind: "pointer-up";
      readonly draft: null;
      readonly commitIntent: LayerDocumentTransformCommitIntent;
      readonly projectUpdateCount: 0;
      readonly transactionCount: 1;
      readonly historyEntryCount: 1;
    };

export interface LayerDocumentRuntimeTargetConsumerReadModel {
  readonly target: LayerDocumentRuntimeTarget;
  readonly evaluatedTransform: EvaluatedSceneTransform;
  readonly opacity: number;
}

export interface LayerDocumentRuntimeTargetReadModel {
  readonly target: LayerDocumentRuntimeTarget;
  readonly layerDocumentId: string;
  readonly sourceId: string | null;
  readonly globalFrame: number;
  readonly localFrame: number;
  readonly evaluatedTransform: EvaluatedSceneTransform;
  readonly opacity: number;
  readonly directSelection: LayerDocumentRuntimeTargetConsumerReadModel;
  readonly glow: LayerDocumentRuntimeTargetConsumerReadModel & {
    readonly sourceResourceCacheKey: string | null;
  };
  readonly gizmo: LayerDocumentRuntimeTargetConsumerReadModel;
  readonly motionPath: LayerDocumentRuntimeTargetConsumerReadModel & {
    readonly samples: readonly MotionPathSample[];
  };
}

export interface LayerDocumentRuntimeReadModel {
  readonly scene: EvaluatedScene;
  readonly inputs: readonly LayerDocumentRuntimeInput[];
  readonly targets: readonly LayerDocumentRuntimeTargetReadModel[];
  readonly unsupportedLayerDocumentIds: readonly string[];
}

export type LayerDocumentRuntimeReadModelResult =
  | {
      readonly ok: true;
      readonly model: LayerDocumentRuntimeReadModel;
    }
  | {
      readonly ok: false;
      readonly reason: "invalid-project" | "root-not-found";
    };

export interface LayerDocumentRuntimePreparationQueryPort {
  readonly readProject: () => LayerDocumentProject;
  readonly readDraft: () => LayerDocumentTransformDraftSnapshot | null;
  readonly resolvePsdSource: LayerDocumentPsdSourceResolver;
  readonly readSourceResolutionStatus:
    LayerDocumentSourceResolutionStatusReader;
}

/**
 * Task 9 preparation contract only. No State owner, draft publication,
 * transaction commit, History implementation, or Legacy projection exists.
 */
export interface LayerDocumentRuntimeCutoverPreparationPort {
  readonly query: LayerDocumentRuntimePreparationQueryPort;
  readonly buildReadModel: (options: {
    project: LayerDocumentProject;
    activeGroupLayerDocumentId?: string | null;
    globalFrame: number;
    quality: string;
    draft?: LayerDocumentTransformDraftSnapshot | null;
    resolvePsdSource: LayerDocumentPsdSourceResolver;
    readSourceResolutionStatus:
      LayerDocumentSourceResolutionStatusReader;
  }) => LayerDocumentRuntimeReadModelResult;
  readonly preparePointerMove: (
    input: LayerDocumentRuntimeInput,
    patch: PreviewSceneTransformPatch
  ) => LayerDocumentDraftInteractionPreparation;
  readonly preparePointerUp: (
    draft: LayerDocumentTransformDraftSnapshot
  ) => LayerDocumentDraftInteractionPreparation;
}
