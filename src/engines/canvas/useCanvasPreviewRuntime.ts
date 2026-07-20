import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RenderDrawableSourceResolver } from "@/engines/playback-render";
import { readPreviewDeviceMemoryGb } from "@/engines/canvas/adapters/previewEnvironmentAdapter";
import {
  buildPreviewCacheGeneration,
  getPreviewBuildCacheKeys,
} from "@/engines/canvas/controllers/buildPreviewCacheGeneration";
import { resolveAutomaticPreviewQuality } from "@/engines/canvas/helpers/previewAutomaticQualityHelpers";
import {
  getPreviewBuildSourceSetKey,
  getPreviewLifecycleRetainedCacheKeys,
  toPreviewMemorySources,
} from "@/engines/canvas/helpers/previewBuildSourceHelpers";
import { estimatePreviewMemoryByQuality } from "@/engines/canvas/helpers/previewMemoryHelpers";
import { createPreviewDrawableSourceResolver } from "@/engines/canvas/helpers/previewResolverHelpers";
import { createRuntimeMetricRecordPort } from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import type {
  PreviewBuildReadModel,
  PreviewBuildSource,
} from "@/engines/canvas/models/previewBuildModel";
import type { PreviewCacheRuntime } from "@/engines/canvas/models/previewCacheModel";
import type { PreviewQualityPreference } from "@/engines/canvas/models/previewQualityModel";
import { createPreviewCacheRuntime } from "@/engines/canvas/state/previewCacheRuntimeStore";
import { createDirtyState } from "@/engines/canvas/state/dirtyStateStore";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
import { createCompositionPreviewCacheRuntime } from "@/engines/canvas/state/compositionPreviewCacheStore";
import { createPreviewSurfaceCacheRuntime } from "@/engines/canvas/state/previewSurfaceCacheStore";
import { PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES } from "@/engines/canvas/constants/previewAutomaticQualityConstants";

export function useCanvasPreviewRuntime(
  sources: readonly PreviewBuildSource[]
) {
  const [preference, setPreference] =
    useState<PreviewQualityPreference>("auto");
  const [deviceMemoryGb] = useState(readPreviewDeviceMemoryGb);
  const [metrics] = useState(createRuntimeMetricsResource);
  const [dirty] = useState(createDirtyState);
  const [surfaceCache] = useState(() =>
    createPreviewSurfaceCacheRuntime({
      metrics: createRuntimeMetricRecordPort(metrics),
    })
  );
  const [compositionCache] = useState(() =>
    createCompositionPreviewCacheRuntime({
      releaseSurface: surfaceCache.releaseSurface,
    })
  );
  const cacheRef = useRef<PreviewCacheRuntime | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = createPreviewCacheRuntime(
      PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES
    );
  }
  const activeResourceKeyBySourceIdRef = useRef<ReadonlyMap<string, string>>(
    new Map()
  );
  const sourcesRef = useRef(sources);
  const sourceSetKey = useMemo(
    () => getPreviewBuildSourceSetKey(sources),
    [sources]
  );
  const [activeGeneration, setActiveGeneration] = useState<number | null>(null);
  const activeGenerationRef = useRef<number | null>(null);
  const activeQualityRef = useRef<PreviewBuildReadModel["activeQuality"]>(null);
  const memoryEstimates = useMemo(
    () => estimatePreviewMemoryByQuality(toPreviewMemorySources(sources)),
    [sources]
  );
  const automaticQuality = useMemo(
    () =>
      resolveAutomaticPreviewQuality({
        preference,
        estimates: memoryEstimates,
        deviceMemoryGb,
      }),
    [deviceMemoryGb, memoryEstimates, preference]
  );
  const [build, setBuild] = useState<PreviewBuildReadModel>({
    status: "idle",
    generation: 0,
    activeGeneration: null,
    activeQuality: null,
    quality: automaticQuality.resolvedQuality,
    completedCount: 0,
    totalCount: 0,
    failedCount: 0,
  });

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    if (cacheRef.current?.getSnapshot().disposed) {
      cacheRef.current = createPreviewCacheRuntime(
        PREVIEW_FALLBACK_MEMORY_BUDGET_BYTES
      );
    }
    return () => {
      cacheRef.current?.dispose();
      compositionCache.dispose();
      surfaceCache.dispose();
    };
  }, [compositionCache, surfaceCache]);

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    if (!cache) return;
    const buildSources = sourcesRef.current;
    const previousKeys = activeResourceKeyBySourceIdRef.current;
    const buildKeys = getPreviewBuildCacheKeys(
      buildSources,
      automaticQuality.resolvedQuality
    );
    cache.setBudgetBytes(automaticQuality.budgetBytes);
    cache.setActiveKeys([
      ...new Set([...previousKeys.values(), ...buildKeys]),
    ]);

    void buildPreviewCacheGeneration({
      sources: buildSources,
      quality: automaticQuality.resolvedQuality,
      cache,
      onProgress: (progress) => {
        if (cancelled || cache.getGeneration() !== progress.generation) return;
        setBuild({
          status: "building",
          generation: progress.generation,
          activeGeneration: activeGenerationRef.current,
          activeQuality: activeQualityRef.current,
          quality: progress.quality,
          completedCount: progress.completedCount,
          totalCount: progress.totalCount,
          failedCount: progress.failedCount,
        });
      },
    }).then((result) => {
      if (cancelled || cache.getGeneration() !== result.generation) return;

      if (result.status === "completed") {
        activeResourceKeyBySourceIdRef.current =
          result.resourceKeyBySourceId;
        cache.setActiveKeys([
          ...new Set(result.resourceKeyBySourceId.values()),
        ]);
        cache.retainKeys(
          getPreviewLifecycleRetainedCacheKeys(buildSources)
        );
        activeGenerationRef.current = result.generation;
        activeQualityRef.current = result.quality;
        setActiveGeneration(result.generation);
        setBuild({
          status: "ready",
          generation: result.generation,
          activeGeneration: result.generation,
          activeQuality: result.quality,
          quality: result.quality,
          completedCount: buildSources.length,
          totalCount: buildSources.length,
          failedCount: 0,
        });
        return;
      }

      cache.setActiveKeys([...new Set(previousKeys.values())]);
      setBuild({
        status: "error",
        generation: result.generation,
        activeGeneration: activeGenerationRef.current,
        activeQuality: activeQualityRef.current,
        quality: result.quality,
        completedCount: buildSources.length,
        totalCount: buildSources.length,
        failedCount: result.errors.length,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    automaticQuality.budgetBytes,
    automaticQuality.resolvedQuality,
    sourceSetKey,
  ]);

  const resolveDrawableSource = useCallback<RenderDrawableSourceResolver>(
    (request) => {
      if (activeGeneration === null) return null;
      const cache = cacheRef.current;
      if (!cache) return null;
      return createPreviewDrawableSourceResolver(
        cache,
        activeResourceKeyBySourceIdRef.current
      )(request);
    },
    [activeGeneration]
  );

  const syncActiveSourceIds = useCallback((sourceIds: readonly string[]) => {
    const activeKeys = sourceIds.flatMap((sourceId) => {
      const key = activeResourceKeyBySourceIdRef.current.get(sourceId);
      return key ? [key] : [];
    });
    cacheRef.current?.setActiveKeys([...new Set(activeKeys)]);
  }, []);

  return {
    preference,
    automaticQuality,
    memoryEstimates,
    build,
    metrics,
    dirty,
    compositionCache,
    surfaceCache,
    resolveDrawableSource,
    syncActiveSourceIds,
    commands: { setPreference },
  };
}
