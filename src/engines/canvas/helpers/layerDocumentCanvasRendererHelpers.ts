import {
  renderPreviewRenderer,
  type LayerDocumentEditorFrameReadModel,
  type PreviewScene,
  type RuntimeMetricRecordPort,
} from "@/render";
import {
  createLayerDocumentCanvasNodeVisualResolver,
} from "@/engines/canvas/adapters/layerDocumentCanvasRenderAssetAdapter";
import type {
  LayerDocumentCanvasRenderAssetPort,
  LayerDocumentCanvasRendererReadModel,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";

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
