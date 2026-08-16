import type { EditorAudioAuditionBackend } from "@/editor/audio-runtime/editorAudioRuntimeModel";
import type { LayerEffect } from "@/models";
import { createNoiseGateEnvelope, processNoiseGateChannels, resolveNoiseGateSettings } from "@/editor/audio-runtime/noiseGateDsp";

function parameter(effect: LayerEffect, key: string, fallback: number) {
  const value = effect.parameters[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

interface EffectChainOptions {
  createNoiseGateNode?: (effect: LayerEffect) => AudioNode;
}

export function buildEffectChain(
  context: AudioContext,
  input: AudioNode,
  effects: readonly LayerEffect[],
  options: EffectChainOptions = {},
) {
  const nodes: AudioNode[] = [];
  const cleanups: Array<() => void> = [];
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
    } else if (effect.type === "noise-gate") {
      if (options.createNoiseGateNode) {
        const processor = options.createNoiseGateNode(effect);
        current.connect(processor);
        current = processor;
        nodes.push(processor);
      } else if (typeof context.createScriptProcessor === "function") {
        // CSP or older-browser fallback. The normal browser path uses AudioWorklet.
        const channelCount = Math.max(1, Math.min(32, input.channelCount || 2));
        const processor = context.createScriptProcessor(1024, channelCount, channelCount);
        const envelope = createNoiseGateEnvelope(resolveNoiseGateSettings(effect), context.sampleRate);
        processor.onaudioprocess = (event) => {
          const inputs = Array.from(
            { length: event.inputBuffer.numberOfChannels },
            (_, channel) => event.inputBuffer.getChannelData(channel),
          );
          const outputs = Array.from(
            { length: event.outputBuffer.numberOfChannels },
            (_, channel) => event.outputBuffer.getChannelData(channel),
          );
          processNoiseGateChannels(inputs, outputs, envelope);
        };
        current.connect(processor);
        current = processor;
        nodes.push(processor);
        cleanups.push(() => { processor.onaudioprocess = null; });
      }
    }
  });
  return { output: current, disconnect: () => {
    cleanups.forEach((cleanup) => cleanup());
    nodes.forEach((node) => { try { node.disconnect(); } catch { /* best effort */ } });
  } };
}

const NOISE_GATE_WORKLET_SOURCE = `
class UmziqNoiseGateProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const s = options.processorOptions.settings;
    this.threshold = Math.pow(10, s.thresholdDb / 20);
    this.floor = Math.pow(10, s.floorDb / 20);
    this.attack = Math.exp(-1 / (Math.max(0.001, s.attackSeconds) * sampleRate));
    this.release = Math.exp(-1 / (Math.max(0.01, s.releaseSeconds) * sampleRate));
    this.gain = this.floor;
  }
  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0] || [];
    const frames = output[0] ? output[0].length : 0;
    for (let frame = 0; frame < frames; frame += 1) {
      let detector = 0;
      for (let channel = 0; channel < input.length; channel += 1) {
        detector = Math.max(detector, Math.abs(input[channel][frame] || 0));
      }
      const target = detector >= this.threshold ? 1 : this.floor;
      const coefficient = target > this.gain ? this.attack : this.release;
      this.gain = target + coefficient * (this.gain - target);
      for (let channel = 0; channel < output.length; channel += 1) {
        output[channel][frame] = (input[channel] ? input[channel][frame] : 0) * this.gain;
      }
    }
    return true;
  }
}
registerProcessor("umziq-noise-gate", UmziqNoiseGateProcessor);
`;

export async function prepareNoiseGateWorklet(context: AudioContext) {
  if (!context.audioWorklet || typeof AudioWorkletNode === "undefined" || typeof Blob === "undefined") return null;
  const url = URL.createObjectURL(new Blob([NOISE_GATE_WORKLET_SOURCE], { type: "text/javascript" }));
  try {
    await context.audioWorklet.addModule(url);
    return (effect: LayerEffect) => new AudioWorkletNode(context, "umziq-noise-gate", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCountMode: "max",
      processorOptions: { settings: resolveNoiseGateSettings(effect) },
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface BrowserAudioBackendDependencies {
  createContext: () => AudioContext;
  isAudioBuffer: (value: unknown) => value is AudioBuffer;
  prepareNoiseGate: typeof prepareNoiseGateWorklet;
}

export function createBrowserAudioAuditionBackend(
  overrides: Partial<BrowserAudioBackendDependencies> = {},
): EditorAudioAuditionBackend {
  return {
  start: ({ resource, offsetSeconds, gain, effects, onEnded }) => {
    const isAudioBuffer = overrides.isAudioBuffer ?? ((value: unknown): value is AudioBuffer => (
      typeof AudioBuffer !== "undefined" && value instanceof AudioBuffer
    ));
    if (!isAudioBuffer(resource.decodedAudio)) {
      throw new Error("Decoded resource is not an AudioBuffer");
    }
    const context = overrides.createContext?.() ?? (() => {
      const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Context) throw new Error("AudioContext is unavailable");
      return new Context();
    })();
    const source = context.createBufferSource();
    const gainNode = context.createGain();
    source.buffer = resource.decodedAudio;
    gainNode.gain.value = gain;
    let graph: ReturnType<typeof buildEffectChain> | null = null;
    const requestedAt = context.currentTime;
    const durationSeconds = resource.metadata.durationSeconds;
    let stopped = false;
    const readPositionSeconds = () => Math.min(
      durationSeconds,
      offsetSeconds + Math.max(0, context.currentTime - requestedAt),
    );
    const finish = (notifyEnded: boolean, stopSource: boolean) => {
      if (stopped) return;
      stopped = true;
      source.onended = null;
      if (stopSource) {
        try { source.stop(); } catch { /* not started or already stopped */ }
      }
      try { source.disconnect(); } catch { /* best effort */ }
      graph?.disconnect();
      try { gainNode.disconnect(); } catch { /* best effort */ }
      void context.close();
      if (notifyEnded) queueMicrotask(onEnded);
    };
    source.onended = () => finish(true, false);
    const begin = (
      createNoiseGateNode?: EffectChainOptions["createNoiseGateNode"],
      asynchronous = false,
    ) => {
      if (stopped) return;
      const caughtUpOffset = readPositionSeconds();
      if (caughtUpOffset >= durationSeconds) {
        finish(true, true);
        return;
      }
      try {
        graph = buildEffectChain(context, source, effects, { createNoiseGateNode });
        graph.output.connect(gainNode).connect(context.destination);
        source.start(0, caughtUpOffset);
      } catch (error) {
        finish(asynchronous, true);
        if (!asynchronous) throw error;
      }
    };
    if (effects.some((effect) => effect.enabled && effect.type === "noise-gate")) {
      void (overrides.prepareNoiseGate ?? prepareNoiseGateWorklet)(context).then(
        (factory) => begin(factory ?? undefined, true),
        () => begin(undefined, true),
      );
    } else {
      begin();
    }
    return {
      readPositionSeconds,
      setGain: (value) => { gainNode.gain.value = value; },
      stop: () => {
        finish(false, true);
      },
    };
  },
  };
}

export const BROWSER_AUDIO_AUDITION_BACKEND = createBrowserAudioAuditionBackend();
