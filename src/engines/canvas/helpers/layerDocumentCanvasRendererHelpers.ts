import {
  renderAccurateRenderer,
  renderFastPreviewRenderer,
  type LayerDocumentRuntimeReadModel,
  type PreviewScene,
  type RenderFrame,
  type RendererMode,
  type RuntimeMetricRecordPort,
} from "@/engines/playback-render";
import {
  createLayerDocumentCanvasNodeVisualResolver,
} from "@/engines/canvas/adapters/layerDocumentCanvasRenderAssetAdapter";
import type {
  LayerDocumentCanvasRenderAssetPort,
  LayerDocumentCanvasRendererReadModel,
} from "@/engines/canvas/models/layerDocumentCanvasModeModel";

export function buildLayerDocumentCanvasRenderFrame(options: {
  runtime: LayerDocumentRuntimeReadModel;
  renderAssets: LayerDocumentCanvasRenderAssetPort;
  runtimeMetrics?: RuntimeMetricRecordPort;
}): RenderFrame {
  return renderAccurateRenderer({
    evaluatedScene: options.runtime.scene,
    resolveNodeVisual:
      createLayerDocumentCanvasNodeVisualResolver(
        options.renderAssets
      ),
    runtimeMetrics: options.runtimeMetrics,
  }).frame;
}

export function buildLayerDocumentCanvasRendererReadModel(options: {
  runtime: LayerDocumentRuntimeReadModel;
  rendererMode: RendererMode;
  renderAssets: LayerDocumentCanvasRenderAssetPort;
  previousPreviewScene?: PreviewScene | null;
  runtimeMetrics?: RuntimeMetricRecordPort;
}): LayerDocumentCanvasRendererReadModel {
  const resolveNodeVisual =
    createLayerDocumentCanvasNodeVisualResolver(
      options.renderAssets
    );
  if (options.rendererMode === "full-render") {
    return {
      mode: "full-render",
      renderFrame: buildLayerDocumentCanvasRenderFrame({
        runtime: options.runtime,
        renderAssets: options.renderAssets,
        runtimeMetrics: options.runtimeMetrics,
      }),
      previewScene: null,
      resolveNodeVisual,
    };
  }
  return {
    mode: "fast-render",
    renderFrame: null,
    previewScene: renderFastPreviewRenderer(
      options.runtime.scene,
      options.runtimeMetrics,
      options.previousPreviewScene
    ).previewScene,
    resolveNodeVisual,
  };
}
