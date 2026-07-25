import type {
  LayerDocument,
  LayerDocumentGroupScopeReadModelResult,
  LayerDocumentProject,
  LayerDocumentTimelineIntent,
  LayerDocumentTransformProperty,
  SourceRegistryKind,
} from "@/models";
import type {
  LayerDocumentSourceStatusIdentity,
  LayerDocumentTransformKeyframeSelection,
} from "@/engines/project";

export interface LayerDocumentTimelineConsumerRow {
  readonly layerDocumentId: string;
  readonly parentLayerDocumentId: string | null;
  readonly depth: number;
  readonly order: number;
  readonly name: string;
  readonly alias: string | null;
  readonly label: string;
  readonly type: LayerDocument["type"];
  readonly sourceId: string | null;
  readonly source: {
    readonly sourceId: string;
    readonly kind: SourceRegistryKind;
    readonly displayName: string;
    readonly resolutionStatus:
      | "unresolved"
      | "resolving"
      | "available"
      | "missing"
      | "error";
  } | null;
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
    ) => unknown;
    readonly dispatchIntent: (
      intent: LayerDocumentTimelineIntent
    ) => unknown;
  };
}

export interface LayerDocumentTimelineOwnerPort {
  readonly project: {
    readonly read: () => LayerDocumentProject;
  };
  readonly scope: {
    readonly read: () => LayerDocumentGroupScopeReadModelResult;
    readonly enter: (layerDocumentId: string) => unknown;
  };
  readonly timeline: {
    readonly readViewProps: () =>
      LayerDocumentTimelineConsumerViewProps;
    readonly dispatchIntent: (
      intent: LayerDocumentTimelineIntent
    ) => unknown;
    readonly selectTransformKeyframe: (
      selection: LayerDocumentTransformKeyframeSelection | null
    ) => unknown;
    readonly acknowledgeSourceStatus: (
      sourceId: string
    ) => unknown;
  };
  readonly runtime: {
    readonly resolutions: {
      readonly setMissing: (sourceId: string) => unknown;
    };
    readonly resources: {
      readonly invalidate: (invalidation: {
        readonly kind: "source";
        readonly sourceId: string;
      }) => number;
    };
  };
}

export interface LayerDocumentTimelineTimingDraft {
  readonly layerDocumentId: string;
  readonly startFrame: number;
  readonly durationFrames: number;
  readonly sourceOffsetFrames: number;
}

export interface LayerDocumentTimelineKeyframeDrag {
  readonly layerDocumentId: string;
  readonly property: LayerDocumentTransformProperty;
  readonly originLocalFrame: number;
  readonly localFrame: number;
}

/**
 * Ephemeral Timeline-only UI state. Stored Project, Timeline playback
 * Runtime, Layer selection, and owner keyframe selection are absent.
 */
export interface LayerDocumentTimelineRuntimeUiState {
  readonly isCompositionSwitcherOpen: boolean;
  readonly draggedLayerDocumentId: string | null;
  readonly editingLayerDocumentId: string | null;
  readonly draftName: string;
  readonly deleteDecisionLayerDocumentId: string | null;
  readonly timingDraft:
    LayerDocumentTimelineTimingDraft | null;
  readonly keyframeDrag:
    LayerDocumentTimelineKeyframeDrag | null;
}

export interface LayerDocumentTimelineSourceStatusPort<
  TResult = void,
> {
  readonly acknowledge: (
    layerDocumentId: string
  ) => TResult;
  readonly resolve: (
    layerDocumentId: string,
    decision: "delete" | "keep"
  ) => TResult;
}

export interface LayerDocumentTimelinePlaybackReadModel {
  readonly currentFrame: number;
  readonly range: {
    readonly startFrame: number;
    readonly endFrame: number;
  };
  /** Runtime-only transport state; never stored in Project or History. */
  readonly isPlaying: boolean;
}

export interface LayerDocumentTimelinePlaybackPort {
  readonly read: () =>
    LayerDocumentTimelinePlaybackReadModel;
  readonly subscribe: (
    listener: () => void
  ) => () => void;
  readonly commands: {
    readonly play: () => void;
    readonly pause: () => void;
    readonly togglePlayback: () => void;
    readonly seek: (frame: number) => void;
    readonly stepBackward: () => void;
    readonly stepForward: () => void;
    readonly reset: () => void;
    readonly setRange: (
      startFrame: number,
      endFrame: number
    ) => void;
  };
}

export interface LayerDocumentTimelineRuntimePort
  extends LayerDocumentTimelinePlaybackPort {
  readonly validity: {
    readonly reconcile: () => void;
  };
  readonly dispose: () => void;
  readonly synchronizeClock: () => void;
}

export interface LayerDocumentTimelinePlaybackScheduler {
  readonly setRepeating: (
    callback: () => void,
    intervalMs: number
  ) => unknown;
  readonly clearRepeating: (handle: unknown) => void;
}
