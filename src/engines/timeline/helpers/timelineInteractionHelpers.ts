export function resolveTimelineDragDelta(
  clientX: number,
  startClientX: number,
  pxPerFrame: number
) {
  return Math.round(
    (clientX - startClientX) /
      Math.max(pxPerFrame, 0.001)
  );
}
