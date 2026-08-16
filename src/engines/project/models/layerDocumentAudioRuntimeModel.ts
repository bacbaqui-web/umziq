export interface LayerDocumentDecodedAudioMetadata {
  readonly durationSeconds: number;
  readonly channelCount: number;
  readonly sampleRate: number;
}

export interface LayerDocumentAudioRuntimeResource {
  readonly sourceId: string;
  readonly fingerprint: string;
  readonly decodedAudio: unknown;
  readonly metadata: LayerDocumentDecodedAudioMetadata;
  readonly dispose?: () => void;
}

export type LayerDocumentAudioRuntimeRegistrationResult =
  | { readonly ok: true; readonly registeredCount: number; readonly reusedCount: number }
  | { readonly ok: false; readonly message: string };

export interface LayerDocumentAudioRuntimePort {
  readonly preflight: (
    resources: readonly LayerDocumentAudioRuntimeResource[]
  ) => { readonly ok: true } | { readonly ok: false; readonly message: string };
  readonly register: (
    resources: readonly LayerDocumentAudioRuntimeResource[]
  ) => LayerDocumentAudioRuntimeRegistrationResult;
  readonly resolve: (sourceId: string) => LayerDocumentAudioRuntimeResource | null;
  readonly invalidate: (sourceId: string) => boolean;
  readonly clear: () => number;
  readonly dispose: () => void;
}
