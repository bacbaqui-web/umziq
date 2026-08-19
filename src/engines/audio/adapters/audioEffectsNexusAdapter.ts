import { buildUpdateLayerDocumentCommonTransaction, validateLayerDocumentProject, type LayerDocumentProject, type LayerDocumentTransaction, type LayerEffect } from "@/models";
import type { AudioBasicNexusPort, AudioBasicValue, AudioEffectsNexusPort } from "@/engines/audio/models/audioEffectsModel";

export function createAudioEffectsNexusPort(options: {
  readProject: () => LayerDocumentProject;
  readSelectedLayerDocumentId: () => string | null;
  commit: (transaction: LayerDocumentTransaction) => { ok: boolean };
}): AudioEffectsNexusPort {
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

export function createAudioBasicNexusPort(options: {
  readProject: () => LayerDocumentProject;
  readSelectedLayerDocumentId: () => string | null;
  commit: (transaction: LayerDocumentTransaction) => { ok: boolean };
}): AudioBasicNexusPort {
  const read = (): AudioBasicValue | null => {
    const layerDocumentId = options.readSelectedLayerDocumentId();
    const layer = layerDocumentId ? options.readProject().payload.layerDocumentsById[layerDocumentId] : null;
    return layer?.type === "audio" ? {
      layerDocumentId: layer.layerDocumentId,
      name: layer.name,
      gain: layer.data.gain,
      muted: layer.data.muted,
      startFrame: layer.common.placement.startFrame,
      durationFrames: layer.common.placement.durationFrames,
      sourceOffsetFrames: layer.common.placement.sourceOffsetFrames,
      fadeInFrames: layer.data.fadeInFrames,
      fadeOutFrames: layer.data.fadeOutFrames,
    } : null;
  };
  return {
    read,
    commit: (value) => {
      const project = options.readProject();
      const current = read();
      const layer = project.payload.layerDocumentsById[value.layerDocumentId];
      if (!current || current.layerDocumentId !== value.layerDocumentId || layer?.type !== "audio") return { ok: false };
      const parent = layer.common.placement.parentLayerDocumentId
        ? project.payload.layerDocumentsById[layer.common.placement.parentLayerDocumentId]
        : null;
      const sourceId = layer.common.source?.sourceId;
      const source = sourceId ? project.payload.sourceRegistry.sourcesById[sourceId] : null;
      if (parent?.type !== "group" || source?.kind !== "audio") return { ok: false };
      const integer = (candidate: number) => Math.round(Number.isFinite(candidate) ? candidate : 0);
      const sourceDuration = source.data.durationFrames ?? (layer.common.placement.sourceOffsetFrames + layer.common.placement.durationFrames);
      const gain = Math.min(4, Math.max(0, Number.isFinite(value.gain) ? value.gain : layer.data.gain));
      const startFrame = Math.min(Math.max(0, integer(value.startFrame)), Math.max(0, parent.data.durationFrames - 1));
      const sourceOffsetFrames = Math.min(Math.max(0, integer(value.sourceOffsetFrames)), Math.max(0, sourceDuration - 1));
      const durationFrames = Math.min(Math.max(1, integer(value.durationFrames)), Math.max(1, parent.data.durationFrames - startFrame), Math.max(1, sourceDuration - sourceOffsetFrames));
      const fadeInFrames = Math.min(Math.max(0, integer(value.fadeInFrames)), durationFrames);
      const fadeOutFrames = Math.min(Math.max(0, integer(value.fadeOutFrames)), durationFrames - fadeInFrames);
      const name = value.name.trim() || layer.name;
      if (name === layer.name && gain === layer.data.gain && value.muted === layer.data.muted && startFrame === layer.common.placement.startFrame && durationFrames === layer.common.placement.durationFrames && sourceOffsetFrames === layer.common.placement.sourceOffsetFrames && fadeInFrames === layer.data.fadeInFrames && fadeOutFrames === layer.data.fadeOutFrames) return { ok: false };
      const after = structuredClone(project);
      const next = after.payload.layerDocumentsById[value.layerDocumentId];
      if (next.type !== "audio") return { ok: false };
      next.name = name;
      next.revision += 1;
      next.common.placement = { ...next.common.placement, startFrame, durationFrames, sourceOffsetFrames };
      next.data = { ...next.data, gain, muted: value.muted, fadeInFrames, fadeOutFrames };
      if (validateLayerDocumentProject(after).length) return { ok: false };
      return options.commit({ kind: "update-domain", before: project, after, selectionChange: { kind: "preserve" }, historyEntry: { label: `Update ${layer.name} Audio Properties`, affectedLayerDocumentIds: [layer.layerDocumentId] }, createdLayerDocumentIds: [], deletedLayerDocumentIds: [] });
    },
  };
}
