import { useState } from "react";
import {
  AUDIO_EFFECT_CATALOG,
  clampAudioEffectParameter,
  createAudioEffect,
} from "@/engines/audio/audioEffectsCatalog";
import {
  buildAudioEffectsReadModel,
  findAudioEffectParameter,
} from "@/engines/audio/helpers/audioEffectsViewModelHelpers";
import type {
  AudioEffectsNexusPort,
  AudioEffectsViewProps,
  AudioEffectType,
} from "@/engines/audio/models/audioEffectsModel";

let fallbackEffectId = 0;

type AudioEffectsDraft = {
  readonly selectionId: string;
  readonly effectId: string;
  readonly key: string;
  readonly value: string;
};

export function useAudioEffectsController(options: {
  readonly port: AudioEffectsNexusPort;
  readonly allocateEffectId?: (type: AudioEffectType, layerDocumentId: string) => string;
  readonly resetRevision?: number;
}): AudioEffectsViewProps {
  const [draft, setDraft] = useState<AudioEffectsDraft | null>(null);
  const read = options.port.read();
  const selectionId = read.layerDocumentId
    ? `${read.layerDocumentId}:${options.resetRevision ?? 0}`
    : null;
  const activeDraft = draft?.selectionId === selectionId ? draft : null;
  const commit = (effects: typeof read.effects) => {
    options.port.commit(effects);
  };
  const find = (effectId: string) =>
    read.effects.find((effect) => effect.effectId === effectId);

  return {
    readModel: buildAudioEffectsReadModel({
      layerDocumentId: read.layerDocumentId,
      effects: read.effects,
      draft: activeDraft
        ? {
            effectId: activeDraft.effectId,
            key: activeDraft.key,
            value: activeDraft.value,
          }
        : null,
    }),
    commands: {
      add: (type) => {
        if (!read.layerDocumentId) return;
        const allocate = options.allocateEffectId ?? ((kind, layerId) => {
          fallbackEffectId += 1;
          return `${kind}:${layerId}:${globalThis.crypto?.randomUUID?.() ?? fallbackEffectId}`;
        });
        commit([
          ...read.effects,
          createAudioEffect(type, allocate(type, read.layerDocumentId)),
        ]);
      },
      remove: (effectId) =>
        commit(read.effects.filter((effect) => effect.effectId !== effectId)),
      move: (effectId, direction) => {
        const index = read.effects.findIndex((effect) => effect.effectId === effectId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= read.effects.length) return;
        const next = [...read.effects];
        [next[index], next[target]] = [next[target], next[index]];
        commit(next);
      },
      toggle: (effectId) => commit(read.effects.map((effect) =>
        effect.effectId === effectId
          ? { ...effect, enabled: !effect.enabled }
          : effect
      )),
      focusParameter: (effectId, key) => {
        if (!read.layerDocumentId) return;
        const parameter = findAudioEffectParameter(find(effectId), key);
        if (parameter && selectionId) {
          setDraft({
            selectionId,
            effectId,
            key,
            value: String(parameter.value),
          });
        }
      },
      changeParameter: (effectId, key, value) => {
        if (!read.layerDocumentId || !find(effectId) || !selectionId) return;
        setDraft({ selectionId, effectId, key, value });
      },
      commitParameter: (effectId, key) => {
        const effect = find(effectId);
        const parsed = activeDraft?.effectId === effectId && activeDraft.key === key
          ? Number(activeDraft.value)
          : Number.NaN;
        if (
          !effect ||
          !AUDIO_EFFECT_CATALOG.some((item) => item.type === effect.type) ||
          !Number.isFinite(parsed)
        ) {
          setDraft(null);
          return;
        }
        const value = clampAudioEffectParameter(
          effect.type as AudioEffectType,
          key,
          parsed
        );
        if (value !== null && effect.parameters[key] !== value) {
          commit(read.effects.map((candidate) =>
            candidate.effectId === effectId
              ? {
                  ...candidate,
                  parameters: { ...candidate.parameters, [key]: value },
                }
              : candidate
          ));
        }
        setDraft(null);
      },
      cancelParameter: () => setDraft(null),
    },
  };
}
