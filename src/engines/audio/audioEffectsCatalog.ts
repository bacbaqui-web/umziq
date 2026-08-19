import type { LayerEffect, PlainDataObject } from "@/models";
import type { AudioEffectParameter, AudioEffectType } from "@/engines/audio/models/audioEffectsModel";

export const AUDIO_EFFECT_CATALOG = [
  { type: "compressor", label: "컴프레서" },
  { type: "reverb", label: "리버브" },
  { type: "delay", label: "딜레이" },
  { type: "noise-gate", label: "소음 줄이기" },
] as const;

const DEFINITIONS: Record<AudioEffectType, readonly Omit<AudioEffectParameter, "value">[]> = {
  compressor: [
    { key: "threshold", label: "기준", min: -60, max: 0, step: 1, suffix: "dB" },
    { key: "ratio", label: "압축", min: 1, max: 20, step: 0.5, suffix: ":1" },
    { key: "attack", label: "어택", min: 0, max: 1, step: 0.01, suffix: "s" },
    { key: "release", label: "릴리즈", min: 0, max: 1, step: 0.01, suffix: "s" },
  ],
  reverb: [
    { key: "mix", label: "양", min: 0, max: 1, step: 0.05 },
    { key: "duration", label: "길이", min: 0.1, max: 5, step: 0.1, suffix: "s" },
  ],
  delay: [
    { key: "time", label: "간격", min: 0, max: 2, step: 0.01, suffix: "s" },
    { key: "feedback", label: "반복", min: 0, max: 0.9, step: 0.05 },
    { key: "mix", label: "양", min: 0, max: 1, step: 0.05 },
  ],
  "noise-gate": [
    { key: "strength", label: "강도", min: 0, max: 1, step: 0.05 },
  ],
};

const DEFAULTS: Record<AudioEffectType, PlainDataObject> = {
  compressor: { threshold: -24, ratio: 4, attack: 0.03, release: 0.25 },
  reverb: { mix: 0.25, duration: 1.5 },
  delay: { time: 0.25, feedback: 0.25, mix: 0.2 },
  "noise-gate": { strength: 0.5 },
};

export function createAudioEffect(type: AudioEffectType, effectId: string): LayerEffect {
  return { effectId, type, enabled: true, parameters: structuredClone(DEFAULTS[type]) };
}

export function audioEffectParameters(effect: LayerEffect): AudioEffectParameter[] {
  if (!(effect.type in DEFINITIONS)) return [];
  return DEFINITIONS[effect.type as AudioEffectType].map((definition) => ({
    ...definition,
    value: typeof effect.parameters[definition.key] === "number"
      ? effect.parameters[definition.key] as number
      : DEFAULTS[effect.type as AudioEffectType][definition.key] as number,
  }));
}

export function clampAudioEffectParameter(type: AudioEffectType, key: string, value: number) {
  const definition = DEFINITIONS[type].find((item) => item.key === key);
  return definition ? Math.min(definition.max, Math.max(definition.min, value)) : null;
}
