export function formatTimelineTime(frame: number, frameRate: number) {
  const seconds = frame / frameRate;
  return `${seconds.toFixed(2)}s / F${frame}`;
}

export function formatCompactTime(frame: number, frameRate: number) {
  const seconds = Math.floor(frame / frameRate);
  const frames = frame % frameRate;
  return `${seconds}s${frames}f`;
}
