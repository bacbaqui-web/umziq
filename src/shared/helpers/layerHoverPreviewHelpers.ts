export type LayerHoverPreviewPosition = {
  x: number;
  y: number;
};

export function measureLayerHoverPreview(options: {
  hasVisual: boolean;
  width?: number | null;
  height?: number | null;
}) {
  const imageHeight = options.hasVisual && options.width && options.height
    ? Math.min(200, (options.height / options.width) * 208)
    : 120;
  return { cardWidth: 224, imageHeight, cardHeight: 28 + imageHeight + 12 };
}

export function positionLayerHoverPreview(options: {
  clientX: number;
  clientY: number;
  cardHeight: number;
}): LayerHoverPreviewPosition {
  const cardWidth = 224;
  const diagonalGap = 20;
  return {
    x: Math.max(12, Math.min(
      options.clientX + diagonalGap,
      window.innerWidth - cardWidth - 12
    )),
    y: Math.max(12, Math.min(
      options.clientY - diagonalGap - options.cardHeight,
      window.innerHeight - options.cardHeight - 12
    )),
  };
}
