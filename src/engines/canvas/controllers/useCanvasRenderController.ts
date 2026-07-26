import { useEffect, useMemo, useRef, type RefObject } from "react";
import type {
  PreviewScene,
  RenderNodeVisualResolver,
} from "@/engines/playback-render";
import { createRuntimeMetricRecordPort } from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import type { RuntimeMetricsResource } from "@/engines/canvas/models/runtimeMetricsModel";
import type {
  CompositionPreviewCacheRuntime,
} from "@/engines/canvas/models/compositionCacheModel";
import type {
  PreviewSurfaceCacheRuntime,
} from "@/engines/canvas/models/surfaceCacheModel";
import type { ResolvedPreviewQuality } from "@/engines/canvas/models/previewQualityModel";
import {
  renderPreviewSceneToCanvas,
  type PreviewCanvasDrawState,
} from "@/engines/playback-render";

export function resolvePreviewCompositionCacheForRender({
  compositionCache,
}: {
  compositionCache?: CompositionPreviewCacheRuntime;
}): CompositionPreviewCacheRuntime | undefined {
  return compositionCache;
}

export function useCanvasRenderController({
  canvasRef,
  previewScene,
  resolveNodeVisual,
  pixelScale,
  previewQuality,
  metrics,
  compositionCache,
  surfaceCache,
  onCanvasPainted,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  previewScene: PreviewScene;
  resolveNodeVisual?: RenderNodeVisualResolver;
  pixelScale: number;
  previewQuality: ResolvedPreviewQuality;
  metrics?: RuntimeMetricsResource;
  compositionCache?: CompositionPreviewCacheRuntime;
  surfaceCache?: PreviewSurfaceCacheRuntime;
  onCanvasPainted?: (timestamp?: number) => void;
}) {
  const metricRecordPort = useMemo(
    () => createRuntimeMetricRecordPort(metrics),
    [metrics]
  );
  const previewDrawStateRef = useRef<PreviewCanvasDrawState>({
    previousScene: null,
    previousNodeBoundsById: new Map(),
    previousPixelScale: null,
  });
  const activeCompositionCache = resolvePreviewCompositionCacheForRender({
    compositionCache,
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    activeCompositionCache?.beginFrame();
    try {
      renderPreviewSceneToCanvas({
        canvas,
        previewScene,
        resolveNodeVisual,
        pixelScale,
        runtimeMetrics: metricRecordPort,
        compositionCache: activeCompositionCache,
        surfaceCache,
        previewQuality,
        drawState: previewDrawStateRef.current,
      });
    } finally {
      activeCompositionCache?.endFrame();
    }
    if (metrics?.getFrameSnapshot().dirtySkip !== 1) {
      onCanvasPainted?.();
    }
  }, [
    canvasRef,
    pixelScale,
    previewQuality,
    previewScene,
    resolveNodeVisual,
    metrics,
    metricRecordPort,
    activeCompositionCache,
    surfaceCache,
    onCanvasPainted,
  ]);
}
