import type { EditorAudioAuditionBackend } from "@/editor/audio-runtime/editorAudioRuntimeModel";
import type { LayerEffect } from "@/models";

function parameter(effect: LayerEffect, key: string, fallback: number) {
  const value = effect.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildEffectChain(context: AudioContext, input: AudioNode, effects: readonly LayerEffect[]) {
  const nodes: AudioNode[] = [];
  let current = input;
  effects.filter((effect) => effect.enabled).forEach((effect) => {
    if (effect.type === "compressor") {
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = parameter(effect, "threshold", -24);
      compressor.ratio.value = parameter(effect, "ratio", 4);
      compressor.attack.value = parameter(effect, "attack", 0.03);
      compressor.release.value = parameter(effect, "release", 0.25);
      current.connect(compressor);
      current = compressor;
      nodes.push(compressor);
    } else if (effect.type === "delay") {
      const output = context.createGain();
      const dry = context.createGain();
      const wet = context.createGain();
      const delay = context.createDelay(2);
      const feedback = context.createGain();
      const mix = Math.min(1, Math.max(0, parameter(effect, "mix", 0.2)));
      dry.gain.value = 1 - mix;
      wet.gain.value = mix;
      delay.delayTime.value = Math.min(2, Math.max(0, parameter(effect, "time", 0.25)));
      feedback.gain.value = Math.min(0.9, Math.max(0, parameter(effect, "feedback", 0.25)));
      current.connect(dry).connect(output);
      current.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(output);
      current = output;
      nodes.push(output, dry, wet, delay, feedback);
    } else if (effect.type === "reverb") {
      const output = context.createGain();
      const dry = context.createGain();
      const wet = context.createGain();
      const convolver = context.createConvolver();
      const mix = Math.min(1, Math.max(0, parameter(effect, "mix", 0.25)));
      const duration = Math.min(5, Math.max(0.1, parameter(effect, "duration", 1.5)));
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const impulse = context.createBuffer(2, length, context.sampleRate);
      for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let index = 0; index < length; index += 1) {
          data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 2);
        }
      }
      convolver.buffer = impulse;
      dry.gain.value = 1 - mix;
      wet.gain.value = mix;
      current.connect(dry).connect(output);
      current.connect(convolver).connect(wet).connect(output);
      current = output;
      nodes.push(output, dry, wet, convolver);
    }
    // noise-gate is intentionally only a stored envelope until Task 11.
  });
  return { output: current, disconnect: () => nodes.forEach((node) => { try { node.disconnect(); } catch { /* best effort */ } }) };
}

export const BROWSER_AUDIO_AUDITION_BACKEND: EditorAudioAuditionBackend = {
  start: ({ resource, offsetSeconds, gain, effects, onEnded }) => {
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
    const graph = buildEffectChain(context, source, effects);
    graph.output.connect(gainNode).connect(context.destination);
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
        graph.disconnect();
        gainNode.disconnect();
        void context.close();
      },
    };
  },
};
