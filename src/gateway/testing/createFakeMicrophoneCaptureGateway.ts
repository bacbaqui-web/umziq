import type { MicrophoneCapturePort, MicrophoneCaptureSession } from "@/gateway/contracts/microphoneCaptureGateway";

export function createFakeMicrophoneCaptureGateway(payload = new Uint8Array([1])): MicrophoneCapturePort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    enumerateDevices: async () => [{ deviceId: "fake-microphone", label: "Fake Microphone" }],
    subscribeDevices: () => () => undefined,
    request: async () => {
      const session: MicrophoneCaptureSession = {
        mimeType: "audio/webm",
        start: () => { calls.push("start"); },
        stop: async () => { calls.push("stop"); return { bytes: payload, mimeType: "audio/webm" }; },
        cancel: () => { calls.push("cancel"); },
        dispose: () => { calls.push("dispose"); },
      };
      calls.push("request");
      return session;
    },
  };
}
