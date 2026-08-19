import type { LayerDocumentProject } from "@/models";
import type { MicrophoneCapturePort, MicrophoneCaptureSession, MicrophoneProcessingFeature, MicrophoneProcessingSnapshot } from "@/gateway";
import { prepareLayerDocumentAudioImport, resolveLayerDocumentAudioImportCut, type LayerDocumentAudioDecodePort, type PreparedLayerDocumentAudioImport } from "@/engines/project/import/layerDocumentAudioImportAdapter";

export type LayerDocumentAudioRecorderPort = MicrophoneCaptureSession;
export type LayerDocumentAudioProcessingFeature = MicrophoneProcessingFeature;
export type LayerDocumentAudioProcessingSnapshot = MicrophoneProcessingSnapshot;
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

export async function startLayerDocumentAudioRecording(options: {
  project: LayerDocumentProject;
  microphone: MicrophoneCapturePort;
  explicitCutLayerDocumentId?: string | null;
  selectedLayerDocumentId?: string | null;
  activeGroupLayerDocumentId?: string | null;
  audioProcessingPreferences?: Partial<Record<LayerDocumentAudioProcessingFeature, boolean>>;
  audioInputDeviceId?: string | null;
}): Promise<LayerDocumentAudioRecordingSession> {
  const cutLayerDocumentId = resolveLayerDocumentAudioImportCut(options);
  if (!cutLayerDocumentId) throw new Error("먼저 녹음을 넣을 Cut을 선택해 주세요.");
  const recorder = await options.microphone.request(options.audioProcessingPreferences, options.audioInputDeviceId);
  return { cutLayerDocumentId, recorder, startedAt: 0, state: "ready", disposed: false };
}

export function beginLayerDocumentAudioRecording(session: LayerDocumentAudioRecordingSession, now: () => number = Date.now) {
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
  let captured: { bytes: Uint8Array; mimeType: string };
  try { captured = await options.session.recorder.stop(); } finally { disposeRecordingSession(options.session); }
  if ((options.session.state as string) === "cancelled") throw new Error("녹음이 취소되었습니다.");
  options.session.state = "stopped";
  if (captured.bytes.byteLength === 0) throw new Error("녹음된 소리가 없습니다.");
  const mimeType = captured.mimeType || options.session.recorder.mimeType || "audio/webm";
  const file = new File([captured.bytes as Uint8Array<ArrayBuffer>], defaultRecordingName((options.now ?? (() => new Date()))(), mimeType), { type: mimeType });
  return prepareLayerDocumentAudioImport({ project: options.project, file, token: options.token, explicitCutLayerDocumentId: options.session.cutLayerDocumentId, decoder: options.decoder, provenance: "recorded", reuseMatchingSource: false });
}
