import type { LayerEffect } from "@/models";

export type AudioEffectType = "compressor" | "reverb" | "delay" | "noise-gate";
export type AudioEffectParameter = { key: string; label: string; value: number; min: number; max: number; step: number; suffix?: string };
export type AudioEffectItemViewModel = { effectId: string; type: AudioEffectType; label: string; enabled: boolean; parameters: AudioEffectParameter[] };
export type AudioEffectsReadModel = { visible: boolean; layerDocumentId: string | null; items: AudioEffectItemViewModel[]; catalog: readonly { type: AudioEffectType; label: string }[]; draft: { effectId: string; key: string; value: string } | null };
export interface AudioEffectsOwnerPort {
  read: () => { layerDocumentId: string | null; effects: readonly LayerEffect[] };
  commit: (effects: readonly LayerEffect[]) => { ok: boolean };
}
export type AudioEffectsViewProps = {
  readModel: AudioEffectsReadModel;
  commands: {
    add: (type: AudioEffectType) => void;
    remove: (effectId: string) => void;
    move: (effectId: string, direction: -1 | 1) => void;
    toggle: (effectId: string) => void;
    focusParameter: (effectId: string, key: string) => void;
    changeParameter: (effectId: string, key: string, value: string) => void;
    commitParameter: (effectId: string, key: string) => void;
    cancelParameter: () => void;
  };
};
