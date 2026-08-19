export type MicrophoneProcessingFeature = "noiseSuppression" | "echoCancellation" | "autoGainControl";
export type MicrophoneProcessingSnapshot = Record<MicrophoneProcessingFeature, { readonly supported: boolean; readonly enabled: boolean | null; readonly canToggle: boolean }>;
export type MicrophoneDevice = { readonly deviceId: string; readonly label: string };
export interface MicrophoneCaptureSession {
  readonly mimeType: string;
  readonly readWaveform?: (target: Float32Array) => void;
  readonly audioProcessing?: MicrophoneProcessingSnapshot;
  readonly setAudioProcessing?: (feature: MicrophoneProcessingFeature, enabled: boolean) => Promise<MicrophoneProcessingSnapshot>;
  readonly start: () => void;
  readonly stop: () => Promise<{ readonly bytes: Uint8Array; readonly mimeType: string }>;
  readonly cancel: () => void;
  readonly dispose: () => void;
}
export interface MicrophoneCapturePort {
  request: (preferences?: Partial<Record<MicrophoneProcessingFeature, boolean>>, deviceId?: string | null) => Promise<MicrophoneCaptureSession>;
  enumerateDevices: () => Promise<readonly MicrophoneDevice[]>;
  subscribeDevices: (listener: () => void) => () => void;
}
