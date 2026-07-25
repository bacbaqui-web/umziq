import type { Position, Scale } from "@/models";
import { normalizeRotationDegrees } from "@/animation";

export function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export const normalizeDegrees = normalizeRotationDegrees;

function rotateVector(x: number, y: number, degrees: number) {
  const radians = degreesToRadians(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function getTargetOrigin(
  position: Position,
  transformOffset: Position,
  width: number,
  height: number
) {
  return {
    x: position.x + transformOffset.x - width / 2,
    y: position.y + transformOffset.y - height / 2,
  };
}

export function getTargetAnchorWorld(
  width: number,
  height: number,
  position: Position,
  transformOffset: Position,
  anchor: Position
) {
  const origin = getTargetOrigin(position, transformOffset, width, height);
  return { x: origin.x + anchor.x, y: origin.y + anchor.y };
}

function transformPointAround(
  point: Position,
  anchor: Position,
  scale: Scale,
  rotation: number
) {
  const rotated = rotateVector(
    (point.x - anchor.x) * (scale.x / 100),
    (point.y - anchor.y) * (scale.y / 100),
    rotation
  );
  return { x: anchor.x + rotated.x, y: anchor.y + rotated.y };
}

export function getTransformGeometry(
  width: number,
  height: number,
  position: Position,
  transformOffset: Position,
  anchor: Position,
  scale: Scale,
  rotation: number
) {
  const origin = getTargetOrigin(position, transformOffset, width, height);
  const corners = {
    nw: { x: 0, y: 0 },
    ne: { x: width, y: 0 },
    se: { x: width, y: height },
    sw: { x: 0, y: height },
  };
  const translatedCorners = Object.fromEntries(
    Object.entries(corners).map(([key, point]) => {
      const transformed = transformPointAround(point, anchor, scale, rotation);
      return [key, { x: origin.x + transformed.x, y: origin.y + transformed.y }];
    })
  ) as typeof corners;
  const xValues = Object.values(translatedCorners).map((corner) => corner.x);
  const yValues = Object.values(translatedCorners).map((corner) => corner.y);

  return {
    origin,
    centerWorld: { ...position },
    anchorWorld: getTargetAnchorWorld(
      width,
      height,
      position,
      transformOffset,
      anchor
    ),
    corners: translatedCorners,
    bounds: {
      x: Math.min(...xValues),
      y: Math.min(...yValues),
      width: Math.max(...xValues) - Math.min(...xValues),
      height: Math.max(...yValues) - Math.min(...yValues),
    },
    edgeWidth: Math.hypot(
      translatedCorners.ne.x - translatedCorners.nw.x,
      translatedCorners.ne.y - translatedCorners.nw.y
    ),
    edgeHeight: Math.hypot(
      translatedCorners.sw.x - translatedCorners.nw.x,
      translatedCorners.sw.y - translatedCorners.nw.y
    ),
  };
}

function inverseTransformOffset(offset: Position, scale: Scale, rotation: number) {
  const unrotated = rotateVector(offset.x, offset.y, -rotation);
  return {
    x: unrotated.x / Math.max(Math.abs(scale.x) / 100, 0.0001),
    y: unrotated.y / Math.max(Math.abs(scale.y) / 100, 0.0001),
  };
}

export function projectOntoAxis(vector: Position, axis: Position) {
  return vector.x * axis.x + vector.y * axis.y;
}

export function getCompensatedTransformOffset(
  transformOffset: Position,
  previousAnchor: Position,
  nextAnchor: Position,
  scale: Scale,
  rotation: number
) {
  const delta = {
    x: nextAnchor.x - previousAnchor.x,
    y: nextAnchor.y - previousAnchor.y,
  };
  const transformed = transformPointAround(delta, { x: 0, y: 0 }, scale, rotation);
  return {
    x: transformOffset.x + transformed.x - delta.x,
    y: transformOffset.y + transformed.y - delta.y,
  };
}

export function resolveAnchorFromWorldPoint(
  worldPoint: Position,
  position: Position,
  transformOffset: Position,
  anchor: Position,
  scale: Scale,
  rotation: number,
  sourceWidth: number,
  sourceHeight: number
) {
  const anchorWorld = getTargetAnchorWorld(
    sourceWidth,
    sourceHeight,
    position,
    transformOffset,
    anchor
  );
  const localOffset = inverseTransformOffset(
    { x: worldPoint.x - anchorWorld.x, y: worldPoint.y - anchorWorld.y },
    scale,
    rotation
  );
  return {
    x: Math.min(Math.max(anchor.x + localOffset.x, 0), sourceWidth),
    y: Math.min(Math.max(anchor.y + localOffset.y, 0), sourceHeight),
  };
}
