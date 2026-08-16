import type { LayerDocumentProject } from "@/models";
import {
  prepareLayerDocumentAudioImport,
  resolveLayerDocumentAudioImportCut,
  type LayerDocumentAudioDecodePort,
  type PreparedLayerDocumentAudioImport,
} from "@/engines/project/import/layerDocumentAudioImportAdapter";

export interface LayerDocumentAudioRecorderPort {
  readonly mimeType: string;
  readonly stop: () => Promise<Blob>;
  readonly cancel: () => void;
  readonly dispose: () => void;
}

export interface LayerDocumentAudioRecordingBrowserPort {
  readonly request: () => Promise<LayerDocumentAudioRecorderPort>;
}

export interface LayerDocumentAudioRecordingSession {
  readonly cutLayerDocumentId: string;
  readonly recorder: LayerDocumentAudioRecorderPort;
  readonly startedAt: number;
  state: "recording" | "stopping" | "stopped" | "cancelled";
  disposed: boolean;
}

function defaultRecordingName(now: Date, mimeType: string) {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";
  return `움직 녹음 ${stamp}.${extension}`;
}

export const LAYER_DOCUMENT_BROWSER_AUDIO_RECORDING_PORT: LayerDocumentAudioRecordingBrowserPort = {
  request: async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("이 브라우저에서는 마이크 녹음을 사용할 수 없습니다.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    recorder.start();
    stream.getTracks().forEach((track) => track.addEventListener("ended", () => {
      if (recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((candidate) => candidate.stop());
    }, { once: true }));
    return {
      mimeType: recorder.mimeType || "audio/webm",
      stop: () => {
        if (recorder.state !== "inactive") recorder.stop();
        return completion;
      },
      cancel: () => {
        if (recorder.state !== "inactive") recorder.stop();
      },
      dispose: () => stream.getTracks().forEach((track) => track.stop()),
    };
  },
};

export async function startLayerDocumentAudioRecording(options: {
  project: LayerDocumentProject;
  explicitCutLayerDocumentId?: string | null;
  selectedLayerDocumentId?: string | null;
  activeGroupLayerDocumentId?: string | null;
  browser?: LayerDocumentAudioRecordingBrowserPort;
  now?: () => number;
}): Promise<LayerDocumentAudioRecordingSession> {
  const cutLayerDocumentId = resolveLayerDocumentAudioImportCut(options);
  if (!cutLayerDocumentId) throw new Error("먼저 녹음을 넣을 Cut을 선택해 주세요.");
  const recorder = await (options.browser ?? LAYER_DOCUMENT_BROWSER_AUDIO_RECORDING_PORT).request();
  return { cutLayerDocumentId, recorder, startedAt: (options.now ?? Date.now)(), state: "recording", disposed: false };
}

function disposeRecordingSession(session: LayerDocumentAudioRecordingSession) {
  if (session.disposed) return;
  session.disposed = true;
  session.recorder.dispose();
}

export function cancelLayerDocumentAudioRecording(session: LayerDocumentAudioRecordingSession) {
  if (session.state !== "recording" && session.state !== "stopping") return false;
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
  });
}
