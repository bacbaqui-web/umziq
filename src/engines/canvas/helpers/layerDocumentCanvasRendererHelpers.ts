import {
  renderAccurateRenderer,
  renderPreviewRenderer,
  type LayerDocumentEditorFrameReadModel,
  type PreviewScene,
  type RenderFrame,
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
  runtime: LayerDocumentEditorFrameReadModel;
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

export function buildLayerDocumentCanvasPreviewReadModel(options: {
  runtime: LayerDocumentEditorFrameReadModel;
  renderAssets: LayerDocumentCanvasRenderAssetPort;
  previousPreviewScene?: PreviewScene | null;
  runtimeMetrics?: RuntimeMetricRecordPort;
}): LayerDocumentCanvasRendererReadModel {
  const resolveNodeVisual =
    createLayerDocumentCanvasNodeVisualResolver(
      options.renderAssets
    );
  return {
    previewScene: renderPreviewRenderer(
      options.runtime.scene,
      options.runtimeMetrics,
      options.previousPreviewScene
    ).previewScene,
    resolveNodeVisual,
  };
}
