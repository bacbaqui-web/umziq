export type LibraryRecordingStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "recording"
  | "preparing"
  | "review"
  | "saving"
  | "error";

export type LibraryRecordingEditRequest = {
  readonly name: string;
  readonly trimStartSeconds: number;
  readonly trimEndSeconds: number;
  readonly gainDb: number;
  readonly removedRanges: readonly {
    readonly startSeconds: number;
    readonly endSeconds: number;
  }[];
};

export type LibraryRecordingPreview = {
  readonly name: string;
  readonly mimeType: string | null;
  readonly byteLength: number;
  readonly read: () => Promise<ArrayBuffer>;
};

export type LibraryRecordingSnapshot = {
  readonly status: LibraryRecordingStatus;
  readonly name: string | null;
  readonly preview: LibraryRecordingPreview | null;
  readonly readLiveWaveform: ((target: Float32Array) => void) | null;
  readonly audioProcessing: LayerDocumentAudioProcessingSnapshot | null;
  readonly changingAudioProcessing: LayerDocumentAudioProcessingFeature | null;
  readonly audioProcessingError: string | null;
  readonly error: string | null;
  readonly canCancel: boolean;
  readonly canRetry: boolean;
  readonly canConfirm: boolean;
};

export type LibraryAudioInputDevice = {
  readonly deviceId: string;
  readonly label: string;
};
import type {
  LayerDocumentAudioProcessingFeature,
  LayerDocumentAudioProcessingSnapshot,
} from "@/engines/project";
