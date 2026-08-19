import type {
  LayerDocumentSourceRuntimePermission,
  LayerDocumentSourceRuntimeResolution,
  LayerDocumentSourceRuntimeResolutionPort,
} from "@/engines/project/models/layerDocumentSourceRuntimeResolutionModel";

function unresolved(
  sourceId: string
): LayerDocumentSourceRuntimeResolution {
  return {
    sourceId,
    status: "unresolved",
    permission: "unknown",
    error: null,
  };
}

export function createLayerDocumentSourceRuntimeResolutionStore():
LayerDocumentSourceRuntimeResolutionPort {
  const bySourceId = new Map<
    string,
    LayerDocumentSourceRuntimeResolution
  >();
  const listeners = new Set<() => void>();
  const publish = (
    resolution: LayerDocumentSourceRuntimeResolution
  ) => {
    bySourceId.set(resolution.sourceId, resolution);
    listeners.forEach((listener) => listener());
    return resolution;
  };
  const resolvingOrAvailable = (
    status: "resolving" | "available",
    options: {
      readonly sourceId: string;
      readonly permission?: LayerDocumentSourceRuntimePermission;
    }
  ) => publish({
    sourceId: options.sourceId,
    status,
    permission: options.permission ?? "unknown",
    error: null,
  });

  return {
    read: (sourceId) =>
      bySourceId.get(sourceId) ?? unresolved(sourceId),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setResolving: (options) =>
      resolvingOrAvailable("resolving", options),
    setAvailable: (options) =>
      resolvingOrAvailable("available", options),
    setMissing: (sourceId) => publish({
      ...unresolved(sourceId),
      status: "missing",
    }),
    setError: (sourceId, error) => publish({
      ...unresolved(sourceId),
      status: "error",
      error,
    }),
    remove: (sourceId) => {
      const removed = bySourceId.delete(sourceId);
      if (removed) listeners.forEach((listener) => listener());
      return removed;
    },
    reset: () => {
      if (bySourceId.size === 0) return;
      bySourceId.clear();
      listeners.forEach((listener) => listener());
    },
  };
}
