import type { RenderDrawableSourceResolver } from "@/engines/playback-render";
import type { PreviewCacheRuntime } from "@/engines/canvas/models/previewCacheModel";

export function createPreviewDrawableSourceResolver(
  cache: PreviewCacheRuntime,
  resourceKeyBySourceId: ReadonlyMap<string, string>
): RenderDrawableSourceResolver {
  return (request) => {
    const key = resourceKeyBySourceId.get(request.sourceId);
    if (!key) return null;
    const resource = cache.get(key);
    if (!resource) return null;
    if (
      resource.bitmap.logicalSize.width !== request.logicalSize.width ||
      resource.bitmap.logicalSize.height !== request.logicalSize.height
    ) {
      return null;
    }

    return {
      kind: "preview",
      image: resource.bitmap.image,
      pixelSize: { ...resource.bitmap.pixelSize },
    };
  };
}
