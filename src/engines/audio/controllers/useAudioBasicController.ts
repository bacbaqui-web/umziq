import { useState } from "react";
import {
  buildAudioBasicFields,
  readAudioBasicValue,
} from "@/engines/audio/helpers/audioBasicViewModelHelpers";
import type {
  AudioBasicInputId,
  AudioBasicNexusPort,
  AudioBasicViewProps,
} from "@/engines/audio/models/audioEffectsModel";

type AudioBasicDraft = {
  readonly selectionId: string;
  readonly id: AudioBasicInputId;
  readonly value: string;
};

export function useAudioBasicController(options: {
  readonly port: AudioBasicNexusPort;
  readonly resetRevision?: number;
}): AudioBasicViewProps | null {
  const [draft, setDraft] = useState<AudioBasicDraft | null>(null);
  const value = options.port.read();
  const selectionId = value
    ? `${value.layerDocumentId}:${options.resetRevision ?? 0}`
    : null;
  const activeDraft = draft?.selectionId === selectionId ? draft : null;
  if (!value || !selectionId) return null;

  return {
    readModel: {
      layerDocumentId: value.layerDocumentId,
      muted: value.muted,
      fields: buildAudioBasicFields(value, activeDraft),
    },
    commands: {
      focus: (id) => setDraft({
        selectionId,
        id,
        value: readAudioBasicValue(value, id),
      }),
      change: (id, next) => setDraft({ selectionId, id, value: next }),
      commit: (id) => {
        const raw = activeDraft?.id === id
          ? activeDraft.value
          : readAudioBasicValue(value, id);
        if (id !== "name" && !Number.isFinite(Number(raw))) {
          setDraft(null);
          return;
        }
        options.port.commit({
          ...value,
          [id]: id === "name" ? raw : Number(raw),
        });
        setDraft(null);
      },
      cancel: () => setDraft(null),
      toggleMuted: () => {
        options.port.commit({ ...value, muted: !value.muted });
      },
    },
  };
}
