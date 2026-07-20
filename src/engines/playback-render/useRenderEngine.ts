import { useMemo } from "react";
import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import { buildEvaluatedScene } from "@/engines/playback-render/helpers/evaluatedSceneHelpers";
import { resolveRenderItemsForComposition } from "@/engines/playback-render/helpers/renderSourceHelpers";
import type { PreviewScene } from "@/engines/playback-render/models/previewSceneModel";
import type { RenderDrawableSourceResolver } from "@/engines/playback-render/models/renderSourceModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";
import type {
  RendererMode,
  RendererModeResult,
} from "@/engines/playback-render/models/rendererModeModel";
import { renderWithRendererMode } from "@/engines/playback-render/renderers/rendererMode";

type RenderEngineRuntime = {
  getPreviousPreviewScene: () => PreviewScene | null;
  rememberRendererResult: (result: RendererModeResult | null) => void;
};

function createRenderEngineRuntime(): RenderEngineRuntime {
  let previousPreviewScene: PreviewScene | null = null;
  return {
    getPreviousPreviewScene: () => previousPreviewScene,
    rememberRendererResult: (result) => {
      previousPreviewScene =
        result?.mode === "fast-render" ? result.previewScene : null;
    },
  };
}

type UseRenderEngineOptions = {
  masterCompId: string;
  sceneCompositions: Composition[];
  selectedComp: Composition;
  selectedMeta: CompositionMeta | null;
  selectedTimelineItems: TimelineItem[];
  globalFrame: number;
  layerMap: Map<string, Layer>;
  compositionMap: Map<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  renderItemsByCompId: Record<string, RenderItem[]>;
  resolveDrawableSource?: RenderDrawableSourceResolver;
  rendererMode?: RendererMode;
  runtimeMetrics?: RuntimeMetricRecordPort;
};

export function useRenderEngine({
  masterCompId,
  sceneCompositions,
  selectedComp,
  selectedMeta,
  selectedTimelineItems,
  globalFrame,
  layerMap,
  compositionMap,
  metaByCompId,
  renderItemsByCompId,
  resolveDrawableSource,
  rendererMode = "full-render",
  runtimeMetrics,
}: UseRenderEngineOptions) {
  const runtime = useMemo<RenderEngineRuntime>(
    () => createRenderEngineRuntime(),
    []
  );
  const renderItems = useMemo(
    () =>
      resolveRenderItemsForComposition({
        masterCompId,
        selectedCompId: selectedComp.id,
        sceneCompositions,
        renderItemsByCompId,
      }),
    [masterCompId, renderItemsByCompId, sceneCompositions, selectedComp.id]
  );
  const emptyLocalFrameBySourceId = useMemo(
    () => new Map<string, number>(),
    []
  );
  const evaluatedScene = useMemo(
    () => {
      runtimeMetrics?.resetFrame?.();
      if (!selectedMeta) return null;
      runtimeMetrics?.increment("animationEvaluation");
      return buildEvaluatedScene({
            compositionId: selectedComp.id,
            width: selectedMeta.width,
            height: selectedMeta.height,
            renderItems,
            timelineItems: selectedTimelineItems,
            layerMap,
            compositionMap,
            metaByCompId,
            globalFrame,
            frameRate: selectedMeta.frameRate,
          });
    },
    [
      compositionMap,
      globalFrame,
      layerMap,
      metaByCompId,
      renderItems,
      selectedComp.id,
      selectedMeta,
      selectedTimelineItems,
      runtimeMetrics,
    ]
  );
  const rendererResult = useMemo(
    () => {
      if (!evaluatedScene) return null;
      const result = renderWithRendererMode({
            mode: rendererMode,
            evaluatedScene,
            renderItems,
            resolveDrawableSource,
            runtimeMetrics,
            previousPreviewScene: runtime.getPreviousPreviewScene(),
          });
      runtime.rememberRendererResult(result);
      return result;
    },
    [
      evaluatedScene,
      renderItems,
      resolveDrawableSource,
      rendererMode,
      runtime,
      runtimeMetrics,
    ]
  );
  const renderFrame =
    rendererResult?.mode === "full-render" ? rendererResult.frame : null;
  const previewScene =
    rendererResult?.mode === "fast-render" ? rendererResult.previewScene : null;
  return {
    evaluatedScene,
    rendererMode,
    previewScene,
    renderFrame,
    renderItems,
    localFrameBySourceId:
      evaluatedScene?.localFrameBySourceId ?? emptyLocalFrameBySourceId,
  };
}
