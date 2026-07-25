import type {
  Position,
  Scale,
} from "@/models";

/**
 * Keeps the rendered silhouette stationary when an anchor changes.
 */
export function getCompensatedTransformOffset(
  transformOffset: Position,
  previousAnchor: Position,
  nextAnchor: Position,
  scale: Scale,
  rotation: number
): Position {
  const deltaX =
    nextAnchor.x - previousAnchor.x;
  const deltaY =
    nextAnchor.y - previousAnchor.y;
  const radians = (rotation * Math.PI) / 180;
  const scaledX =
    deltaX * (scale.x / 100);
  const scaledY =
    deltaY * (scale.y / 100);
  const transformedX =
    scaledX * Math.cos(radians) -
    scaledY * Math.sin(radians);
  const transformedY =
    scaledX * Math.sin(radians) +
    scaledY * Math.cos(radians);
  return {
    x:
      transformOffset.x +
      transformedX -
      deltaX,
    y:
      transformOffset.y +
      transformedY -
      deltaY,
  };
}
