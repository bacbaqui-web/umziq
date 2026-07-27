import type {
  LayerDocumentSourceRuntimeResource,
  LayerDocumentSourceRuntimeResourcePort,
  RenderNodeVisualResolver,
} from "@/render";
import type {
  LayerDocumentCanvasRenderAsset,
  LayerDocumentCanvasRenderAssetPort,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";

export type LayerDocumentCanvasRuntimeResourceAdapter = (
  resource: LayerDocumentSourceRuntimeResource
) => Omit<
  LayerDocumentCanvasRenderAsset,
  "sourceVisualIdentity"
> | null;

/**
 * Stateless typed view over the shared Source runtime cache. It owns neither
 * the cached resource nor a Project/History representation of that resource.
 */
export function createLayerDocumentCanvasRenderAssetPort(options: {
  resources: LayerDocumentSourceRuntimeResourcePort;
  adaptResource: LayerDocumentCanvasRuntimeResourceAdapter;
}): LayerDocumentCanvasRenderAssetPort {
  return {
    resolve: (request) => {
      const resource = options.resources.resolve({
        sourceId: request.sourceId,
        sourceResourceCacheKey:
          request.sourceResourceCacheKey,
      });
      if (!resource) return null;
      const adapted = options.adaptResource(resource);
      if (!adapted) return null;
      return {
        ...adapted,
        sourceVisualIdentity:
          request.sourceResourceCacheKey,
      };
    },
  };
}

export function createLayerDocumentCanvasNodeVisualResolver(
  assets: LayerDocumentCanvasRenderAssetPort
): RenderNodeVisualResolver {
  return (request) =>
    assets.resolve({
      layerDocumentId: request.layerDocumentId,
      sourceId: request.sourceId,
      sourceResourceCacheKey:
        request.sourceResourceCacheKey,
      renderItemId: request.renderItemId,
      drawableId: request.drawableId,
      logicalSize: request.logicalSize,
    })?.source ?? null;
}
