import type {
  LayerDocumentAudioRuntimePort,
  LayerDocumentAudioRuntimeResource,
} from "@/engines/project/models/layerDocumentAudioRuntimeModel";

function dispose(resource: LayerDocumentAudioRuntimeResource) {
  try { resource.dispose?.(); } catch { /* best effort */ }
}

export function createLayerDocumentAudioRuntimeStore(): LayerDocumentAudioRuntimePort {
  const resources = new Map<string, LayerDocumentAudioRuntimeResource>();
  let disposed = false;
  return {
    preflight: (incoming) => {
      if (disposed) return { ok: false, message: "Audio runtime store is disposed" };
      const ids = new Set<string>();
      for (const resource of incoming) {
        if (!resource.sourceId || !resource.fingerprint || ids.has(resource.sourceId)) {
          return { ok: false, message: "Invalid or duplicate Audio runtime resource" };
        }
        ids.add(resource.sourceId);
      }
      return { ok: true };
    },
    register: (incoming) => {
      const preflight = disposed
        ? { ok: false as const, message: "Audio runtime store is disposed" }
        : { ok: true as const };
      if (!preflight.ok) return preflight;
      let registeredCount = 0;
      let reusedCount = 0;
      incoming.forEach((resource) => {
        const previous = resources.get(resource.sourceId);
        if (previous?.fingerprint === resource.fingerprint) {
          if (previous !== resource) dispose(resource);
          reusedCount += 1;
          return;
        }
        if (previous) dispose(previous);
        resources.set(resource.sourceId, resource);
        registeredCount += 1;
      });
      return { ok: true, registeredCount, reusedCount };
    },
    resolve: (sourceId) => resources.get(sourceId) ?? null,
    invalidate: (sourceId) => {
      const resource = resources.get(sourceId);
      if (!resource) return false;
      resources.delete(sourceId);
      dispose(resource);
      return true;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      resources.forEach(dispose);
      resources.clear();
    },
  };
}
