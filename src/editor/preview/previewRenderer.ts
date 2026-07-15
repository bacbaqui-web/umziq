import type {
  Composition,
  CompositionMeta,
  Layer,
  RenderItem,
  TimelineItem,
} from "@/editor/types/types";
import {
  degreesToRadians,
  getTransformGeometry,
} from "@/editor/preview/previewCoordinateMath";
import {
  evaluateCompositionOpacity,
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerOpacity,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
} from "@/editor/preview/previewValueEvaluation";

export function drawRenderItems(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  renderItems: RenderItem[],
  layerMap: Map<string, Layer>,
  compositionMap: Map<string, Composition>,
  metaByCompId: Record<string, CompositionMeta>,
  currentFrame: number,
  localFrameBySourceId: Map<string, number>
) {
  const context = canvas.getContext("2d");

  if (!context) return;

  context.clearRect(0, 0, width, height);

  [...renderItems]
    .reverse()
    .forEach((item) => {
      if (!item.visible) return;

      const composition =
        item.kind === "subComp" && item.targetCompId
          ? compositionMap.get(item.targetCompId)
          : null;
      const compositionLocalFrame =
        composition && localFrameBySourceId.has(item.sourceId)
          ? localFrameBySourceId.get(item.sourceId) ?? currentFrame
          : currentFrame;
      const compositionScale = composition
        ? evaluateCompositionScale(composition, compositionLocalFrame)
        : { x: 100, y: 100 };
      const compositionRotation = composition
        ? evaluateCompositionRotation(composition, compositionLocalFrame)
        : 0;
      const compositionOpacity = composition
        ? evaluateCompositionOpacity(composition, compositionLocalFrame)
        : 100;
      const compositionMeta = composition ? metaByCompId[composition.id] : null;
      const compositionWidth = compositionMeta?.width ?? width;
      const compositionHeight = compositionMeta?.height ?? height;
      const compositionPosition = composition
        ? evaluateCompositionPosition(composition, compositionLocalFrame)
        : { x: compositionWidth / 2, y: compositionHeight / 2 };
      const compositionGeometry = composition
        ? getTransformGeometry(
            compositionWidth,
            compositionHeight,
            compositionPosition,
            composition.transformOffset,
            composition.anchor,
            compositionScale,
            compositionRotation
          )
        : null;

      if (composition && compositionGeometry) {
        const compositionSurface = document.createElement("canvas");
        compositionSurface.width = Math.max(1, compositionWidth);
        compositionSurface.height = Math.max(1, compositionHeight);
        const compositionContext = compositionSurface.getContext("2d");

        if (!compositionContext) {
          return;
        }

        [...item.drawables].reverse().forEach((drawable) => {
          if (!drawable.visible || !drawable.canvas) return;
          const animatedLayer = drawable.sourceLayerId
            ? layerMap.get(drawable.sourceLayerId)
            : null;
          const localFrame =
            drawable.sourceLayerId && localFrameBySourceId.has(drawable.sourceLayerId)
              ? localFrameBySourceId.get(drawable.sourceLayerId) ?? currentFrame
              : currentFrame;
          const animatedPosition = animatedLayer
            ? evaluateLayerPosition(animatedLayer, localFrame)
            : {
                x: drawable.left + (drawable.canvas.width || 0) / 2,
                y: drawable.top + (drawable.canvas.height || 0) / 2,
              };
          const animatedScale = animatedLayer
            ? evaluateLayerScale(animatedLayer, localFrame)
            : { x: 100, y: 100 };
          const animatedRotation = animatedLayer
            ? evaluateLayerRotation(animatedLayer, localFrame)
            : 0;
          const animatedOpacity = animatedLayer
            ? evaluateLayerOpacity(animatedLayer, localFrame)
            : 100;
          const localAnchor = animatedLayer
            ? animatedLayer.anchor
            : { x: drawable.canvas.width / 2, y: drawable.canvas.height / 2 };
          const layerTransformOffset = animatedLayer?.transformOffset ?? { x: 0, y: 0 };
          const layerGeometry = getTransformGeometry(
            drawable.canvas.width || 0,
            drawable.canvas.height || 0,
            animatedPosition,
            layerTransformOffset,
            localAnchor,
            animatedScale,
            animatedRotation
          );

          compositionContext.save();
          compositionContext.globalAlpha = animatedOpacity / 100;
          compositionContext.translate(layerGeometry.origin.x, layerGeometry.origin.y);
          compositionContext.translate(localAnchor.x, localAnchor.y);
          compositionContext.rotate(degreesToRadians(animatedRotation));
          compositionContext.scale(animatedScale.x / 100, animatedScale.y / 100);
          compositionContext.translate(-localAnchor.x, -localAnchor.y);
          compositionContext.drawImage(drawable.canvas, 0, 0);
          compositionContext.restore();
        });

        context.save();
        context.globalAlpha = compositionOpacity / 100;
        context.translate(compositionGeometry.origin.x, compositionGeometry.origin.y);
        context.translate(composition.anchor.x, composition.anchor.y);
        context.rotate(degreesToRadians(compositionRotation));
        context.scale(compositionScale.x / 100, compositionScale.y / 100);
        context.translate(-composition.anchor.x, -composition.anchor.y);
        context.drawImage(compositionSurface, 0, 0);
        context.restore();
        return;
      }

      [...item.drawables].reverse().forEach((drawable) => {
        if (!drawable.visible || !drawable.canvas) return;
        const animatedLayer = drawable.sourceLayerId
          ? layerMap.get(drawable.sourceLayerId)
          : null;
        const localFrame =
          drawable.sourceLayerId && localFrameBySourceId.has(drawable.sourceLayerId)
            ? localFrameBySourceId.get(drawable.sourceLayerId) ?? currentFrame
            : currentFrame;
        const animatedPosition = animatedLayer
          ? evaluateLayerPosition(animatedLayer, localFrame)
          : {
              x: drawable.left + (drawable.canvas.width || 0) / 2,
              y: drawable.top + (drawable.canvas.height || 0) / 2,
            };
        const animatedScale = animatedLayer
          ? evaluateLayerScale(animatedLayer, localFrame)
          : { x: 100, y: 100 };
        const animatedRotation = animatedLayer
          ? evaluateLayerRotation(animatedLayer, localFrame)
          : 0;
        const animatedOpacity = animatedLayer
          ? evaluateLayerOpacity(animatedLayer, localFrame)
          : 100;
        const localAnchor = animatedLayer
          ? animatedLayer.anchor
          : { x: drawable.canvas.width / 2, y: drawable.canvas.height / 2 };
        const layerTransformOffset = animatedLayer?.transformOffset ?? { x: 0, y: 0 };
        const layerGeometry = getTransformGeometry(
          drawable.canvas.width || 0,
          drawable.canvas.height || 0,
          animatedPosition,
          layerTransformOffset,
          localAnchor,
          animatedScale,
          animatedRotation
        );

        context.save();
        context.globalAlpha = animatedOpacity / 100;
        context.translate(layerGeometry.origin.x, layerGeometry.origin.y);
        context.translate(localAnchor.x, localAnchor.y);
        context.rotate(degreesToRadians(animatedRotation));
        context.scale(animatedScale.x / 100, animatedScale.y / 100);
        context.translate(-localAnchor.x, -localAnchor.y);
        context.drawImage(drawable.canvas, 0, 0);
        context.restore();
      });
    });
}

export function getActiveRenderItems(
  renderItems: RenderItem[],
  timelineItems: TimelineItem[],
  currentFrame: number
) {
  const activeSourceIds = new Set(
    timelineItems
      .filter(
        (item) =>
          currentFrame >= item.startFrame &&
          currentFrame < item.startFrame + item.durationFrames
      )
      .map((item) => item.sourceId)
  );

  return renderItems.filter((item) => activeSourceIds.has(item.sourceId));
}

export function flattenRenderItemsToDrawables(
  renderItemsByCompId: Record<string, RenderItem[]>,
  compId: string
): RenderItem["drawables"] {
  return (renderItemsByCompId[compId] ?? []).flatMap((item) =>
    item.kind === "subComp" && item.targetCompId
      ? flattenRenderItemsToDrawables(renderItemsByCompId, item.targetCompId)
      : item.drawables
  );
}
