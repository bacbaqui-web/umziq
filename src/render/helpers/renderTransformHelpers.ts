import type { EvaluatedSceneTransform } from "@/render/models/evaluatedSceneModel";
import type { EvaluatedRenderTransform } from "@/render/models/renderFrameModel";

export function buildRenderTransform(
  width: number,
  height: number,
  transform: EvaluatedSceneTransform
): EvaluatedRenderTransform {
  return {
    ...transform,
    origin: {
      x: transform.position.x + transform.transformOffset.x - width / 2,
      y: transform.position.y + transform.transformOffset.y - height / 2,
    },
  };
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getRenderTransformBounds(
  width: number,
  height: number,
  transform: EvaluatedSceneTransform
) {
  const renderTransform = buildRenderTransform(width, height, transform);
  const radians = degreesToRadians(renderTransform.rotation);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scaleX = renderTransform.scale.x / 100;
  const scaleY = renderTransform.scale.y / 100;
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((point) => {
    const scaledX = (point.x - renderTransform.anchor.x) * scaleX;
    const scaledY = (point.y - renderTransform.anchor.y) * scaleY;
    return {
      x:
        renderTransform.origin.x +
        renderTransform.anchor.x +
        scaledX * cos -
        scaledY * sin,
      y:
        renderTransform.origin.y +
        renderTransform.anchor.y +
        scaledX * sin +
        scaledY * cos,
    };
  });
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);

  return {
    left: Math.min(...xValues),
    top: Math.min(...yValues),
    right: Math.max(...xValues),
    bottom: Math.max(...yValues),
  };
}
