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

export function resolveTimelineAutoScroll(
  clientX: number,
  viewportLeft: number,
  viewportRight: number,
  threshold: number,
  step: number
) {
  if (clientX < viewportLeft + threshold) {
    return -Math.max(0, step);
  }
  if (clientX > viewportRight - threshold) {
    return Math.max(0, step);
  }
  return 0;
}
