import type {
  LayerDocument,
  LayerDocumentGroupScopeReadModelResult,
  LayerDocumentProject,
  LayerDocumentTimelineIntent,
  LayerDocumentTimelineSourceReadModel,
  LayerDocumentType,
  PsdTreeSourceSelection,
} from "@/models";
import type {
  LayerDocumentProjectOwnerEffect,
  LayerDocumentProjectOwnerPort,
  LayerDocumentProjectOwnerTransitionResult,
  LayerDocumentSourceStatusIdentity,
  LayerDocumentTransformKeyframeSelection,
  DeleteSourceRegistryCommand,
  DiscoverPsdSourceNodesCommand,
  ImportSourceRegistryCommand,
  ReconnectSourceRegistryCommand,
  RefreshPsdSourceRegistryCommand,
  RefreshSourceRegistryCommand,
  LayerDocumentSourcePreparationPort,
  PreparedLayerDocumentPsdImport,
  PreparedLayerDocumentPsdRefresh,
  LayerDocumentPreparedRuntimeDisposition,
  LayerDocumentSourceRuntimeResolutionPort,
} from "@/engines/project";
import type {
  LayerDocumentDraftInteractionPreparation,
  LayerDocumentPsdRuntimeRegistrationBridge,
  LayerDocumentRuntimeReadModelResult,
  LayerDocumentSourceRuntimeResourcePort,
  LayerDocumentTransformDraftSnapshot,
  PreviewSceneTransformPatch,
  RendererMode,
  RuntimeMetricRecordPort,
  LayerDocumentRuntimeBatchRegistrationResult,
} from "@/engines/playback-render";
import type {
  LayerDocumentPanelCommand,
  LayerDocumentPanelCommandPreparation,
  LayerDocumentPanelDescriptorResult,
  LayerDocumentPanelPreparationPort,
} from "@/engines/properties";
import type {
  LayerDocumentDrawingPreparationPort,
  LayerDocumentDrawingQueryResult,
  ReplaceLayerDocumentDrawingCommand,
} from "@/layer-types";
import type {
  LayerDocumentTextPreparationPort,
  LayerDocumentTextQueryResult,
  ReplaceLayerDocumentTextCommand,
} from "@/layer-types";
import type {
  LayerDocumentAudioPreparationPort,
  LayerDocumentAudioFutureCommand,
  LayerDocumentAudioQueryResult,
  LayerDocumentAudioUnsupportedPreparation,
} from "@/layer-types";
import type {
  PsdSourceTreeReadModel,
} from "@/engines/project";

export interface LayerDocumentCutoverEffectPort {
  readonly applyOwnerEffect: (
    effect: LayerDocumentProjectOwnerEffect
  ) => void;
}

export interface LayerDocumentCutoverDraftSessionPort {
  readonly read: () => LayerDocumentTransformDraftSnapshot | null;
  readonly publish: (
    draft: LayerDocumentTransformDraftSnapshot
  ) => void;
  readonly clear: () => void;
}

export interface LayerDocumentConsumerCutoverInput {
  readonly owner: LayerDocumentProjectOwnerPort;
  readonly panelPreparation:
    LayerDocumentPanelPreparationPort;
  readonly sourcePreparation:
    LayerDocumentSourcePreparationPort;
  readonly drawingPreparation:
    LayerDocumentDrawingPreparationPort;
  readonly textPreparation:
    LayerDocumentTextPreparationPort;
  readonly audioPreparation:
    LayerDocumentAudioPreparationPort;
  readonly sourceRuntime: LayerDocumentSourceRuntimeResourcePort;
  readonly sourceResolution:
    LayerDocumentSourceRuntimeResolutionPort;
  readonly draftSession: LayerDocumentCutoverDraftSessionPort;
  readonly effects: LayerDocumentCutoverEffectPort;
  readonly metrics: RuntimeMetricRecordPort;
}

export type LayerDocumentCutoverCommandResult<TPreparation = unknown> =
  | {
      readonly ok: true;
      readonly transition: Extract<
        LayerDocumentProjectOwnerTransitionResult,
        { ok: true }
      >;
    }
  | {
      readonly ok: false;
      readonly stage: "preparation" | "owner";
      readonly message: string;
      readonly preparation?: TPreparation;
      readonly transition?: Extract<
        LayerDocumentProjectOwnerTransitionResult,
        { ok: false }
      >;
    };

export type LayerDocumentPreparedPsdConfirmResult =
  | {
      readonly ok: true;
      readonly status: "confirmed" | "runtime-registration-retried";
      readonly transition: Extract<
        LayerDocumentProjectOwnerTransitionResult,
        { ok: true }
      > | null;
      readonly registration:
        Extract<
          LayerDocumentRuntimeBatchRegistrationResult,
          { ok: true }
        >;
    }
  | {
      readonly ok: false;
      readonly status: "rejected" | "runtime-registration-pending";
      readonly stage:
        | "lifecycle"
        | "preflight"
        | "preparation"
        | "owner"
        | "runtime-registration";
      readonly message: string;
      readonly recovery:
        | "none"
        | "retry-runtime-registration";
      readonly transition:
        Extract<
          LayerDocumentProjectOwnerTransitionResult,
          { ok: true }
        > | null;
      readonly registration:
        LayerDocumentRuntimeBatchRegistrationResult | null;
    };

export interface LayerDocumentTimelineConsumerRow {
  readonly layerDocumentId: string;
  readonly parentLayerDocumentId: string | null;
  readonly depth: number;
  readonly order: number;
  readonly name: string;
  readonly alias: string | null;
  readonly label: string;
  readonly type: LayerDocumentType;
  readonly sourceId: string | null;
  readonly source:
    (
      LayerDocumentTimelineSourceReadModel & {
        readonly resolutionStatus:
          | "unresolved"
          | "resolving"
          | "available"
          | "missing"
          | "error";
      }
    ) | null;
  readonly startFrame: number;
  readonly durationFrames: number;
  readonly sourceOffsetFrames: number;
  readonly visible: boolean;
  readonly children: readonly LayerDocumentTimelineConsumerRow[];
}

export interface LayerDocumentTimelineConsumerViewProps {
  readonly available: boolean;
  readonly selectedLayerDocumentId: string | null;
  readonly selectedTransformKeyframe:
    LayerDocumentTransformKeyframeSelection | null;
  readonly acknowledgedSourceStatuses:
    readonly LayerDocumentSourceStatusIdentity[];
  readonly scope: LayerDocumentGroupScopeReadModelResult;
  readonly rows: readonly LayerDocumentTimelineConsumerRow[];
  readonly commands: {
    readonly selectLayer: (
      layerDocumentId: string | null
    ) => LayerDocumentCutoverCommandResult;
    readonly dispatchIntent: (
      intent: LayerDocumentTimelineIntent
    ) => LayerDocumentCutoverCommandResult;
  };
}

export interface LayerDocumentCanvasConsumerViewProps {
  readonly selectedLayerDocumentId: string | null;
  readonly selectedTransformKeyframe:
    LayerDocumentTransformKeyframeSelection | null;
  readonly rendererMode: RendererMode;
  readonly quality: string;
  readonly scope: LayerDocumentGroupScopeReadModelResult;
  readonly runtime: LayerDocumentRuntimeReadModelResult;
}

export interface LayerDocumentConsumerCutoverAssembly {
  readonly project: {
    readonly read: () => LayerDocumentProject;
    readonly undo: () => LayerDocumentCutoverCommandResult;
    readonly redo: () => LayerDocumentCutoverCommandResult;
  };
  readonly selection: {
    readonly selectLayer: (
      layerDocumentId: string | null
    ) => LayerDocumentCutoverCommandResult;
    readonly selectSource: (
      selection: PsdTreeSourceSelection | null
    ) => LayerDocumentCutoverCommandResult;
  };
  readonly scope: {
    readonly read: () => LayerDocumentGroupScopeReadModelResult;
    readonly enter: (
      layerDocumentId: string
    ) => LayerDocumentCutoverCommandResult;
  };
  readonly timeline: {
    readonly readViewProps: () =>
      LayerDocumentTimelineConsumerViewProps;
    readonly dispatchIntent: (
      intent: LayerDocumentTimelineIntent
    ) => LayerDocumentCutoverCommandResult;
    readonly selectTransformKeyframe: (
      selection:
        LayerDocumentTransformKeyframeSelection | null
    ) => LayerDocumentCutoverCommandResult;
    readonly acknowledgeSourceStatus: (
      sourceId: string
    ) => LayerDocumentCutoverCommandResult;
  };
  readonly canvas: {
    readonly readViewProps: (options: {
      quality: string;
      rendererMode: RendererMode;
      globalFrame: number;
    }) => LayerDocumentCanvasConsumerViewProps;
    readonly pointerMove: (options: {
      layerDocumentId: string;
      patch: PreviewSceneTransformPatch;
      quality: string;
      globalFrame: number;
    }) => LayerDocumentDraftInteractionPreparation | null;
    readonly pointerUp: () =>
      LayerDocumentCutoverCommandResult<
        LayerDocumentPanelCommandPreparation
      >;
    readonly motionPathPointerMove: (options: {
      layerDocumentId: string;
      globalFrame: number;
      localFrame: number;
      position: {
        readonly x: number;
        readonly y: number;
      };
      quality: string;
    }) => LayerDocumentDraftInteractionPreparation | null;
    readonly motionPathPointerUp: () =>
      LayerDocumentCutoverCommandResult<
        LayerDocumentPanelCommandPreparation
      >;
    readonly cancelDraft: () => void;
    readonly directSelect: (
      layerDocumentId: string | null
    ) => LayerDocumentCutoverCommandResult;
    readonly selectMotionPathKeyframe: (
      selection: LayerDocumentTransformKeyframeSelection
    ) => LayerDocumentCutoverCommandResult;
  };
  readonly properties: {
    readonly describe: () => LayerDocumentPanelDescriptorResult;
    readonly dispatch: (
      command: LayerDocumentPanelCommand
    ) => LayerDocumentCutoverCommandResult<
      LayerDocumentPanelCommandPreparation
    >;
  };
  readonly domains: {
    readonly drawing: {
      readonly query: (
        layerDocumentId: string
      ) => LayerDocumentDrawingQueryResult;
      readonly update: (
        command: ReplaceLayerDocumentDrawingCommand
      ) => LayerDocumentCutoverCommandResult;
    };
    readonly text: {
      readonly query: (
        layerDocumentId: string
      ) => LayerDocumentTextQueryResult;
      readonly update: (
        command: ReplaceLayerDocumentTextCommand
      ) => LayerDocumentCutoverCommandResult;
    };
    readonly audio: {
      readonly query: (
        layerDocumentId: string
      ) => LayerDocumentAudioQueryResult;
      readonly prepareFutureCommand: (
        command: LayerDocumentAudioFutureCommand
      ) => LayerDocumentAudioUnsupportedPreparation;
    };
  };
  readonly sources: {
    readonly readTree: () => PsdSourceTreeReadModel;
    readonly importSources: (
      command: ImportSourceRegistryCommand
    ) => LayerDocumentCutoverCommandResult;
    readonly confirmPreparedPsdImport: (
      prepared: PreparedLayerDocumentPsdImport
    ) => LayerDocumentPreparedPsdConfirmResult;
    readonly cancelPreparedPsdImport: (
      prepared: PreparedLayerDocumentPsdImport
    ) => LayerDocumentPreparedRuntimeDisposition;
    readonly confirmPreparedPsdRefresh: (
      prepared: PreparedLayerDocumentPsdRefresh,
      cacheContext: RefreshPsdSourceRegistryCommand[
        "cacheContext"
      ]
    ) => LayerDocumentPreparedPsdConfirmResult;
    readonly cancelPreparedPsdRefresh: (
      prepared: PreparedLayerDocumentPsdRefresh
    ) => LayerDocumentPreparedRuntimeDisposition;
    readonly refreshSource: (
      command: RefreshSourceRegistryCommand
    ) => LayerDocumentCutoverCommandResult;
    readonly refreshPsd: (
      command: RefreshPsdSourceRegistryCommand
    ) => LayerDocumentCutoverCommandResult;
    readonly reconnect: (
      command: ReconnectSourceRegistryCommand
    ) => LayerDocumentCutoverCommandResult;
    readonly discover: (
      command: DiscoverPsdSourceNodesCommand
    ) => LayerDocumentCutoverCommandResult;
    readonly deleteSource: (
      command: DeleteSourceRegistryCommand
    ) => LayerDocumentCutoverCommandResult;
  };
  readonly runtime: {
    readonly resources: LayerDocumentSourceRuntimeResourcePort;
    readonly resolutions:
      LayerDocumentSourceRuntimeResolutionPort;
    readonly registrationBridge:
      LayerDocumentPsdRuntimeRegistrationBridge;
  };
}

export type LayerDocumentConsumerIdentity = Pick<
  LayerDocument,
  "layerDocumentId" | "type" | "revision"
>;
