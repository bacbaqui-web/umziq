import type {
  LayerPlacement,
} from "@/models/layerDocumentModel";

type PlacementTiming = Pick<
  LayerPlacement,
  | "startFrame"
  | "durationFrames"
  | "sourceOffsetFrames"
>;

export function layerDocumentPlacementEndFrame(
  placement: PlacementTiming
): number {
  return placement.startFrame + placement.durationFrames;
}

export function layerDocumentGlobalFrameToLocalFrame(
  globalFrame: number,
  placement: PlacementTiming
): number {
  return (
    globalFrame -
    placement.startFrame +
    placement.sourceOffsetFrames
  );
}

export function layerDocumentLocalFrameToGlobalFrame(
  localFrame: number,
  placement: PlacementTiming
): number {
  return (
    placement.startFrame +
    localFrame -
    placement.sourceOffsetFrames
  );
}

export function isGlobalFrameInsideLayerDocumentPlacement(
  globalFrame: number,
  placement: PlacementTiming
): boolean {
  return (
    globalFrame >= placement.startFrame &&
    globalFrame < layerDocumentPlacementEndFrame(placement)
  );
}

/**
 * Timeline keyframe rows use an explicit clip policy: a stored local
 * keyframe is displayed only while its projected global frame is inside the
 * owning Placement's half-open [start, end) interval.
 */
export function projectVisibleLayerDocumentKeyframeFrame(
  localFrame: number,
  placement: PlacementTiming
): number | null {
  const globalFrame =
    layerDocumentLocalFrameToGlobalFrame(
      localFrame,
      placement
    );
  return isGlobalFrameInsideLayerDocumentPlacement(
    globalFrame,
    placement
  )
    ? globalFrame
    : null;
}
