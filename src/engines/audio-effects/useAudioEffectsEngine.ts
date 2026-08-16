import { useState } from "react";
import { AUDIO_EFFECT_CATALOG, audioEffectParameters, clampAudioEffectParameter, createAudioEffect } from "@/engines/audio-effects/audioEffectsCatalog";
import type { AudioEffectType, AudioEffectsOwnerPort, AudioEffectsViewProps } from "@/engines/audio-effects/models/audioEffectsModel";

let fallbackEffectId = 0;

export function useAudioEffectsEngine(options: {
  port: AudioEffectsOwnerPort;
  allocateEffectId?: (type: AudioEffectType, layerDocumentId: string) => string;
  resetRevision?: number;
}) {
  const [draft, setDraft] = useState<{ selectionId: string; effectId: string; key: string; value: string } | null>(null);
  const read = options.port.read();
  const selectionIdentity = read.layerDocumentId ? `${read.layerDocumentId}:${options.resetRevision ?? 0}` : null;
  const activeDraft = draft?.selectionId === selectionIdentity ? draft : null;
  const commitEffects = (effects: typeof read.effects) => { options.port.commit(effects); };
  const find = (effectId: string) => read.effects.find((effect) => effect.effectId === effectId);
  const viewProps: AudioEffectsViewProps = {
    readModel: {
      visible: Boolean(read.layerDocumentId),
      layerDocumentId: read.layerDocumentId,
      catalog: AUDIO_EFFECT_CATALOG,
      draft: activeDraft ? { effectId: activeDraft.effectId, key: activeDraft.key, value: activeDraft.value } : null,
      items: read.effects.flatMap((effect) => {
        const catalog = AUDIO_EFFECT_CATALOG.find((item) => item.type === effect.type);
        if (!catalog) return [];
        return [{
          effectId: effect.effectId,
          type: catalog.type,
          label: catalog.label,
          enabled: effect.enabled,
          parameters: audioEffectParameters(effect).map((parameter) => ({
            ...parameter,
            value: activeDraft?.effectId === effect.effectId && activeDraft.key === parameter.key
              ? Number(activeDraft.value)
              : parameter.value,
          })),
        }];
      }),
    },
    commands: {
      add: (type) => {
        if (!read.layerDocumentId) return;
        const allocate = options.allocateEffectId ?? ((kind, layerId) => {
          fallbackEffectId += 1;
          return `${kind}:${layerId}:${globalThis.crypto?.randomUUID?.() ?? fallbackEffectId}`;
        });
        commitEffects([...read.effects, createAudioEffect(type, allocate(type, read.layerDocumentId))]);
      },
      remove: (effectId) => commitEffects(read.effects.filter((effect) => effect.effectId !== effectId)),
      move: (effectId, direction) => {
        const index = read.effects.findIndex((effect) => effect.effectId === effectId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= read.effects.length) return;
        const next = [...read.effects];
        [next[index], next[target]] = [next[target], next[index]];
        commitEffects(next);
      },
      toggle: (effectId) => commitEffects(read.effects.map((effect) => effect.effectId === effectId ? { ...effect, enabled: !effect.enabled } : effect)),
      focusParameter: (effectId, key) => {
        if (!read.layerDocumentId) return;
        const parameter = find(effectId) ? audioEffectParameters(find(effectId)!).find((item) => item.key === key) : null;
        if (parameter && selectionIdentity) setDraft({ selectionId: selectionIdentity, effectId, key, value: String(parameter.value) });
      },
      changeParameter: (effectId, key, value) => {
        if (!read.layerDocumentId || !find(effectId)) return;
        if (selectionIdentity) setDraft({ selectionId: selectionIdentity, effectId, key, value });
      },
      commitParameter: (effectId, key) => {
        const effect = find(effectId);
        const parsed = activeDraft?.effectId === effectId && activeDraft.key === key ? Number(activeDraft.value) : Number.NaN;
        if (!effect || !AUDIO_EFFECT_CATALOG.some((item) => item.type === effect.type) || !Number.isFinite(parsed)) {
          setDraft(null);
          return;
        }
        const value = clampAudioEffectParameter(effect.type as AudioEffectType, key, parsed);
        if (value !== null && effect.parameters[key] !== value) {
          commitEffects(read.effects.map((candidate) => candidate.effectId === effectId
            ? { ...candidate, parameters: { ...candidate.parameters, [key]: value } }
            : candidate));
        }
        setDraft(null);
      },
      cancelParameter: () => setDraft(null),
    },
  };
  return { viewProps };
}
