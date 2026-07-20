import { createPreviewBitmapResource } from "@/engines/canvas/factories/previewBitmapFactory";
import { buildPreviewCacheKey } from "@/engines/canvas/helpers/previewCacheKeyHelpers";
import type {
  PreviewBuildSource,
  PreviewCacheBuildError,
  PreviewCacheBuildOptions,
  PreviewCacheBuildResult,
} from "@/engines/canvas/models/previewBuildModel";

const DEFAULT_BUILD_CONCURRENCY = 4;

function getSourceCacheKey(
  source: PreviewBuildSource,
  quality: PreviewCacheBuildOptions["quality"]
): string {
  return buildPreviewCacheKey({
    sourceId: source.sourceId,
    sourceIdentity: source.sourceIdentity,
    sourceFingerprint: source.sourceFingerprint,
    quality,
    logicalSize: source.logicalSize,
  });
}

export function getPreviewBuildCacheKeys(
  sources: readonly PreviewBuildSource[],
  quality: PreviewCacheBuildOptions["quality"]
): readonly string[] {
  return sources.map((source) => getSourceCacheKey(source, quality));
}

export async function buildPreviewCacheGeneration({
  sources,
  quality,
  cache,
  factory = createPreviewBitmapResource,
  concurrency = DEFAULT_BUILD_CONCURRENCY,
  onProgress,
}: PreviewCacheBuildOptions): Promise<PreviewCacheBuildResult> {
  const generation = cache.beginBuild();
  const errors: PreviewCacheBuildError[] = [];
  const resourceKeyBySourceId = new Map<string, string>();
  const workerCount = Math.max(
    1,
    Math.min(sources.length || 1, Math.floor(concurrency) || 1)
  );
  let nextIndex = 0;
  let completedCount = 0;

  const reportProgress = () =>
    onProgress?.({
      generation,
      quality,
      completedCount,
      totalCount: sources.length,
      failedCount: errors.length,
    });

  reportProgress();

  const buildSource = async (source: PreviewBuildSource) => {
    const key = getSourceCacheKey(source, quality);
    let resource = cache.peek(key);

    if (!resource) {
      const factoryResult = await factory({
        key,
        generation,
        sourceId: source.sourceId,
        sourceFingerprint: source.sourceFingerprint,
        quality,
        sourceCanvas: source.sourceCanvas,
        logicalSize: source.logicalSize,
      });

      if (!factoryResult.ok) {
        errors.push({
          sourceId: source.sourceId,
          code: factoryResult.error.code,
          message: factoryResult.error.message,
        });
      } else {
        const commitResult = cache.commit(factoryResult.resource);
        resource = commitResult.resource;
      }
    }

    if (resource) {
      source.sourceIds.forEach((sourceId) =>
        resourceKeyBySourceId.set(sourceId, key)
      );
    } else if (cache.getGeneration() === generation && errors.length === 0) {
      errors.push({
        sourceId: source.sourceId,
        code: "cache-resource-unavailable",
        message: "Preview bitmap was not retained by the runtime cache",
      });
    }

    completedCount += 1;
    reportProgress();
  };

  const runWorker = async () => {
    while (nextIndex < sources.length) {
      const source = sources[nextIndex];
      nextIndex += 1;
      if (source) await buildSource(source);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, runWorker));

  if (cache.getGeneration() !== generation) {
    return {
      status: "stale",
      generation,
      quality,
      resourceKeyBySourceId,
      errors,
    };
  }

  return {
    status: errors.length === 0 ? "completed" : "failed",
    generation,
    quality,
    resourceKeyBySourceId,
    errors,
  };
}
