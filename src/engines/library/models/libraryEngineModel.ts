import type {
  LayerDocumentAudioProcessingFeature,
  LayerDocumentAudioRecordingSession,
  LayerDocumentLibraryController,
  PreparedLayerDocumentAudioImport,
  SourceRegistryCacheInvalidationContext,
} from "@/engines/project";
import type { EditorAudioAuditionState } from "@/editor/audio-runtime";
import type { LibraryNodeViewModel } from "@/engines/library/models/libraryModel";
import type { LibraryRecordingEditRequest } from "@/engines/library/models/libraryRecordingModel";

export type LibraryAudioImportPort = {
  prepare: (
    file: File,
    relativePathHint?: string | null,
    order?: number
  ) => Promise<PreparedLayerDocumentAudioImport>;
  confirm: (
    prepared: PreparedLayerDocumentAudioImport
  ) => {
    readonly ok: boolean;
    readonly message?: string;
    readonly recovery?: "none" | "retry-runtime-registration";
  };
  cancel: (prepared: PreparedLayerDocumentAudioImport) => unknown;
};

export type LibraryRecordingAssetStorePort = {
  persist: (
    prepared: PreparedLayerDocumentAudioImport
  ) => Promise<PreparedLayerDocumentAudioImport>;
};

export type LibraryAudioRecordingPort = {
  start: (
    preferences: Partial<Record<LayerDocumentAudioProcessingFeature, boolean>>,
    deviceId?: string | null
  ) => Promise<LayerDocumentAudioRecordingSession>;
  begin: (session: LayerDocumentAudioRecordingSession) => boolean;
  stop: (
    session: LayerDocumentAudioRecordingSession
  ) => Promise<PreparedLayerDocumentAudioImport>;
  cancel: (session: LayerDocumentAudioRecordingSession) => boolean;
  edit?: (
    prepared: PreparedLayerDocumentAudioImport,
    request: LibraryRecordingEditRequest
  ) => Promise<PreparedLayerDocumentAudioImport>;
};

export type LibraryAudioCommandPort = {
  read: () => EditorAudioAuditionState;
  subscribe: (listener: () => void) => () => void;
  readSelectedLayerDocumentId: () => string | null;
  select: (layerDocumentId: string | null) => void;
  togglePlayback: (layerDocumentId: string) => void;
  toggleMuted: (layerDocumentId: string) => void;
  rename: (layerDocumentId: string, name: string) => void;
  delete: (layerDocumentId: string) => void;
  move: (command: {
    layerDocumentId: string;
    targetLayerDocumentId: string;
    position: "before" | "inside" | "after";
  }) => void;
};

export type LayerDocumentLibraryEngineOptions = {
  controller: LayerDocumentLibraryController;
  audioImport: LibraryAudioImportPort;
  audioRecording: LibraryAudioRecordingPort;
  recordingAssetStore: LibraryRecordingAssetStorePort;
  audio: LibraryAudioCommandPort;
  preview?: {
    read: (
      layerDocumentId: string
    ) => ReturnType<NonNullable<LibraryNodeViewModel["preview"]>>;
  };
  parentLayerDocumentId: string;
  durationFrames: number;
  parentWidth: number;
  parentHeight: number;
  nextOrder: () => number;
  cacheContext: () => SourceRegistryCacheInvalidationContext;
  resetRevision: number;
};

export type LibraryAssetCopyRequestPort = {
  request: (
    kind: "psd" | "audio",
    fileCount: number
  ) => Promise<boolean | null>;
};
