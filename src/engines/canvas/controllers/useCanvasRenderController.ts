import { useEffect, useMemo, useRef, type RefObject } from "react";
import type {
  PreviewScene,
  RenderDrawableSourceResolver,
  RenderFrame,
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
import type { RenderItem } from "@/engines/project";
import {
  createReusableRenderSurfaceFactory,
  renderFrameToCanvas,
  renderPreviewSceneToCanvas,
  type PreviewCanvasDrawState,
  type ReusableRenderSurfaceFactory,
} from "@/engines/playback-render";

export function resolvePreviewCompositionCacheForRender({
  compositionCache,
  isPreviewDraftActive,
}: {
  compositionCache?: CompositionPreviewCacheRuntime;
  isPreviewDraftActive: boolean;
}): CompositionPreviewCacheRuntime | undefined {
  return isPreviewDraftActive ? undefined : compositionCache;
}

export function useCanvasRenderController({
  canvasRef,
  renderFrame,
  previewScene,
  isPreviewDraftActive = false,
  renderItems,
  resolveDrawableSource,
  pixelScale,
  previewQuality,
  metrics,
  compositionCache,
  surfaceCache,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  renderFrame: RenderFrame | null;
  previewScene?: PreviewScene | null;
  isPreviewDraftActive?: boolean;
  renderItems: readonly RenderItem[];
  resolveDrawableSource?: RenderDrawableSourceResolver;
  pixelScale: number;
  previewQuality: ResolvedPreviewQuality;
  metrics?: RuntimeMetricsResource;
  compositionCache?: CompositionPreviewCacheRuntime;
  surfaceCache?: PreviewSurfaceCacheRuntime;
}) {
  const metricRecordPort = useMemo(
    () => createRuntimeMetricRecordPort(metrics),
    [metrics]
  );
  const surfaceFactoryRef = useRef<ReusableRenderSurfaceFactory | null>(null);
  const previewDrawStateRef = useRef<PreviewCanvasDrawState>({
    previousScene: null,
    previousNodeBoundsById: new Map(),
    previousPixelScale: null,
  });
  if (!surfaceFactoryRef.current) {
    surfaceFactoryRef.current = createReusableRenderSurfaceFactory(
      undefined,
      metricRecordPort
    );
  }

  useEffect(() => {
    const surfaceFactory = surfaceFactoryRef.current;
    return () => surfaceFactory?.dispose();
  }, []);

  const activeCompositionCache = resolvePreviewCompositionCacheForRender({
    compositionCache,
    isPreviewDraftActive,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (previewScene) {
      activeCompositionCache?.beginFrame();
      try {
        renderPreviewSceneToCanvas({
          canvas,
          previewScene,
          renderItems,
          resolveDrawableSource,
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
      return;
    }

    if (!renderFrame) return;
    previewDrawStateRef.current.previousScene = null;
    previewDrawStateRef.current.previousNodeBoundsById = new Map();
    previewDrawStateRef.current.previousPixelScale = null;
    const surfaceFactory = surfaceFactoryRef.current;
    if (!surfaceFactory) return;
    surfaceFactory.beginFrame();
    try {
      renderFrameToCanvas(
        canvas,
        renderFrame,
        surfaceFactory.createSurface,
        pixelScale,
        metricRecordPort
      );
    } finally {
      surfaceFactory.endFrame();
    }
  }, [
    canvasRef,
    pixelScale,
    previewQuality,
    previewScene,
    isPreviewDraftActive,
    renderFrame,
    renderItems,
    resolveDrawableSource,
    metrics,
    metricRecordPort,
    activeCompositionCache,
    surfaceCache,
  ]);
}
