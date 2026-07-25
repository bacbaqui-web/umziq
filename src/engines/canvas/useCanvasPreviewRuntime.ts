import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  readPreviewDeviceMemoryGb,
} from "@/engines/canvas/adapters/previewEnvironmentAdapter";
import {
  resolveAutomaticPreviewQuality,
} from "@/engines/canvas/helpers/previewAutomaticQualityHelpers";
import {
  estimatePreviewMemoryByQuality,
} from "@/engines/canvas/helpers/previewMemoryHelpers";
import {
  createRuntimeMetricRecordPort,
} from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import type {
  PreviewBuildReadModel,
} from "@/engines/canvas/models/previewBuildModel";
import type {
  PreviewQualityPreference,
} from "@/engines/canvas/models/previewQualityModel";
import {
  createDirtyState,
} from "@/engines/canvas/state/dirtyStateStore";
import {
  createRuntimeMetricsResource,
} from "@/engines/canvas/state/runtimeMetricsStore";
import {
  createCompositionPreviewCacheRuntime,
} from "@/engines/canvas/state/compositionPreviewCacheStore";
import {
  createPreviewSurfaceCacheRuntime,
} from "@/engines/canvas/state/previewSurfaceCacheStore";

export function useCanvasPreviewRuntime() {
  const [preference, setPreference] =
    useState<PreviewQualityPreference>("auto");
  const [deviceMemoryGb] =
    useState(readPreviewDeviceMemoryGb);
  const [metrics] =
    useState(createRuntimeMetricsResource);
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
  const memoryEstimates = useMemo(
    () => estimatePreviewMemoryByQuality([]),
    []
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
  const build: PreviewBuildReadModel = {
    status: "ready",
    generation: 0,
    activeGeneration: 0,
    activeQuality:
      automaticQuality.resolvedQuality,
    quality: automaticQuality.resolvedQuality,
    completedCount: 0,
    totalCount: 0,
    failedCount: 0,
  };

  useEffect(() => () => {
    compositionCache.dispose();
    surfaceCache.dispose();
  }, [compositionCache, surfaceCache]);

  return {
    preference,
    automaticQuality,
    memoryEstimates,
    build,
    metrics,
    dirty,
    compositionCache,
    surfaceCache,
    commands: { setPreference },
  };
}
