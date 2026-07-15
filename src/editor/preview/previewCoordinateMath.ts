import type { Position, Scale } from "@/editor/types/types";

export function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function normalizeDegrees(value: number) {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return normalized === -180 ? 180 : normalized;
}

function rotateVector(x: number, y: number, degrees: number) {
  const radians = degreesToRadians(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function getSourceCenter(width: number, height: number) {
  return {
    x: width / 2,
    y: height / 2,
  };
}

function getTargetOrigin(
  position: Position,
  transformOffset: Position,
  width: number,
  height: number
) {
  const center = getSourceCenter(width, height);

  return {
    x: position.x + transformOffset.x - center.x,
    y: position.y + transformOffset.y - center.y,
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

  return {
    x: origin.x + anchor.x,
    y: origin.y + anchor.y,
  };
}

function transformPointAround(
  point: Position,
  anchor: Position,
  scale: Scale,
  rotation: number
) {
  const scaledOffset = {
    x: (point.x - anchor.x) * (scale.x / 100),
    y: (point.y - anchor.y) * (scale.y / 100),
  };
  const rotatedOffset = rotateVector(scaledOffset.x, scaledOffset.y, rotation);

  return {
    x: anchor.x + rotatedOffset.x,
    y: anchor.y + rotatedOffset.y,
  };
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
  const worldCorners = {
    nw: {
      ...transformPointAround(corners.nw, anchor, scale, rotation),
    },
    ne: {
      ...transformPointAround(corners.ne, anchor, scale, rotation),
    },
    se: {
      ...transformPointAround(corners.se, anchor, scale, rotation),
    },
    sw: {
      ...transformPointAround(corners.sw, anchor, scale, rotation),
    },
  };

  const translatedCorners = {
    nw: {
      x: origin.x + worldCorners.nw.x,
      y: origin.y + worldCorners.nw.y,
    },
    ne: {
      x: origin.x + worldCorners.ne.x,
      y: origin.y + worldCorners.ne.y,
    },
    se: {
      x: origin.x + worldCorners.se.x,
      y: origin.y + worldCorners.se.y,
    },
    sw: {
      x: origin.x + worldCorners.sw.x,
      y: origin.y + worldCorners.sw.y,
    },
  };
  const xValues = Object.values(translatedCorners).map((corner) => corner.x);
  const yValues = Object.values(translatedCorners).map((corner) => corner.y);

  return {
    origin,
    centerWorld: {
      x: position.x,
      y: position.y,
    },
    anchorWorld: getTargetAnchorWorld(width, height, position, transformOffset, anchor),
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
  const scaleFactorX = Math.max(Math.abs(scale.x) / 100, 0.0001);
  const scaleFactorY = Math.max(Math.abs(scale.y) / 100, 0.0001);

  return {
    x: unrotated.x / scaleFactorX,
    y: unrotated.y / scaleFactorY,
  };
}

export function projectOntoAxis(vector: Position, axis: Position) {
  return vector.x * axis.x + vector.y * axis.y;
}

function getAnchorCompensationOffset(
  previousAnchor: Position,
  nextAnchor: Position,
  scale: Scale,
  rotation: number
) {
  const delta = {
    x: nextAnchor.x - previousAnchor.x,
    y: nextAnchor.y - previousAnchor.y,
  };
  const transformedDelta = transformPointAround(delta, { x: 0, y: 0 }, scale, rotation);

  return {
    x: transformedDelta.x - delta.x,
    y: transformedDelta.y - delta.y,
  };
}

export function getCompensatedTransformOffset(
  transformOffset: Position,
  previousAnchor: Position,
  nextAnchor: Position,
  scale: Scale,
  rotation: number
) {
  const compensation = getAnchorCompensationOffset(previousAnchor, nextAnchor, scale, rotation);

  return {
    x: transformOffset.x + compensation.x,
    y: transformOffset.y + compensation.y,
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
    {
      x: worldPoint.x - anchorWorld.x,
      y: worldPoint.y - anchorWorld.y,
    },
    scale,
    rotation
  );

  return {
    x: Math.min(Math.max(anchor.x + localOffset.x, 0), sourceWidth),
    y: Math.min(Math.max(anchor.y + localOffset.y, 0), sourceHeight),
  };
}
