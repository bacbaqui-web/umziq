import assert from "node:assert/strict";
import {
  buildPreviewCacheGeneration,
  getPreviewBuildCacheKeys,
} from "@/engines/canvas/controllers/buildPreviewCacheGeneration";
import {
  getPreviewBuildSourceSetKey,
  getPreviewLifecycleRetainedCacheKeys,
} from "@/engines/canvas/helpers/previewBuildSourceHelpers";
import { createPreviewDrawableSourceResolver } from "@/engines/canvas/helpers/previewResolverHelpers";
import type {
  PreviewBitmapFactoryPort,
  PreviewBuildSource,
} from "@/engines/canvas/models/previewBuildModel";
import type { PreviewCacheRuntime } from "@/engines/canvas/models/previewCacheModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import { PREVIEW_QUALITY_SCALE } from "@/engines/canvas/constants/previewQualityConstants";
import { createPreviewCacheRuntime } from "@/engines/canvas/state/previewCacheRuntimeStore";

function makeSource(
  sourceId: string,
  fingerprint: string,
  width: number,
  height: number
): PreviewBuildSource {
  return {
    sourceId,
    sourceIds: [sourceId],
    sourceIdentity: {
      sourceFileName: "character.psd",
      sourceKey: `layer-id:${sourceId}`,
    },
    sourceFingerprint: fingerprint,
    sourceCanvas: { width, height } as HTMLCanvasElement,
    logicalSize: { width, height },
  };
}

const disposeCounts = new Map<string, number>();
let factoryCallCount = 0;
const factory: PreviewBitmapFactoryPort = async (input) => {
  factoryCallCount += 1;
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

async function prepareLifecycleBuild(
  cache: PreviewCacheRuntime,
  sources: readonly PreviewBuildSource[],
  quality: ResolvedPreviewQuality,
  previousKeys: ReadonlyMap<string, string>
) {
  const buildKeys = getPreviewBuildCacheKeys(sources, quality);
  cache.setActiveKeys([
    ...new Set([...previousKeys.values(), ...buildKeys]),
  ]);
  return buildPreviewCacheGeneration({ sources, quality, cache, factory });
}

function activateLifecycleBuild(
  cache: PreviewCacheRuntime,
  sources: readonly PreviewBuildSource[],
  resourceKeyBySourceId: ReadonlyMap<string, string>
) {
  cache.setActiveKeys([...new Set(resourceKeyBySourceId.values())]);
  return cache.retainKeys(getPreviewLifecycleRetainedCacheKeys(sources));
}

function resolve(
  cache: PreviewCacheRuntime,
  keys: ReadonlyMap<string, string>,
  source: PreviewBuildSource
) {
  return createPreviewDrawableSourceResolver(cache, keys)({
    renderItemId: `render-${source.sourceId}`,
    drawableId: `drawable-${source.sourceId}`,
    sourceId: source.sourceId,
    logicalSize: source.logicalSize,
    originalSource: {
      kind: "original",
      image: source.sourceCanvas,
      pixelSize: {
        width: source.sourceCanvas.width,
        height: source.sourceCanvas.height,
      },
    },
  });
}

const cache = createPreviewCacheRuntime(Number.POSITIVE_INFINITY);
const sourceA = makeSource("a", "fingerprint-a", 20, 20);
const sourceB = makeSource("b", "fingerprint-b", 40, 20);
const importedSources = [sourceA, sourceB];
const importResult = await prepareLifecycleBuild(
  cache,
  importedSources,
  "high",
  new Map()
);
assert.equal(importResult.status, "completed");
activateLifecycleBuild(cache, importedSources, importResult.resourceKeyBySourceId);
assert.equal(factoryCallCount, 2);
assert.equal(cache.getSnapshot().size, 2);
assert.equal(resolve(cache, importResult.resourceKeyBySourceId, sourceA)?.kind, "preview");

const sourceC = makeSource("c", "fingerprint-c", 10, 10);
const sourcesAfterImport = [...importedSources, sourceC];
assert.notEqual(
  getPreviewBuildSourceSetKey(importedSources),
  getPreviewBuildSourceSetKey(sourcesAfterImport)
);
const secondImportResult = await prepareLifecycleBuild(
  cache,
  sourcesAfterImport,
  "high",
  importResult.resourceKeyBySourceId
);
assert.equal(secondImportResult.status, "completed");
activateLifecycleBuild(
  cache,
  sourcesAfterImport,
  secondImportResult.resourceKeyBySourceId
);
assert.equal(factoryCallCount, 3);
assert.equal(cache.getSnapshot().size, 3);

const unchangedSources = sourcesAfterImport.map((source) => ({
  ...source,
  sourceIds: [...source.sourceIds],
}));
assert.equal(
  getPreviewBuildSourceSetKey(sourcesAfterImport),
  getPreviewBuildSourceSetKey(unchangedSources)
);
const unchangedResult = await prepareLifecycleBuild(
  cache,
  unchangedSources,
  "high",
  secondImportResult.resourceKeyBySourceId
);
assert.equal(unchangedResult.status, "completed");
assert.equal(factoryCallCount, 3);

const refreshedB = makeSource("b", "fingerprint-b-2", 40, 20);
const refreshedSources = [sourceA, refreshedB, sourceC];
assert.notEqual(
  getPreviewBuildSourceSetKey(sourcesAfterImport),
  getPreviewBuildSourceSetKey(refreshedSources)
);
const oldBKey = secondImportResult.resourceKeyBySourceId.get("b");
assert.ok(oldBKey);
const refreshResult = await prepareLifecycleBuild(
  cache,
  refreshedSources,
  "high",
  secondImportResult.resourceKeyBySourceId
);
assert.equal(refreshResult.status, "completed");
assert.equal(factoryCallCount, 4);
assert.equal(
  resolve(cache, secondImportResult.resourceKeyBySourceId, sourceB)?.kind,
  "preview"
);
const refreshRemoved = activateLifecycleBuild(
  cache,
  refreshedSources,
  refreshResult.resourceKeyBySourceId
);
assert.deepEqual(refreshRemoved, [oldBKey]);
assert.equal(disposeCounts.get(oldBKey), 1);
assert.equal(resolve(cache, secondImportResult.resourceKeyBySourceId, sourceB), null);
assert.equal(resolve(cache, refreshResult.resourceKeyBySourceId, refreshedB)?.kind, "preview");

const lowResult = await prepareLifecycleBuild(
  cache,
  refreshedSources,
  "low",
  refreshResult.resourceKeyBySourceId
);
assert.equal(lowResult.status, "completed");
activateLifecycleBuild(cache, refreshedSources, lowResult.resourceKeyBySourceId);
assert.equal(factoryCallCount, 7);
assert.equal(cache.getSnapshot().size, 6);
const cHighKey = refreshResult.resourceKeyBySourceId.get("c");
const cLowKey = lowResult.resourceKeyBySourceId.get("c");
assert.ok(cHighKey);
assert.ok(cLowKey);
const trackedBeforeDelete = cache.getSnapshot().trackedBytes;

const sourcesAfterDelete = [sourceA, refreshedB];
const deleteResult = await prepareLifecycleBuild(
  cache,
  sourcesAfterDelete,
  "low",
  lowResult.resourceKeyBySourceId
);
assert.equal(deleteResult.status, "completed");
assert.equal(factoryCallCount, 7);
assert.equal(resolve(cache, lowResult.resourceKeyBySourceId, sourceC)?.kind, "preview");
const deleteRemoved = activateLifecycleBuild(
  cache,
  sourcesAfterDelete,
  deleteResult.resourceKeyBySourceId
);
assert.deepEqual(new Set(deleteRemoved), new Set([cHighKey, cLowKey]));
assert.equal(disposeCounts.get(cHighKey), 1);
assert.equal(disposeCounts.get(cLowKey), 1);
assert.equal(resolve(cache, lowResult.resourceKeyBySourceId, sourceC), null);
assert.ok(cache.getSnapshot().trackedBytes < trackedBeforeDelete);
assert.ok(cache.peek(refreshResult.resourceKeyBySourceId.get("a") ?? ""));
assert.equal(cache.getSnapshot().generation, 6);

cache.dispose();
assert.equal(cache.getSnapshot().trackedBytes, 0);
assert.equal(cache.getSnapshot().size, 0);

console.log("Preview source lifecycle verification passed");
