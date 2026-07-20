import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPreviewCacheKey } from "@/engines/canvas/helpers/previewCacheKeyHelpers";
import { createPreviewCacheRuntime } from "@/engines/canvas/state/previewCacheRuntimeStore";
import type { PreviewRuntimeResource } from "@/engines/canvas/models/previewRuntimeModel";

function makeResource(
  key: string,
  generation: number,
  allocatedBytes: number,
  disposeCounts: Map<string, number>
): PreviewRuntimeResource {
  return {
    key,
    generation,
    sourceId: key,
    sourceFingerprint: `fingerprint-${key}`,
    quality: "high",
    estimatedBytes: allocatedBytes * 10,
    allocatedBytes,
    bitmap: {
      image: { width: 1, height: 1 } as HTMLCanvasElement,
      pixelSize: { width: 1, height: 1 },
      logicalSize: { width: 10, height: 10 },
      dispose: () =>
        disposeCounts.set(key, (disposeCounts.get(key) ?? 0) + 1),
    },
  };
}

const stableKeyInput = {
  sourceId: "runtime-eye-a",
  sourceIdentity: {
    sourceFileName: "character.psd",
    sourceKey: "layer-id:10",
  },
  sourceFingerprint: "fingerprint-a",
  quality: "high" as const,
  logicalSize: { width: 100, height: 80 },
};
const stableKey = buildPreviewCacheKey(stableKeyInput);
assert.equal(
  stableKey,
  buildPreviewCacheKey({ ...stableKeyInput, sourceId: "flattened-eye" })
);
assert.notEqual(
  stableKey,
  buildPreviewCacheKey({
    ...stableKeyInput,
    sourceFingerprint: "fingerprint-b",
  })
);
assert.notEqual(
  stableKey,
  buildPreviewCacheKey({ ...stableKeyInput, quality: "medium" })
);
assert.notEqual(
  stableKey,
  buildPreviewCacheKey({
    ...stableKeyInput,
    logicalSize: { width: 200, height: 80 },
  })
);
assert.notEqual(
  stableKey,
  buildPreviewCacheKey({
    ...stableKeyInput,
    sourceIdentity: {
      sourceFileName: "other.psd",
      sourceKey: "layer-id:10",
    },
  })
);

const disposeCounts = new Map<string, number>();
const cache = createPreviewCacheRuntime(1_000);
assert.equal(cache.getGeneration(), 0);
assert.equal(cache.get("missing"), null);
assert.equal(cache.getSnapshot().missCount, 1);
const generation1 = cache.beginBuild();
assert.equal(generation1, 1);
const resourceA = makeResource("a", generation1, 100, disposeCounts);
const commitA = cache.commit(resourceA);
assert.equal(commitA.status, "committed");
assert.equal(commitA.resource, resourceA);
assert.deepEqual(commitA.evictedKeys, []);
assert.equal(cache.get("a"), resourceA);
assert.equal(cache.getSnapshot().hitCount, 1);
assert.equal(cache.getSnapshot().trackedBytes, 100);

const duplicateA = makeResource("a", generation1, 100, disposeCounts);
const duplicateCommit = cache.commit(duplicateA);
assert.equal(duplicateCommit.status, "hit");
assert.equal(duplicateCommit.resource, resourceA);
assert.equal(disposeCounts.get("a"), 1);
assert.equal(cache.getSnapshot().trackedBytes, 100);

const generation2 = cache.beginBuild();
assert.equal(generation2, 2);
const staleResource = makeResource("stale", generation1, 50, disposeCounts);
const staleCommit = cache.commit(staleResource);
assert.equal(staleCommit.status, "stale");
assert.equal(staleCommit.resource, null);
assert.equal(disposeCounts.get("stale"), 1);
assert.equal(cache.peek("stale"), null);
assert.equal(cache.getSnapshot().trackedBytes, 100);

const lruDisposeCounts = new Map<string, number>();
const lruCache = createPreviewCacheRuntime(200);
const lruGeneration = lruCache.beginBuild();
const lruA = makeResource("lru-a", lruGeneration, 100, lruDisposeCounts);
const lruB = makeResource("lru-b", lruGeneration, 100, lruDisposeCounts);
const lruC = makeResource("lru-c", lruGeneration, 100, lruDisposeCounts);
lruCache.commit(lruA);
lruCache.commit(lruB);
assert.equal(lruCache.get("lru-a"), lruA);
const lruCommit = lruCache.commit(lruC);
assert.deepEqual(lruCommit.evictedKeys, ["lru-b"]);
assert.equal(lruDisposeCounts.get("lru-b"), 1);
assert.equal(lruCache.peek("lru-a"), lruA);
assert.equal(lruCache.peek("lru-b"), null);
assert.equal(lruCache.peek("lru-c"), lruC);
assert.equal(lruCache.getSnapshot().trackedBytes, 200);

const protectedDisposeCounts = new Map<string, number>();
const protectedCache = createPreviewCacheRuntime(100);
const protectedGeneration = protectedCache.beginBuild();
protectedCache.setActiveKeys(["protected-a", "protected-b"]);
protectedCache.commit(
  makeResource("protected-a", protectedGeneration, 80, protectedDisposeCounts)
);
protectedCache.commit(
  makeResource("protected-b", protectedGeneration, 80, protectedDisposeCounts)
);
assert.equal(protectedCache.getSnapshot().trackedBytes, 160);
assert.equal(protectedCache.getSnapshot().overBudget, true);
assert.deepEqual(protectedCache.setActiveKeys(["protected-a"]), [
  "protected-b",
]);
assert.equal(protectedDisposeCounts.get("protected-b"), 1);
assert.equal(protectedCache.getSnapshot().trackedBytes, 80);
assert.equal(protectedCache.getSnapshot().overBudget, false);
assert.deepEqual(protectedCache.setBudgetBytes(0), []);
assert.equal(protectedCache.getSnapshot().overBudget, true);
assert.deepEqual(protectedCache.setActiveKeys([]), ["protected-a"]);
assert.equal(protectedDisposeCounts.get("protected-a"), 1);
assert.equal(protectedCache.getSnapshot().trackedBytes, 0);

const cleanupDisposeCounts = new Map<string, number>();
const cleanupCache = createPreviewCacheRuntime(Number.POSITIVE_INFINITY);
const cleanupGeneration = cleanupCache.beginBuild();
cleanupCache.commit(
  makeResource("cleanup-a", cleanupGeneration, 120, cleanupDisposeCounts)
);
cleanupCache.commit(
  makeResource("cleanup-b", cleanupGeneration, 180, cleanupDisposeCounts)
);
assert.equal(cleanupCache.remove("cleanup-a"), true);
assert.equal(cleanupCache.remove("cleanup-a"), false);
assert.equal(cleanupDisposeCounts.get("cleanup-a"), 1);
assert.equal(cleanupCache.getSnapshot().trackedBytes, 180);
assert.deepEqual(cleanupCache.retainKeys(["cleanup-b"]), []);
assert.deepEqual(cleanupCache.retainKeys([]), ["cleanup-b"]);
assert.equal(cleanupDisposeCounts.get("cleanup-b"), 1);
assert.equal(cleanupCache.getSnapshot().trackedBytes, 0);
cleanupCache.dispose();
cleanupCache.dispose();
assert.equal(cleanupDisposeCounts.get("cleanup-b"), 1);
assert.deepEqual(cleanupCache.getSnapshot(), {
  generation: 1,
  budgetBytes: Number.POSITIVE_INFINITY,
  trackedBytes: 0,
  size: 0,
  hitCount: 0,
  missCount: 0,
  activeKeys: [],
  overBudget: false,
  disposed: true,
});

const lateResource = makeResource(
  "late",
  cleanupGeneration,
  50,
  cleanupDisposeCounts
);
assert.equal(cleanupCache.commit(lateResource).status, "disposed");
assert.equal(cleanupDisposeCounts.get("late"), 1);
assert.equal(cleanupCache.getSnapshot().trackedBytes, 0);

const storeSource = readFileSync(
  "src/engines/canvas/state/previewCacheRuntimeStore.ts",
  "utf8"
);
const factorySource = readFileSync(
  "src/engines/canvas/factories/previewBitmapFactory.ts",
  "utf8"
);
assert.equal(/createPreviewBitmapResource|createImageBitmap/.test(storeSource), false);
assert.equal(/PreviewCache|previewCache/.test(factorySource), false);

console.log("Preview cache runtime verification passed");
