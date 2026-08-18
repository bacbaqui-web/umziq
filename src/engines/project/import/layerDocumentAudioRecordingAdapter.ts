import type { LayerDocumentProject } from "@/models";
import {
  prepareLayerDocumentAudioImport,
  resolveLayerDocumentAudioImportCut,
  type LayerDocumentAudioDecodePort,
  type PreparedLayerDocumentAudioImport,
} from "@/engines/project/import/layerDocumentAudioImportAdapter";

export interface LayerDocumentAudioRecorderPort {
  readonly mimeType: string;
  readonly readWaveform?: (target: Float32Array) => void;
  readonly audioProcessing?: LayerDocumentAudioProcessingSnapshot;
  readonly setAudioProcessing?: (
    feature: LayerDocumentAudioProcessingFeature,
    enabled: boolean
  ) => Promise<LayerDocumentAudioProcessingSnapshot>;
  readonly start: () => void;
  readonly stop: () => Promise<Blob>;
  readonly cancel: () => void;
  readonly dispose: () => void;
}

export type LayerDocumentAudioProcessingFeature =
  | "noiseSuppression"
  | "echoCancellation"
  | "autoGainControl";

export type LayerDocumentAudioProcessingSetting = {
  readonly supported: boolean;
  readonly enabled: boolean | null;
  readonly canToggle: boolean;
};

export type LayerDocumentAudioProcessingSnapshot = Record<
  LayerDocumentAudioProcessingFeature,
  LayerDocumentAudioProcessingSetting
>;

const AUDIO_PROCESSING_FEATURES: readonly LayerDocumentAudioProcessingFeature[] = [
  "noiseSuppression",
  "echoCancellation",
  "autoGainControl",
];

const AUDIO_PROCESSING_FEATURE_LABELS: Record<
  LayerDocumentAudioProcessingFeature,
  string
> = {
  noiseSuppression: "소음 억제",
  echoCancellation: "에코 제거",
  autoGainControl: "자동 음량 조절",
};

function readAudioProcessing(
  track: MediaStreamTrack
): LayerDocumentAudioProcessingSnapshot {
  const settings = track.getSettings() as MediaTrackSettings & Record<string, unknown>;
  const supportedConstraints = navigator.mediaDevices.getSupportedConstraints() as
    MediaTrackSupportedConstraints & Record<string, unknown>;
  const capabilities = typeof track.getCapabilities === "function"
    ? track.getCapabilities() as MediaTrackCapabilities & Record<string, unknown>
    : null;
  return Object.fromEntries(AUDIO_PROCESSING_FEATURES.map((feature) => {
    const enabled = typeof settings[feature] === "boolean"
      ? settings[feature] as boolean
      : null;
    const supported = enabled !== null || supportedConstraints[feature] === true;
    const capability = capabilities?.[feature];
    const canToggle = supported && typeof track.applyConstraints === "function" && (
      !Array.isArray(capability) ||
      (capability.includes(true) && capability.includes(false))
    );
    return [feature, { supported, enabled, canToggle }];
  })) as LayerDocumentAudioProcessingSnapshot;
}

export interface LayerDocumentAudioRecordingBrowserPort {
  readonly request: (
    preferences?: Partial<Record<LayerDocumentAudioProcessingFeature, boolean>>,
    deviceId?: string | null
  ) => Promise<LayerDocumentAudioRecorderPort>;
}

export interface LayerDocumentAudioRecordingSession {
  readonly cutLayerDocumentId: string;
  readonly recorder: LayerDocumentAudioRecorderPort;
  startedAt: number;
  state: "ready" | "recording" | "stopping" | "stopped" | "cancelled";
  disposed: boolean;
}

function defaultRecordingName(now: Date, mimeType: string) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${pad(now.getFullYear() % 100)}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";
  return `움직_녹음_${stamp}.${extension}`;
}

export const LAYER_DOCUMENT_BROWSER_AUDIO_RECORDING_PORT: LayerDocumentAudioRecordingBrowserPort = {
  request: async (preferences = {}, deviceId = null) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("이 브라우저에서는 마이크 녹음을 사용할 수 없습니다.");
    }
    const supported = navigator.mediaDevices.getSupportedConstraints() as
      MediaTrackSupportedConstraints & Record<string, unknown>;
    const requestedProcessing = Object.fromEntries(
      AUDIO_PROCESSING_FEATURES.flatMap((feature) =>
        supported[feature] === true && typeof preferences[feature] === "boolean"
          ? [[feature, { exact: preferences[feature] }]]
          : []
      )
    );
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        ...requestedProcessing,
      },
    });
    const audioTrack = typeof stream.getAudioTracks === "function"
      ? stream.getAudioTracks()[0] ?? null
      : stream.getTracks().find((track) => track.kind === "audio") ?? null;
    const AudioContextConstructor = globalThis.AudioContext;
    const audioContext = AudioContextConstructor
      ? new AudioContextConstructor()
      : null;
    const analyser = audioContext?.createAnalyser() ?? null;
    const microphone = analyser
      ? audioContext!.createMediaStreamSource(stream)
      : null;
    if (analyser && microphone) {
      // Keep one live read close to the UI's 42 ms history interval at 48 kHz.
      // A shorter window can miss transients that are present in the decoded
      // recording and makes the live and review waveforms disagree.
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.72;
      microphone.connect(analyser);
    }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
    const chunks: Blob[] = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    const completion = new Promise<Blob>((resolve, reject) => {
      recorder.addEventListener("stop", () => {
        resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      }, { once: true });
      recorder.addEventListener("error", (event) => {
        reject(event.error ?? new Error("녹음 중 오류가 발생했습니다."));
      }, { once: true });
    });
    // Recorder errors can arrive before the user presses Stop. Keep the
    // rejection observable by stop() without creating an unhandled Promise.
    void completion.catch(() => undefined);
    stream.getTracks().forEach((track) => track.addEventListener("ended", () => {
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((candidate) => candidate.stop());
    }, { once: true }));
    return {
      mimeType: recorder.mimeType || "audio/webm",
      audioProcessing: audioTrack ? readAudioProcessing(audioTrack) : undefined,
      setAudioProcessing: audioTrack
        ? async (feature, enabled) => {
            try {
              await audioTrack.applyConstraints({
                [feature]: { exact: enabled },
              } as MediaTrackConstraints);
            } catch {
              throw new Error(
                `${AUDIO_PROCESSING_FEATURE_LABELS[feature]} 설정을 이 브라우저에서 변경할 수 없습니다.`
              );
            }
            const next = readAudioProcessing(audioTrack);
            if (next[feature].enabled !== enabled) {
              throw new Error(
                `${AUDIO_PROCESSING_FEATURE_LABELS[feature]} 설정을 이 브라우저에서 변경하지 못했습니다.`
              );
            }
            return next;
          }
        : undefined,
      readWaveform: analyser
        ? (target) => analyser.getFloatTimeDomainData(
            target as Float32Array<ArrayBuffer>
          )
        : undefined,
      start: () => {
        if (recorder.state === "inactive") recorder.start();
      },
      stop: () => {
        if (recorder.state !== "inactive") recorder.stop();
        return completion;
      },
      cancel: () => {
        if (recorder.state !== "inactive") recorder.stop();
      },
      dispose: () => {
        microphone?.disconnect();
        analyser?.disconnect();
        if (audioContext && audioContext.state !== "closed") {
          void audioContext.close();
        }
        stream.getTracks().forEach((track) => track.stop());
      },
    };
  },
};

export async function startLayerDocumentAudioRecording(options: {
  project: LayerDocumentProject;
  explicitCutLayerDocumentId?: string | null;
  selectedLayerDocumentId?: string | null;
  activeGroupLayerDocumentId?: string | null;
  browser?: LayerDocumentAudioRecordingBrowserPort;
  audioProcessingPreferences?: Partial<Record<LayerDocumentAudioProcessingFeature, boolean>>;
  audioInputDeviceId?: string | null;
  now?: () => number;
}): Promise<LayerDocumentAudioRecordingSession> {
  const cutLayerDocumentId = resolveLayerDocumentAudioImportCut(options);
  if (!cutLayerDocumentId) throw new Error("먼저 녹음을 넣을 Cut을 선택해 주세요.");
  const recorder = await (options.browser ?? LAYER_DOCUMENT_BROWSER_AUDIO_RECORDING_PORT).request(
    options.audioProcessingPreferences,
    options.audioInputDeviceId
  );
  return { cutLayerDocumentId, recorder, startedAt: 0, state: "ready", disposed: false };
}

export function beginLayerDocumentAudioRecording(
  session: LayerDocumentAudioRecordingSession,
  now: () => number = Date.now
) {
  if (session.state !== "ready") return false;
  session.recorder.start();
  session.startedAt = now();
  session.state = "recording";
  return true;
}

function disposeRecordingSession(session: LayerDocumentAudioRecordingSession) {
  if (session.disposed) return;
  session.disposed = true;
  session.recorder.dispose();
}

export function cancelLayerDocumentAudioRecording(session: LayerDocumentAudioRecordingSession) {
  if (session.state !== "ready" && session.state !== "recording" && session.state !== "stopping") return false;
  session.state = "cancelled";
  try { session.recorder.cancel(); } finally { disposeRecordingSession(session); }
  return true;
}

export async function stopLayerDocumentAudioRecording(options: {
  session: LayerDocumentAudioRecordingSession;
  project: LayerDocumentProject;
  token: string;
  decoder?: LayerDocumentAudioDecodePort;
  now?: () => Date;
}): Promise<PreparedLayerDocumentAudioImport> {
  if (options.session.state !== "recording") throw new Error("진행 중인 녹음이 없습니다.");
  options.session.state = "stopping";
  let blob: Blob;
  try {
    blob = await options.session.recorder.stop();
  } finally {
    disposeRecordingSession(options.session);
  }
  if ((options.session.state as string) === "cancelled") throw new Error("녹음이 취소되었습니다.");
  options.session.state = "stopped";
  if (blob.size === 0) throw new Error("녹음된 소리가 없습니다.");
  const mimeType = blob.type || options.session.recorder.mimeType || "audio/webm";
  const file = new File([blob], defaultRecordingName((options.now ?? (() => new Date()))(), mimeType), { type: mimeType });
  return prepareLayerDocumentAudioImport({
    project: options.project,
    file,
    token: options.token,
    explicitCutLayerDocumentId: options.session.cutLayerDocumentId,
    decoder: options.decoder,
    provenance: "recorded",
    reuseMatchingSource: false,
  });
}
