import type { EvaluatedSceneSize, EvaluatedSceneTransform } from "@/render";
import type {
  CanvasSelectionMatrix,
  CanvasSelectionPoint,
  CanvasSelectionProjection,
} from "@/engines/canvas/models/canvasDirectSelectionModel";

export function applyCanvasSelectionMatrix(
  matrix: CanvasSelectionMatrix,
  point: CanvasSelectionPoint
): CanvasSelectionPoint {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

function multiply(left: CanvasSelectionMatrix, right: CanvasSelectionMatrix) {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function inverse(matrix: CanvasSelectionMatrix): CanvasSelectionMatrix | null {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-9) return null;
  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  };
}

export function buildCanvasSelectionProjection(options: {
  size: EvaluatedSceneSize;
  transform: EvaluatedSceneTransform;
  viewportScale: number;
  viewportOffset: CanvasSelectionPoint;
}): CanvasSelectionProjection | null {
  const { size, transform } = options;
  const values = [
    size.width, size.height, options.viewportScale, options.viewportOffset.x,
    options.viewportOffset.y, transform.position.x, transform.position.y,
    transform.transformOffset.x, transform.transformOffset.y, transform.anchor.x,
    transform.anchor.y, transform.scale.x, transform.scale.y, transform.rotation,
  ];
  if (values.some((value) => !Number.isFinite(value)) || size.width <= 0 ||
      size.height <= 0 || options.viewportScale <= 0 || transform.scale.x === 0 ||
      transform.scale.y === 0) return null;

  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const sourceToWorld: CanvasSelectionMatrix = {
    a: cos * transform.scale.x / 100,
    b: sin * transform.scale.x / 100,
    c: -sin * transform.scale.y / 100,
    d: cos * transform.scale.y / 100,
    e: transform.position.x + transform.transformOffset.x - size.width / 2 +
      transform.anchor.x - cos * transform.scale.x / 100 * transform.anchor.x +
      sin * transform.scale.y / 100 * transform.anchor.y,
    f: transform.position.y + transform.transformOffset.y - size.height / 2 +
      transform.anchor.y - sin * transform.scale.x / 100 * transform.anchor.x -
      cos * transform.scale.y / 100 * transform.anchor.y,
  };
  const worldToViewport: CanvasSelectionMatrix = {
    a: options.viewportScale, b: 0, c: 0, d: options.viewportScale,
    e: options.viewportOffset.x, f: options.viewportOffset.y,
  };
  const sourceToViewport = multiply(worldToViewport, sourceToWorld);
  const viewportToSource = inverse(sourceToViewport);
  if (!viewportToSource) return null;
  const viewportQuad = [
    { x: 0, y: 0 }, { x: size.width, y: 0 },
    { x: size.width, y: size.height }, { x: 0, y: size.height },
  ].map((point) => applyCanvasSelectionMatrix(sourceToViewport, point)) as unknown as CanvasSelectionProjection["viewportQuad"];
  const xs = viewportQuad.map((point) => point.x);
  const ys = viewportQuad.map((point) => point.y);
  return {
    sourceToViewport,
    viewportQuad,
    viewportBounds: {
      left: Math.min(...xs), top: Math.min(...ys),
      right: Math.max(...xs), bottom: Math.max(...ys),
    },
    viewportToSource,
  };
}

export function isPointInCanvasSelectionProjection(
  point: CanvasSelectionPoint,
  projection: CanvasSelectionProjection
) {
  const bounds = projection.viewportBounds;
  if (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom) return false;
  let positive = false;
  let negative = false;
  for (let index = 0; index < projection.viewportQuad.length; index += 1) {
    const start = projection.viewportQuad[index];
    const end = projection.viewportQuad[(index + 1) % projection.viewportQuad.length];
    const cross = (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x);
    if (cross > 1e-7) positive = true;
    if (cross < -1e-7) negative = true;
    if (positive && negative) return false;
  }
  return true;
}
