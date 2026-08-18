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
    ? Math.min(100, (options.height / options.width) * 104)
    : 60;
  return { cardWidth: 112, imageHeight, cardHeight: 24 + imageHeight };
}

export function positionLayerHoverPreview(options: {
  clientX: number;
  clientY: number;
  cardHeight: number;
}): LayerHoverPreviewPosition {
  const cardWidth = 112;
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
