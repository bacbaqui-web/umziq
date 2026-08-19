import type { LayerEffect } from "@/models";
import {
  AUDIO_EFFECT_CATALOG,
  audioEffectParameters,
} from "@/engines/audio/audioEffectsCatalog";
import type {
  AudioEffectsReadModel,
} from "@/engines/audio/models/audioEffectsModel";

export type AudioEffectDraft = {
  readonly effectId: string;
  readonly key: string;
  readonly value: string;
};

export function findAudioEffectParameter(
  effect: LayerEffect | undefined,
  key: string
) {
  return effect
    ? audioEffectParameters(effect).find((item) => item.key === key) ?? null
    : null;
}

export function buildAudioEffectsReadModel(options: {
  readonly layerDocumentId: string | null;
  readonly effects: readonly LayerEffect[];
  readonly draft: AudioEffectDraft | null;
}): AudioEffectsReadModel {
  return {
    visible: Boolean(options.layerDocumentId),
    layerDocumentId: options.layerDocumentId,
    catalog: AUDIO_EFFECT_CATALOG,
    draft: options.draft,
    items: options.effects.flatMap((effect) => {
      const catalog = AUDIO_EFFECT_CATALOG.find((item) => item.type === effect.type);
      if (!catalog) return [];
      return [{
        effectId: effect.effectId,
        type: catalog.type,
        label: catalog.label,
        enabled: effect.enabled,
        parameters: audioEffectParameters(effect).map((parameter) => ({
          ...parameter,
          value: options.draft?.effectId === effect.effectId &&
            options.draft.key === parameter.key
            ? Number(options.draft.value)
            : parameter.value,
        })),
      }];
    }),
  };
}
