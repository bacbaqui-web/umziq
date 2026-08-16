import { buildUpdateLayerDocumentCommonTransaction, type LayerDocumentProject, type LayerDocumentTransaction, type LayerEffect } from "@/models";
import type { AudioEffectsOwnerPort } from "@/engines/audio-effects/models/audioEffectsModel";

export function createAudioEffectsOwnerPort(options: {
  readProject: () => LayerDocumentProject;
  readSelectedLayerDocumentId: () => string | null;
  commit: (transaction: LayerDocumentTransaction) => { ok: boolean };
}): AudioEffectsOwnerPort {
  return {
    read: () => {
      const layerDocumentId = options.readSelectedLayerDocumentId();
      const layer = layerDocumentId ? options.readProject().payload.layerDocumentsById[layerDocumentId] : null;
      return layer?.type === "audio"
        ? { layerDocumentId, effects: structuredClone(layer.common.effects) }
        : { layerDocumentId: null, effects: [] };
    },
    commit: (effects: readonly LayerEffect[]) => {
      const current = options.readSelectedLayerDocumentId();
      const layer = current ? options.readProject().payload.layerDocumentsById[current] : null;
      if (!current || layer?.type !== "audio") return { ok: false };
      const prepared = buildUpdateLayerDocumentCommonTransaction(options.readProject(), {
        layerDocumentId: current,
        update: { kind: "set-effects", effects: structuredClone([...effects]) },
      });
      return prepared.ok ? options.commit(prepared.transaction) : { ok: false };
    },
  };
}
