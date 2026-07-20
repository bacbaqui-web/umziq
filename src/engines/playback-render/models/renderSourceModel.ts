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
