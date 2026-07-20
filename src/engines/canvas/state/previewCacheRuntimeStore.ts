import type {
  PreviewCacheCommitResult,
  PreviewCacheRuntime,
  PreviewCacheSnapshot,
} from "@/engines/canvas/models/previewCacheModel";
import type { PreviewRuntimeResource } from "@/engines/canvas/models/previewRuntimeModel";

type PreviewCacheEntry = {
  readonly resource: PreviewRuntimeResource;
  lastUsed: number;
};

function normalizeBudgetBytes(value: number): number {
  if (value === Number.POSITIVE_INFINITY) return value;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeAllocatedBytes(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function createPreviewCacheRuntime(
  initialBudgetBytes: number
): PreviewCacheRuntime {
  const entries = new Map<string, PreviewCacheEntry>();
  const activeKeys = new Set<string>();
  let generation = 0;
  let budgetBytes = normalizeBudgetBytes(initialBudgetBytes);
  let trackedBytes = 0;
  let accessClock = 0;
  let hitCount = 0;
  let missCount = 0;
  let disposed = false;

  const touch = (entry: PreviewCacheEntry): void => {
    accessClock += 1;
    entry.lastUsed = accessClock;
  };

  const disposeEntry = (key: string, entry: PreviewCacheEntry): void => {
    if (!entries.delete(key)) return;
    trackedBytes = Math.max(
      0,
      trackedBytes - normalizeAllocatedBytes(entry.resource.allocatedBytes)
    );
    activeKeys.delete(key);
    entry.resource.bitmap.dispose();
  };

  const evictToBudget = (): readonly string[] => {
    if (trackedBytes <= budgetBytes) return [];

    const candidates = Array.from(entries.entries())
      .filter(([key]) => !activeKeys.has(key))
      .sort(
        ([keyA, entryA], [keyB, entryB]) =>
          entryA.lastUsed - entryB.lastUsed ||
          (keyA < keyB ? -1 : keyA > keyB ? 1 : 0)
      );
    const evictedKeys: string[] = [];

    for (const [key, entry] of candidates) {
      if (trackedBytes <= budgetBytes) break;
      disposeEntry(key, entry);
      evictedKeys.push(key);
    }

    return evictedKeys;
  };

  const clear = (): void => {
    Array.from(entries.entries()).forEach(([key, entry]) =>
      disposeEntry(key, entry)
    );
    activeKeys.clear();
  };

  const getSnapshot = (): PreviewCacheSnapshot => ({
    generation,
    budgetBytes,
    trackedBytes,
    size: entries.size,
    hitCount,
    missCount,
    activeKeys: Array.from(activeKeys).sort(),
    overBudget: trackedBytes > budgetBytes,
    disposed,
  });

  return {
    beginBuild: () => {
      if (!disposed) generation += 1;
      return generation;
    },
    getGeneration: () => generation,
    get: (key) => {
      const entry = entries.get(key);
      if (!entry || disposed) {
        missCount += 1;
        return null;
      }
      hitCount += 1;
      touch(entry);
      return entry.resource;
    },
    peek: (key) => entries.get(key)?.resource ?? null,
    commit: (resource): PreviewCacheCommitResult => {
      if (disposed) {
        resource.bitmap.dispose();
        return { status: "disposed", resource: null, evictedKeys: [] };
      }
      if (resource.generation !== generation) {
        resource.bitmap.dispose();
        return { status: "stale", resource: null, evictedKeys: [] };
      }

      const existing = entries.get(resource.key);
      if (existing) {
        hitCount += 1;
        touch(existing);
        if (existing.resource !== resource) resource.bitmap.dispose();
        return {
          status: "hit",
          resource: existing.resource,
          evictedKeys: [],
        };
      }

      const entry = { resource, lastUsed: 0 };
      touch(entry);
      entries.set(resource.key, entry);
      trackedBytes += normalizeAllocatedBytes(resource.allocatedBytes);
      const evictedKeys = evictToBudget();

      return {
        status: "committed",
        resource: entries.get(resource.key)?.resource ?? null,
        evictedKeys,
      };
    },
    setActiveKeys: (keys) => {
      activeKeys.clear();
      keys.forEach((key) => {
        activeKeys.add(key);
        const entry = entries.get(key);
        if (!entry) return;
        touch(entry);
      });
      return evictToBudget();
    },
    setBudgetBytes: (nextBudgetBytes) => {
      budgetBytes = normalizeBudgetBytes(nextBudgetBytes);
      return evictToBudget();
    },
    remove: (key) => {
      const entry = entries.get(key);
      if (!entry) return false;
      disposeEntry(key, entry);
      return true;
    },
    retainKeys: (keys) => {
      const retainedKeys = new Set(keys);
      const removedKeys: string[] = [];
      Array.from(entries.entries()).forEach(([key, entry]) => {
        if (retainedKeys.has(key)) return;
        disposeEntry(key, entry);
        removedKeys.push(key);
      });
      return removedKeys;
    },
    clear,
    getSnapshot,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clear();
    },
  };
}
