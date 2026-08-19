import type { MicrophoneCapturePort, MicrophoneProcessingFeature, MicrophoneProcessingSnapshot } from "@/gateway/contracts/microphoneCaptureGateway";

const FEATURES: readonly MicrophoneProcessingFeature[] = ["noiseSuppression", "echoCancellation", "autoGainControl"];
const LABELS: Record<MicrophoneProcessingFeature, string> = { noiseSuppression: "소음 억제", echoCancellation: "에코 제거", autoGainControl: "자동 음량 조절" };

function readProcessing(track: MediaStreamTrack): MicrophoneProcessingSnapshot {
  const settings = track.getSettings() as MediaTrackSettings & Record<string, unknown>;
  const supported = navigator.mediaDevices.getSupportedConstraints() as MediaTrackSupportedConstraints & Record<string, unknown>;
  const capabilities = typeof track.getCapabilities === "function" ? track.getCapabilities() as MediaTrackCapabilities & Record<string, unknown> : null;
  return Object.fromEntries(FEATURES.map((feature) => {
    const enabled = typeof settings[feature] === "boolean" ? settings[feature] as boolean : null;
    const available = enabled !== null || supported[feature] === true;
    const capability = capabilities?.[feature];
    return [feature, { supported: available, enabled, canToggle: available && typeof track.applyConstraints === "function" && (!Array.isArray(capability) || (capability.includes(true) && capability.includes(false))) }];
  })) as MicrophoneProcessingSnapshot;
}

export function createWebMicrophoneCaptureGateway(): MicrophoneCapturePort {
  return {
    enumerateDevices: async () => !navigator.mediaDevices?.enumerateDevices ? [] : (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput").map((device) => ({ deviceId: device.deviceId, label: device.label })),
    subscribeDevices: (listener) => {
      navigator.mediaDevices?.addEventListener?.("devicechange", listener);
      return () => navigator.mediaDevices?.removeEventListener?.("devicechange", listener);
    },
    request: async (preferences = {}, deviceId = null) => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("이 브라우저에서는 마이크 녹음을 사용할 수 없습니다.");
      const supported = navigator.mediaDevices.getSupportedConstraints() as MediaTrackSupportedConstraints & Record<string, unknown>;
      const processing = Object.fromEntries(FEATURES.flatMap((feature) => supported[feature] === true && typeof preferences[feature] === "boolean" ? [[feature, { exact: preferences[feature] }]] : []));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}), ...processing } });
      const track = stream.getAudioTracks()[0] ?? null;
      const context = globalThis.AudioContext ? new AudioContext() : null;
      const analyser = context?.createAnalyser() ?? null;
      const microphone = analyser ? context!.createMediaStreamSource(stream) : null;
      if (analyser && microphone) { analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.72; microphone.connect(analyser); }
      let recorder: MediaRecorder;
      try { recorder = new MediaRecorder(stream); } catch (error) { stream.getTracks().forEach((candidate) => candidate.stop()); throw error; }
      const chunks: Blob[] = [];
      recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
      const completion = new Promise<{ bytes: Uint8Array; mimeType: string }>((resolve, reject) => {
        recorder.addEventListener("stop", async () => { const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" }); resolve({ bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type }); }, { once: true });
        recorder.addEventListener("error", (event) => reject(event.error ?? new Error("녹음 중 오류가 발생했습니다.")), { once: true });
      });
      void completion.catch(() => undefined);
      stream.getTracks().forEach((candidate) => candidate.addEventListener("ended", () => { if (recorder.state !== "inactive") recorder.stop(); stream.getTracks().forEach((item) => item.stop()); }, { once: true }));
      return {
        mimeType: recorder.mimeType || "audio/webm",
        audioProcessing: track ? readProcessing(track) : undefined,
        setAudioProcessing: track ? async (feature, enabled) => { try { await track.applyConstraints({ [feature]: { exact: enabled } } as MediaTrackConstraints); } catch { throw new Error(`${LABELS[feature]} 설정을 이 브라우저에서 변경할 수 없습니다.`); } const next = readProcessing(track); if (next[feature].enabled !== enabled) throw new Error(`${LABELS[feature]} 설정을 이 브라우저에서 변경하지 못했습니다.`); return next; } : undefined,
        readWaveform: analyser ? (target) => analyser.getFloatTimeDomainData(target as Float32Array<ArrayBuffer>) : undefined,
        start: () => { if (recorder.state === "inactive") recorder.start(); },
        stop: () => { if (recorder.state !== "inactive") recorder.stop(); return completion; },
        cancel: () => { if (recorder.state !== "inactive") recorder.stop(); },
        dispose: () => { microphone?.disconnect(); analyser?.disconnect(); if (context && context.state !== "closed") void context.close(); stream.getTracks().forEach((candidate) => candidate.stop()); },
      };
    },
  };
}
