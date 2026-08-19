import type { LayerEffect } from "@/models";

export type AudioEffectType = "compressor" | "reverb" | "delay" | "noise-gate";
export type AudioEffectParameter = { key: string; label: string; value: number; min: number; max: number; step: number; suffix?: string };
export type AudioEffectItemViewModel = { effectId: string; type: AudioEffectType; label: string; enabled: boolean; parameters: AudioEffectParameter[] };
export type AudioEffectsReadModel = { visible: boolean; layerDocumentId: string | null; items: AudioEffectItemViewModel[]; catalog: readonly { type: AudioEffectType; label: string }[]; draft: { effectId: string; key: string; value: string } | null };
export interface AudioEffectsNexusPort {
  read: () => { layerDocumentId: string | null; effects: readonly LayerEffect[] };
  commit: (effects: readonly LayerEffect[]) => { ok: boolean };
}
export type AudioBasicInputId = "name" | "gain" | "startFrame" | "durationFrames" | "sourceOffsetFrames" | "fadeInFrames" | "fadeOutFrames";
export type AudioBasicValue = {
  layerDocumentId: string;
  name: string;
  gain: number;
  muted: boolean;
  startFrame: number;
  durationFrames: number;
  sourceOffsetFrames: number;
  fadeInFrames: number;
  fadeOutFrames: number;
};
export interface AudioBasicNexusPort {
  read: () => AudioBasicValue | null;
  commit: (value: AudioBasicValue) => { ok: boolean };
}
export type AudioBasicViewProps = {
  readModel: {
    layerDocumentId: string;
    muted: boolean;
    fields: readonly { id: AudioBasicInputId; label: string; value: string; suffix?: string; numeric: boolean; step?: number }[];
  };
  commands: {
    focus: (id: AudioBasicInputId) => void;
    change: (id: AudioBasicInputId, value: string) => void;
    commit: (id: AudioBasicInputId) => void;
    cancel: () => void;
    toggleMuted: () => void;
  };
};
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
