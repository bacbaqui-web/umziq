import type { LayerEffect } from "@/models";

export interface NoiseGateSettings {
  thresholdDb: number;
  attackSeconds: number;
  releaseSeconds: number;
  floorDb: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const dbToGain = (db: number) => Math.pow(10, db / 20);

export function resolveNoiseGateSettings(effect: LayerEffect): NoiseGateSettings {
  const strength = clamp(finite(effect.parameters.strength, 0.5), 0, 1);
  return {
    thresholdDb: clamp(finite(effect.parameters.thresholdDb, -60 + strength * 32), -80, -6),
    attackSeconds: clamp(finite(effect.parameters.attack, 0.005 + strength * 0.015), 0.001, 0.1),
    releaseSeconds: clamp(finite(effect.parameters.release, 0.08 + strength * 0.22), 0.01, 1),
    floorDb: clamp(finite(effect.parameters.floorDb, -strength * 60), -96, 0),
  };
}

export interface NoiseGateEnvelope {
  next(detectorAmplitude: number): number;
  readGain(): number;
}

/** A linked-channel envelope keeps stereo placement stable while the gate opens and closes. */
export function createNoiseGateEnvelope(settings: NoiseGateSettings, sampleRate: number): NoiseGateEnvelope {
  const threshold = dbToGain(settings.thresholdDb);
  const floor = dbToGain(settings.floorDb);
  const rate = Math.max(1, sampleRate);
  const attackCoefficient = Math.exp(-1 / (Math.max(0.001, settings.attackSeconds) * rate));
  const releaseCoefficient = Math.exp(-1 / (Math.max(0.01, settings.releaseSeconds) * rate));
  let gain = floor;
  return {
    next: (detectorAmplitude) => {
      const target = Math.abs(detectorAmplitude) >= threshold ? 1 : floor;
      const coefficient = target > gain ? attackCoefficient : releaseCoefficient;
      gain = target + coefficient * (gain - target);
      return gain;
    },
    readGain: () => gain,
  };
}

export function processNoiseGateChannels(
  inputs: readonly Float32Array[],
  outputs: readonly Float32Array[],
  envelope: NoiseGateEnvelope,
) {
  const frameCount = Math.min(
    ...[...inputs, ...outputs].map((channel) => channel.length),
  );
  for (let frame = 0; frame < frameCount; frame += 1) {
    let detector = 0;
    inputs.forEach((channel) => { detector = Math.max(detector, Math.abs(channel[frame] ?? 0)); });
    const gain = envelope.next(detector);
    outputs.forEach((output, channel) => { output[frame] = (inputs[channel]?.[frame] ?? 0) * gain; });
  }
}
