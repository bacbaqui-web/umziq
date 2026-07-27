export type RenderSize = {
  readonly width: number;
  readonly height: number;
};

export type RenderDrawableSource = {
  readonly kind: "original" | "preview";
  readonly image: CanvasImageSource;
  readonly pixelSize: RenderSize;
};

export type RenderDrawableSourceRequest = {
  readonly renderItemId: string;
  readonly drawableId: string;
  readonly sourceId: string;
  readonly logicalSize: RenderSize;
  readonly originalSource: RenderDrawableSource & { kind: "original" };
};

export type RenderDrawableSourceResolver = (
  request: RenderDrawableSourceRequest
) => RenderDrawableSource | null | undefined;

/**
 * Runtime node-native visual lookup. The Source cache key identifies static
 * source pixels; the Layer result key is carried separately for frame/Draft
 * output caches and must not be used as the Source resource identity.
 */
export type RenderNodeVisualRequest = {
  readonly layerDocumentId: string;
  readonly sourceId: string;
  readonly sourceResourceCacheKey: string;
  readonly layerResultCacheKey: string;
  readonly renderItemId: string;
  readonly drawableId: string;
  readonly logicalSize: RenderSize;
};

export type RenderNodeVisualResolver = (
  request: RenderNodeVisualRequest
) => RenderDrawableSource | null | undefined;
