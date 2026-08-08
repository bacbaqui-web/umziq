import type {
  LayerDocumentPsdRuntimeRegistrationBridge,
  LayerDocumentRuntimeBatchPreflightResult,
  LayerDocumentRuntimeBatchRegistrationResult,
  LayerDocumentSourceRuntimeInvalidation,
  LayerDocumentSourceRuntimeResource,
  LayerDocumentSourceRuntimeResourcePort,
} from "@/render/models/layerDocumentSourceRuntimeResourceModel";
import type {
  RuntimeMetricRecordPort,
} from "@/render/models/runtimeMetricPortModel";

const disposedRuntimeResources = new WeakSet<object>();

function disposeEntry(
  entry: LayerDocumentSourceRuntimeResource,
  metrics?: RuntimeMetricRecordPort
) {
  if (disposedRuntimeResources.has(entry)) return;
  disposedRuntimeResources.add(entry);
  try {
    entry.dispose?.();
  } catch {
    metrics?.increment(
      "layerDocumentSourceRuntimeDisposeFailure"
    );
  }
}

export function createLayerDocumentSourceRuntimeResourceCache(options?: {
  metrics?: RuntimeMetricRecordPort;
  /**
   * Deterministic verification seam. It runs after successful preflight and
   * before any cache mutation, so injected failure cannot leave partial state.
   */
  registrationFailureInjection?: (
    entry: LayerDocumentSourceRuntimeResource,
    index: number
  ) => boolean;
}): LayerDocumentSourceRuntimeResourcePort {
  const entriesBySourceId = new Map<
    string,
    Map<string, LayerDocumentSourceRuntimeResource>
  >();
  const suspendedEntriesBySourceId = new Map<
    string,
    Map<string, LayerDocumentSourceRuntimeResource>
  >();
  let disposed = false;
  const failure = (
    code: Extract<
      LayerDocumentRuntimeBatchRegistrationResult,
      { ok: false }
    >["code"],
    message: string,
    failedIndex: number | null,
    retryable = false
  ): Extract<
    LayerDocumentRuntimeBatchRegistrationResult,
    { ok: false }
  > => ({
    ok: false,
    registeredCount: 0,
    code,
    message,
    failedIndex,
    retryable,
  });
  const preflightBatch = (
    entries: readonly LayerDocumentSourceRuntimeResource[]
  ): LayerDocumentRuntimeBatchPreflightResult => {
    if (disposed) {
      return {
        ok: false,
        acceptedCount: 0,
        code: "cache-disposed",
        message: "Source runtime cache is disposed",
        failedIndex: null,
      };
    }
    const keys = new Set<string>();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const size = entry?.resolution.logicalSize;
      if (
        !entry ||
        entry.sourceId.length === 0 ||
        entry.sourceResourceCacheKey.length === 0 ||
        !Number.isFinite(size?.width) ||
        !Number.isFinite(size?.height) ||
        (size?.width ?? 0) < 0 ||
        (size?.height ?? 0) < 0
      ) {
        return {
          ok: false,
          acceptedCount: 0,
          code: "invalid-entry",
          message: `Invalid runtime resource at index ${index}`,
          failedIndex: index,
        };
      }
      const key = JSON.stringify([
        entry.sourceId,
        entry.sourceResourceCacheKey,
      ]);
      if (keys.has(key)) {
        return {
          ok: false,
          acceptedCount: 0,
          code: "duplicate-entry",
          message: `Duplicate runtime resource at index ${index}`,
          failedIndex: index,
        };
      }
      keys.add(key);
    }
    return { ok: true, acceptedCount: entries.length };
  };
  const registerBatch = (
    entries: readonly LayerDocumentSourceRuntimeResource[]
  ): LayerDocumentRuntimeBatchRegistrationResult => {
    const preflight = preflightBatch(entries);
    if (!preflight.ok) {
      return failure(
        preflight.code,
        preflight.message,
        preflight.failedIndex
      );
    }
    try {
      for (let index = 0; index < entries.length; index += 1) {
        if (options?.registrationFailureInjection?.(
          entries[index],
          index
        )) {
          return failure(
            "registration-failed",
            `Runtime registration failed at index ${index}`,
            index,
            true
          );
        }
      }
    } catch {
      return failure(
        "registration-failed",
        "Runtime registration failure injection threw",
        null,
        true
      );
    }

    const replaced: LayerDocumentSourceRuntimeResource[] = [];
    entries.forEach((entry) => {
      const suspended =
        suspendedEntriesBySourceId.get(entry.sourceId);
      const suspendedPrevious =
        suspended?.get(entry.sourceResourceCacheKey);
      if (suspendedPrevious) {
        replaced.push(suspendedPrevious);
        suspended!.delete(
          entry.sourceResourceCacheKey
        );
        if (suspended!.size === 0) {
          suspendedEntriesBySourceId.delete(
            entry.sourceId
          );
        }
      }
      let sourceEntries = entriesBySourceId.get(entry.sourceId);
      if (!sourceEntries) {
        sourceEntries = new Map();
        entriesBySourceId.set(entry.sourceId, sourceEntries);
      }
      const previous = sourceEntries.get(
        entry.sourceResourceCacheKey
      );
      if (previous && previous !== entry) replaced.push(previous);
      sourceEntries.set(entry.sourceResourceCacheKey, entry);
    });
    replaced.forEach((entry) => disposeEntry(entry, options?.metrics));
    if (entries.length > 0) {
      options?.metrics?.increment(
        "layerDocumentSourceRuntimeRegistration",
        entries.length
      );
    }
    return { ok: true, registeredCount: entries.length };
  };

  const invalidate = (
    invalidation: LayerDocumentSourceRuntimeInvalidation
  ): number => {
    if (disposed) return 0;
    let removed = 0;
    if (invalidation.kind === "all") {
      entriesBySourceId.forEach((entries) => {
        entries.forEach((entry) =>
          disposeEntry(entry, options?.metrics)
        );
        removed += entries.size;
      });
      entriesBySourceId.clear();
      suspendedEntriesBySourceId.forEach(
        (entries) => {
          entries.forEach((entry) =>
            disposeEntry(entry, options?.metrics)
          );
          removed += entries.size;
        }
      );
      suspendedEntriesBySourceId.clear();
    } else if (invalidation.kind === "source") {
      const entries = entriesBySourceId.get(invalidation.sourceId);
      entries?.forEach((entry) =>
        disposeEntry(entry, options?.metrics)
      );
      removed = entries?.size ?? 0;
      entriesBySourceId.delete(invalidation.sourceId);
      const suspended =
        suspendedEntriesBySourceId.get(
          invalidation.sourceId
        );
      suspended?.forEach((entry) =>
        disposeEntry(entry, options?.metrics)
      );
      removed += suspended?.size ?? 0;
      suspendedEntriesBySourceId.delete(
        invalidation.sourceId
      );
    } else {
      const entries = entriesBySourceId.get(invalidation.sourceId);
      const entry = entries?.get(
        invalidation.sourceResourceCacheKey
      );
      if (entry) {
        disposeEntry(entry, options?.metrics);
        entries!.delete(invalidation.sourceResourceCacheKey);
        removed = 1;
        if (entries!.size === 0) {
          entriesBySourceId.delete(invalidation.sourceId);
        }
      }
    }
    if (removed > 0) {
      options?.metrics?.increment(
        "layerDocumentSourceRuntimeInvalidation",
        removed
      );
    }
    return removed;
  };

  const port: LayerDocumentSourceRuntimeResourcePort = {
    preflightBatch,
    registerBatch,
    register: (entry) => registerBatch([entry]),
    resolve: ({ sourceId, sourceResourceCacheKey }) =>
      entriesBySourceId.get(sourceId)?.get(
        sourceResourceCacheKey
      ) ?? null,
    invalidate,
    suspendSource: (sourceId) => {
      if (disposed) return 0;
      const entries =
        entriesBySourceId.get(sourceId);
      if (!entries) return 0;
      const previous =
        suspendedEntriesBySourceId.get(sourceId);
      previous?.forEach((entry) =>
        disposeEntry(entry, options?.metrics)
      );
      suspendedEntriesBySourceId.set(
        sourceId,
        entries
      );
      entriesBySourceId.delete(sourceId);
      return entries.size;
    },
    restoreSource: (sourceId) => {
      if (disposed) return 0;
      const suspended =
        suspendedEntriesBySourceId.get(sourceId);
      if (!suspended) return 0;
      const active =
        entriesBySourceId.get(sourceId);
      active?.forEach((entry) =>
        disposeEntry(entry, options?.metrics)
      );
      entriesBySourceId.set(
        sourceId,
        suspended
      );
      suspendedEntriesBySourceId.delete(sourceId);
      return suspended.size;
    },
    disposeSuspendedSource: (sourceId) => {
      if (disposed) return 0;
      const suspended =
        suspendedEntriesBySourceId.get(sourceId);
      suspended?.forEach((entry) =>
        disposeEntry(entry, options?.metrics)
      );
      const removed = suspended?.size ?? 0;
      suspendedEntriesBySourceId.delete(sourceId);
      return removed;
    },
    dispose: () => {
      if (disposed) return;
      invalidate({ kind: "all" });
      disposed = true;
    },
    createPsdResolver: () => (request) =>
      port.resolve({
        sourceId: request.sourceId,
        sourceResourceCacheKey: request.sourceResourceCacheKey,
      })?.resolution ?? null,
  };
  return port;
}

export function createLayerDocumentPsdRuntimeRegistrationBridge(
  resources: LayerDocumentSourceRuntimeResourcePort
): LayerDocumentPsdRuntimeRegistrationBridge {
  return {
    preflightResources: (entries) =>
      resources.preflightBatch(entries),
    registerResources: (entries) =>
      resources.registerBatch(entries),
  };
}
