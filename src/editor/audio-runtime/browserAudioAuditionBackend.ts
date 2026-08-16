import type { EditorAudioAuditionBackend } from "@/editor/audio-runtime/editorAudioRuntimeModel";

export const BROWSER_AUDIO_AUDITION_BACKEND: EditorAudioAuditionBackend = {
  start: ({ resource, offsetSeconds, gain, onEnded }) => {
    if (
      typeof AudioBuffer === "undefined" ||
      !(resource.decodedAudio instanceof AudioBuffer)
    ) {
      throw new Error("Decoded resource is not an AudioBuffer");
    }
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Context) throw new Error("AudioContext is unavailable");
    const context = new Context();
    const source = context.createBufferSource();
    const gainNode = context.createGain();
    source.buffer = resource.decodedAudio;
    gainNode.gain.value = gain;
    source.connect(gainNode).connect(context.destination);
    const startedAt = context.currentTime;
    let stopped = false;
    source.onended = () => {
      if (stopped) return;
      stopped = true;
      void context.close();
      onEnded();
    };
    source.start(0, offsetSeconds);
    return {
      readPositionSeconds: () => offsetSeconds + Math.max(0, context.currentTime - startedAt),
      setGain: (value) => { gainNode.gain.value = value; },
      stop: () => {
        if (stopped) return;
        stopped = true;
        source.onended = null;
        try { source.stop(); } catch { /* already stopped */ }
        source.disconnect();
        gainNode.disconnect();
        void context.close();
      },
    };
  },
};
