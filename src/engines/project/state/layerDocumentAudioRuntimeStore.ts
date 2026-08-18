import type {
  LayerDocumentAudioRuntimePort,
  LayerDocumentAudioRuntimeResource,
} from "@/engines/project/models/layerDocumentAudioRuntimeModel";

function dispose(resource: LayerDocumentAudioRuntimeResource) {
  try { resource.dispose?.(); } catch { /* best effort */ }
}

export function createLayerDocumentAudioRuntimeStore(): LayerDocumentAudioRuntimePort {
  const resources = new Map<string, LayerDocumentAudioRuntimeResource>();
  const suspendedResources = new Map<string, LayerDocumentAudioRuntimeResource>();
  let disposed = false;
  const clear = () => {
    const unique = new Set([
      ...resources.values(),
      ...suspendedResources.values(),
    ]);
    const count = unique.size;
    unique.forEach(dispose);
    resources.clear();
    suspendedResources.clear();
    return count;
  };
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
        const suspended = suspendedResources.get(resource.sourceId);
        if (suspended) {
          suspendedResources.delete(resource.sourceId);
          if (suspended !== resource) dispose(suspended);
        }
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
    suspendSource: (sourceId) => {
      if (disposed) return false;
      const resource = resources.get(sourceId);
      if (!resource) return false;
      const previous = suspendedResources.get(sourceId);
      if (previous && previous !== resource) dispose(previous);
      suspendedResources.set(sourceId, resource);
      resources.delete(sourceId);
      return true;
    },
    restoreSource: (sourceId) => {
      if (disposed) return false;
      const resource = suspendedResources.get(sourceId);
      if (!resource) return false;
      const previous = resources.get(sourceId);
      if (previous && previous !== resource) dispose(previous);
      resources.set(sourceId, resource);
      suspendedResources.delete(sourceId);
      return true;
    },
    disposeSource: (sourceId) => {
      if (disposed) return false;
      const active = resources.get(sourceId);
      const suspended = suspendedResources.get(sourceId);
      resources.delete(sourceId);
      suspendedResources.delete(sourceId);
      if (active) dispose(active);
      if (suspended && suspended !== active) dispose(suspended);
      return Boolean(active || suspended);
    },
    clear,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clear();
    },
  };
}
