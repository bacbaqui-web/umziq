import type {
  LayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentNexusEffect,
  LayerDocumentNexusPort,
  LayerDocumentNexusTransitionResult,
  NexusProjectReadPort,
  NexusReplacePort,
} from "@/engines/project/models/layerDocumentNexusModel";

export type LayerDocumentProjectDocumentState =
  | "untitled"
  | "file-backed";
export type LayerDocumentProjectDirtyState =
  | "clean"
  | "dirty";
export type LayerDocumentProjectOperationState =
  | "idle"
  | "saving"
  | "loading";

export interface LayerDocumentProjectOperationToken {
  readonly sequence: number;
  readonly operation: Exclude<
    LayerDocumentProjectOperationState,
    "idle"
  >;
}

export interface LayerDocumentProjectLifecycleState {
  readonly document: LayerDocumentProjectDocumentState;
  readonly dirty: LayerDocumentProjectDirtyState;
  readonly operation: LayerDocumentProjectOperationState;
  readonly operationToken:
    LayerDocumentProjectOperationToken | null;
  readonly savepointDigest: string | null;
  readonly currentProjectDigest: string;
}

export interface LayerDocumentProjectLifecycleRuntimePort {
  readonly clearDraft: () => void;
  readonly resetLocalUi: () => void;
  readonly stopPlayback: () => void;
  readonly invalidateSourceRuntime: (
    invalidation: { readonly kind: "all" }
  ) => number;
  readonly resetSourceResolution: () => void;
  readonly recomputeRender?: () => void;
  readonly publishNexusEffect?: (
    effect: LayerDocumentNexusEffect
  ) => void;
}

export type LayerDocumentProjectLifecycleErrorCode =
  | "invalid-project"
  | "stale-operation"
  | "nexus-rejected";

export type LayerDocumentProjectLifecycleResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          LayerDocumentProjectLifecycleErrorCode;
        readonly message: string;
      };
    };

export interface ReplaceLayerDocumentProjectOptions {
  readonly project: LayerDocumentProject;
  readonly document: LayerDocumentProjectDocumentState;
  readonly token?: LayerDocumentProjectOperationToken;
}

export interface MarkLayerDocumentProjectSavedOptions {
  readonly savedSnapshot: LayerDocumentProject;
  readonly token?: LayerDocumentProjectOperationToken;
}

export interface LayerDocumentProjectLifecycleController {
  readonly read: () => LayerDocumentProjectLifecycleState;
  readonly beginOperation: (
    operation: Exclude<
      LayerDocumentProjectOperationState,
      "idle"
    >
  ) => LayerDocumentProjectOperationToken;
  readonly finishOperation: (
    token: LayerDocumentProjectOperationToken
  ) => boolean;
  readonly replaceProject: (
    options: ReplaceLayerDocumentProjectOptions
  ) => LayerDocumentProjectLifecycleResult<
    Extract<
      LayerDocumentNexusTransitionResult,
      { ok: true }
    >
  >;
  readonly markSaved: (
    options: MarkLayerDocumentProjectSavedOptions
  ) => LayerDocumentProjectLifecycleResult<
    LayerDocumentProjectLifecycleState
  >;
}

export interface CreateLayerDocumentProjectLifecycleOptions {
  readonly nexus: NexusProjectReadPort &
    (
      | NexusReplacePort
      | Pick<LayerDocumentNexusPort, "transition">
    );
  readonly runtime:
    LayerDocumentProjectLifecycleRuntimePort;
  readonly document?:
    LayerDocumentProjectDocumentState;
  readonly initiallyClean?: boolean;
}
