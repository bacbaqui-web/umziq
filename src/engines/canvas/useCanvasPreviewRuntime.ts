import {
  useEffect,
  useState,
} from "react";
import {
  readPreviewDeviceMemoryGb,
} from "@/engines/canvas/adapters/previewEnvironmentAdapter";
import { resolvePreviewQuality } from "@/engines/canvas/helpers/previewQualityHelpers";
import {
  createRuntimeMetricRecordPort,
} from "@/engines/canvas/helpers/runtimeMetricsHelpers";
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
  createCanvasFpsRuntime,
} from "@/engines/canvas/state/canvasFpsRuntimeStore";
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
  const [fps] =
    useState(createCanvasFpsRuntime);
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
  const quality = resolvePreviewQuality(
    preference,
    deviceMemoryGb
  );

  useEffect(() => () => {
    fps.dispose();
    compositionCache.dispose();
    surfaceCache.dispose();
  }, [compositionCache, fps, surfaceCache]);

  return {
    preference,
    quality,
    metrics,
    fps,
    dirty,
    compositionCache,
    surfaceCache,
    commands: { setPreference },
  };
}
