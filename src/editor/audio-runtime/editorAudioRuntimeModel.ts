import type { LayerDocumentProject, LayerEffect } from "@/models";
import type {
  LayerDocumentAudioRuntimePort,
  LayerDocumentAudioRuntimeResource,
} from "@/engines/project";

export interface EditorAudioAuditionBackendHandle {
  readonly readPositionSeconds: () => number;
  readonly setGain: (gain: number) => void;
  readonly stop: () => void;
}

export interface EditorAudioAuditionBackend {
  readonly start: (options: {
    resource: LayerDocumentAudioRuntimeResource;
    offsetSeconds: number;
    gain: number;
    effects: readonly LayerEffect[];
    onEnded: () => void;
  }) => EditorAudioAuditionBackendHandle;
}

export type EditorAudioAuditionState =
  | { readonly status: "idle" }
  | {
      readonly status: "playing";
      readonly layerDocumentId: string;
      readonly sourceId: string;
      readonly positionSeconds: number;
      readonly durationSeconds: number;
      readonly gain: number;
      readonly muted: boolean;
    };

export type EditorAudioAuditionCommandResult =
  | { readonly ok: true; readonly state: EditorAudioAuditionState }
  | { readonly ok: false; readonly reason: "layer-not-found" | "type-mismatch" | "source-unavailable" | "backend-failed"; readonly message: string };

export interface EditorAudioRuntimePort {
  readonly resources: LayerDocumentAudioRuntimePort;
  readonly read: () => EditorAudioAuditionState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly play: (options: {
    project: LayerDocumentProject;
    layerDocumentId: string;
    offsetSeconds?: number;
  }) => EditorAudioAuditionCommandResult;
  readonly stop: () => EditorAudioAuditionState;
  readonly seek: (seconds: number) => EditorAudioAuditionCommandResult;
  readonly readWaveform: (sourceId: string, bins: number) => readonly number[];
  readonly synchronizeTimeline: (options: {
    project: LayerDocumentProject;
    activeGroupLayerDocumentId: string;
    currentFrame: number;
    frameRate: number;
    isPlaying: boolean;
  }) => void;
  readonly reconcileProject: (project: LayerDocumentProject) => void;
  readonly suspendSource: (sourceId: string) => boolean;
  readonly restoreSource: (sourceId: string) => boolean;
  readonly disposeSource: (sourceId: string) => boolean;
  readonly replaceProject: (project: LayerDocumentProject | null) => void;
  readonly dispose: () => void;
}
