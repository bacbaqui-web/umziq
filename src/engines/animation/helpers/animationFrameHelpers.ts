export function globalFrameToLocalFrame(
  globalFrame: number,
  startFrame: number,
  sourceOffsetFrames = 0
) {
  return globalFrame - startFrame + sourceOffsetFrames;
}

export function localFrameToGlobalFrame(
  localFrame: number,
  startFrame: number,
  sourceOffsetFrames = 0
) {
  return startFrame + localFrame - sourceOffsetFrames;
}
