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

export function useCanvasPreviewRuntime(projectId: string) {
  const readPreference = (targetProjectId: string): PreviewQualityPreference => {
    if (typeof window === "undefined") return "auto";
    const stored = window.localStorage.getItem(
      `umziq.project.${targetProjectId}.preview.quality`
    );
    return stored === "auto" || stored === "original" ||
      stored === "high" || stored === "medium" || stored === "low"
      ? stored
      : "auto";
  };
  const [preferenceByProject, setPreferenceByProject] = useState<
    Record<string, PreviewQualityPreference>
  >(() => ({ [projectId]: readPreference(projectId) }));
  const preference = preferenceByProject[projectId] ??
    readPreference(projectId);
  const setPreference = (next: PreviewQualityPreference) => {
    window.localStorage.setItem(
      `umziq.project.${projectId}.preview.quality`,
      next
    );
    setPreferenceByProject((current) => ({
      ...current,
      [projectId]: next,
    }));
  };
  const [deviceMemoryGb] =
    useState(readPreviewDeviceMemoryGb);
  const [metrics] =
    useState(createRuntimeMetricsResource);
  const [fps] =
    useState(createCanvasFpsRuntime);
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
    compositionCache,
    surfaceCache,
    commands: { setPreference },
  };
}
