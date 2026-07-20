import assert from "node:assert/strict";
import {
  buildPreviewCacheGeneration,
  getPreviewBuildCacheKeys,
} from "@/engines/canvas/controllers/buildPreviewCacheGeneration";
import { resolveAutomaticPreviewQuality } from "@/engines/canvas/helpers/previewAutomaticQualityHelpers";
import {
  getPreviewLifecycleRetainedCacheKeys,
  toPreviewMemorySources,
} from "@/engines/canvas/helpers/previewBuildSourceHelpers";
import { estimatePreviewMemoryByQuality } from "@/engines/canvas/helpers/previewMemoryHelpers";
import type {
  PreviewBitmapFactoryPort,
  PreviewBuildSource,
} from "@/engines/canvas/models/previewBuildModel";
import type { PreviewCacheRuntime } from "@/engines/canvas/models/previewCacheModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import { PREVIEW_QUALITY_SCALE } from "@/engines/canvas/constants/previewQualityConstants";
import { createPreviewCacheRuntime } from "@/engines/canvas/state/previewCacheRuntimeStore";

function makeSource(
  index: number,
  fingerprint = `fingerprint-${index}`,
  size = 512
): PreviewBuildSource {
  const sourceId = `source-${index}`;
  return {
    sourceId,
    sourceIds: [sourceId],
    sourceIdentity: {
      sourceFileName: "stress.psd",
      sourceKey: `layer-id:${index}`,
    },
    sourceFingerprint: fingerprint,
    sourceCanvas: { width: size, height: size } as HTMLCanvasElement,
    logicalSize: { width: size, height: size },
  };
}

function createFactoryState() {
  const disposeCounts = new Map<string, number>();
  let callCount = 0;
  const factory: PreviewBitmapFactoryPort = async (input) => {
    callCount += 1;
    const scale = PREVIEW_QUALITY_SCALE[input.quality];
    const width = Math.ceil(input.sourceCanvas.width * scale);
    const height = Math.ceil(input.sourceCanvas.height * scale);
    const allocatedBytes = width * height * 4;
    return {
      ok: true,
      resource: {
        key: input.key,
        generation: input.generation,
        sourceId: input.sourceId,
        sourceFingerprint: input.sourceFingerprint,
        quality: input.quality,
        estimatedBytes: allocatedBytes,
        allocatedBytes,
        bitmap: {
          image: { width, height } as ImageBitmap,
          pixelSize: { width, height },
          logicalSize: { ...input.logicalSize },
          dispose: () =>
            disposeCounts.set(
              input.key,
              (disposeCounts.get(input.key) ?? 0) + 1
            ),
        },
      },
    };
  };
  return {
    factory,
    disposeCounts,
    getCallCount: () => callCount,
  };
}

async function transition(
  cache: PreviewCacheRuntime,
  sources: readonly PreviewBuildSource[],
  quality: ResolvedPreviewQuality,
  previousKeys: ReadonlyMap<string, string>,
  factory: PreviewBitmapFactoryPort
) {
  cache.setActiveKeys([
    ...new Set([
      ...previousKeys.values(),
      ...getPreviewBuildCacheKeys(sources, quality),
    ]),
  ]);
  const result = await buildPreviewCacheGeneration({
    sources,
    quality,
    cache,
    factory,
    concurrency: 8,
  });
  assert.equal(result.status, "completed");
  cache.setActiveKeys([...new Set(result.resourceKeyBySourceId.values())]);
  cache.retainKeys(getPreviewLifecycleRetainedCacheKeys(sources));
  return result.resourceKeyBySourceId;
}

const largeSources = Array.from({ length: 1_000 }, (_, index) =>
  makeSource(index, `large-${index}`, 8_192)
);
const largeEstimates = estimatePreviewMemoryByQuality(
  toPreviewMemorySources(largeSources)
);
assert.equal(largeEstimates.original.sourceCount, 1_000);
assert.equal(
  largeEstimates.original.estimatedBytes,
  1_000 * 8_192 * 8_192 * 4
);
const largeAuto = resolveAutomaticPreviewQuality({
  preference: "auto",
  estimates: largeEstimates,
  deviceMemoryGb: 16,
});
assert.equal(largeAuto.resolvedQuality, "low");
assert.equal(largeAuto.fitsBudget, false);

const sources = Array.from({ length: 40 }, (_, index) => makeSource(index));
const runtime = createPreviewCacheRuntime(Number.POSITIVE_INFINITY);
const factoryState = createFactoryState();
let activeKeys: ReadonlyMap<string, string> = new Map();
const qualities: readonly ResolvedPreviewQuality[] = [
  "original",
  "high",
  "medium",
  "low",
];

for (const quality of qualities) {
  activeKeys = await transition(
    runtime,
    sources,
    quality,
    activeKeys,
    factoryState.factory
  );
}
assert.equal(factoryState.getCallCount(), sources.length * qualities.length);
assert.equal(runtime.getSnapshot().size, sources.length * qualities.length);
const fullQualityTrackedBytes = runtime.getSnapshot().trackedBytes;

for (let cycle = 0; cycle < 12; cycle += 1) {
  for (const quality of [...qualities].reverse()) {
    activeKeys = await transition(
      runtime,
      sources,
      quality,
      activeKeys,
      factoryState.factory
    );
  }
  assert.equal(runtime.getSnapshot().trackedBytes, fullQualityTrackedBytes);
  assert.equal(runtime.getSnapshot().size, sources.length * qualities.length);
}
assert.equal(factoryState.getCallCount(), sources.length * qualities.length);

let lifecycleSources = [...sources];
for (let cycle = 0; cycle < 20; cycle += 1) {
  const temporary = makeSource(10_000 + cycle, `temporary-${cycle}`, 128);
  const baselineBytes = runtime.getSnapshot().trackedBytes;
  lifecycleSources = [...lifecycleSources, temporary];
  activeKeys = await transition(
    runtime,
    lifecycleSources,
    "low",
    activeKeys,
    factoryState.factory
  );
  assert.ok(runtime.getSnapshot().trackedBytes > baselineBytes);
  lifecycleSources = lifecycleSources.slice(0, -1);
  activeKeys = await transition(
    runtime,
    lifecycleSources,
    "low",
    activeKeys,
    factoryState.factory
  );
  assert.equal(runtime.getSnapshot().trackedBytes, baselineBytes);
}

for (let cycle = 0; cycle < 20; cycle += 1) {
  const refreshedIndex = cycle % lifecycleSources.length;
  lifecycleSources = lifecycleSources.map((source, index) =>
    index === refreshedIndex
      ? {
          ...source,
          sourceFingerprint: `refresh-${cycle}`,
        }
      : source
  );
  activeKeys = await transition(
    runtime,
    lifecycleSources,
    "low",
    activeKeys,
    factoryState.factory
  );
  assert.equal(
    runtime.getSnapshot().size,
    sources.length * qualities.length -
      (cycle + 1) * (qualities.length - 1)
  );
}
const refreshedTrackedBytes = runtime.getSnapshot().trackedBytes;
for (let cycle = 0; cycle < 20; cycle += 1) {
  activeKeys = await transition(
    runtime,
    lifecycleSources,
    "low",
    activeKeys,
    factoryState.factory
  );
  assert.equal(runtime.getSnapshot().trackedBytes, refreshedTrackedBytes);
}

const raceCache = createPreviewCacheRuntime(Number.POSITIVE_INFINITY);
const raceSource = makeSource(99_999, "race", 256);
const pendingResolvers: Array<() => void> = [];
let staleDisposeCount = 0;
const deferredFactory: PreviewBitmapFactoryPort = (input) =>
  new Promise((resolve) => {
    pendingResolvers.push(() => {
      const scale = PREVIEW_QUALITY_SCALE[input.quality];
      const width = Math.ceil(input.sourceCanvas.width * scale);
      const height = Math.ceil(input.sourceCanvas.height * scale);
      resolve({
        ok: true,
        resource: {
          key: input.key,
          generation: input.generation,
          sourceId: input.sourceId,
          sourceFingerprint: input.sourceFingerprint,
          quality: input.quality,
          estimatedBytes: width * height * 4,
          allocatedBytes: width * height * 4,
          bitmap: {
            image: { width, height } as ImageBitmap,
            pixelSize: { width, height },
            logicalSize: { ...input.logicalSize },
            dispose: () => {
              staleDisposeCount += 1;
            },
          },
        },
      });
    });
  });
const raceBuilds = Array.from({ length: 24 }, (_, index) =>
  buildPreviewCacheGeneration({
    sources: [raceSource],
    quality: qualities[index % qualities.length] ?? "low",
    cache: raceCache,
    factory: deferredFactory,
  })
);
assert.equal(pendingResolvers.length, raceBuilds.length);
pendingResolvers.forEach((release) => release());
const raceResults = await Promise.all(raceBuilds);
assert.equal(raceResults.filter((result) => result.status === "completed").length, 1);
assert.equal(raceResults.filter((result) => result.status === "stale").length, 23);
assert.equal(staleDisposeCount, 23);
assert.equal(raceCache.getSnapshot().generation, 24);
assert.equal(raceCache.getSnapshot().size, 1);

const retainedRaceBytes = raceCache.getSnapshot().trackedBytes;
raceCache.dispose();
assert.equal(staleDisposeCount, 24);
assert.ok(retainedRaceBytes > 0);
assert.equal(raceCache.getSnapshot().trackedBytes, 0);

const trackedBeforeUnmount = runtime.getSnapshot().trackedBytes;
assert.ok(trackedBeforeUnmount > 0);
runtime.dispose();
assert.equal(runtime.getSnapshot().trackedBytes, 0);
assert.equal(runtime.getSnapshot().size, 0);
assert.ok(
  Array.from(factoryState.disposeCounts.values()).every((count) => count === 1)
);

console.log("Preview sprint stress verification passed");
