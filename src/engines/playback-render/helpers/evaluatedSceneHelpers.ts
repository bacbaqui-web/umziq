import type {
  Composition,
  CompositionMeta,
  Layer,
  Position,
  Scale,
  TimelineItem,
} from "@/models";
import type { RenderDrawable, RenderItem } from "@/engines/project";
import {
  buildLocalFrameBySourceId,
  evaluateCompositionOpacity,
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerOpacity,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
} from "@/engines/animation";
import { getActiveRenderItems } from "@/engines/playback-render/helpers/activeTimelineItemHelpers";
import type {
  EvaluatedScene,
  EvaluatedSceneCompositionNode,
  EvaluatedSceneDrawableNode,
  EvaluatedSceneNode,
  EvaluatedSceneTransform,
} from "@/engines/playback-render/models/evaluatedSceneModel";

export type BuildEvaluatedSceneOptions = {
  compositionId: string;
  width: number;
  height: number;
  renderItems: readonly RenderItem[];
  timelineItems: readonly TimelineItem[];
  layerMap: ReadonlyMap<string, Layer>;
  compositionMap: ReadonlyMap<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  globalFrame: number;
  frameRate?: number;
};

type BuildEvaluatedSceneFromItemsOptions = Omit<
  BuildEvaluatedSceneOptions,
  "timelineItems"
> & {
  localFrameBySourceId: ReadonlyMap<string, number>;
};

function buildEvaluatedTransform(
  position: Position,
  transformOffset: Position,
  anchor: Position,
  scale: Scale,
  rotation: number
): EvaluatedSceneTransform {
  return {
    position,
    transformOffset,
    anchor,
    scale,
    rotation,
  };
}

function buildDrawableNode(options: {
  renderItem: RenderItem;
  drawable: RenderDrawable;
  layerMap: ReadonlyMap<string, Layer>;
  globalFrame: number;
  localFrameBySourceId: ReadonlyMap<string, number>;
  frameRate: number;
  order: number;
}): EvaluatedSceneDrawableNode | null {
  const { renderItem, drawable, layerMap, globalFrame, localFrameBySourceId } =
    options;
  const canvas = drawable.canvas;

  if (!drawable.visible || !canvas) {
    return null;
  }

  const layer = drawable.sourceLayerId
    ? layerMap.get(drawable.sourceLayerId)
    : undefined;
  const localFrame =
    drawable.sourceLayerId && localFrameBySourceId.has(drawable.sourceLayerId)
      ? localFrameBySourceId.get(drawable.sourceLayerId) ?? globalFrame
      : globalFrame;
  const logicalSize = {
    width: canvas.width || 0,
    height: canvas.height || 0,
  };
  const position = layer
    ? evaluateLayerPosition(layer, localFrame, options.frameRate)
    : {
        x: drawable.left + logicalSize.width / 2,
        y: drawable.top + logicalSize.height / 2,
      };
  const scale = layer
    ? evaluateLayerScale(layer, localFrame)
    : { x: 100, y: 100 };
  const rotation = layer ? evaluateLayerRotation(layer, localFrame) : 0;
  const opacity = layer ? evaluateLayerOpacity(layer, localFrame) : 100;
  const anchor = layer
    ? layer.anchor
    : { x: logicalSize.width / 2, y: logicalSize.height / 2 };
  const transformOffset = layer?.transformOffset ?? { x: 0, y: 0 };

  return {
    type: "drawable",
    renderItemId: renderItem.id,
    drawableId: drawable.id,
    sourceId: drawable.sourceLayerId ?? renderItem.sourceId,
    layerId: drawable.sourceLayerId,
    localFrame,
    visible: true,
    order: options.order,
    logicalSize,
    transform: buildEvaluatedTransform(
      position,
      transformOffset,
      anchor,
      scale,
      rotation
    ),
    opacity,
  };
}

function buildDrawableNodes(options: {
  renderItem: RenderItem;
  layerMap: ReadonlyMap<string, Layer>;
  globalFrame: number;
  localFrameBySourceId: ReadonlyMap<string, number>;
  frameRate: number;
}): EvaluatedSceneDrawableNode[] {
  return [...options.renderItem.drawables]
    .reverse()
    .map((drawable, order) =>
      buildDrawableNode({
        ...options,
        drawable,
        order,
      })
    )
    .filter((node): node is EvaluatedSceneDrawableNode => node !== null);
}

export function buildEvaluatedSceneFromItems({
  compositionId,
  width,
  height,
  renderItems,
  layerMap,
  compositionMap,
  metaByCompId,
  globalFrame,
  frameRate = 30,
  localFrameBySourceId,
}: BuildEvaluatedSceneFromItemsOptions): EvaluatedScene {
  const nodes: EvaluatedSceneNode[] = [];

  [...renderItems].reverse().forEach((renderItem, order) => {
    if (!renderItem.visible) {
      return;
    }

    const composition =
      renderItem.kind === "subComp" && renderItem.targetCompId
        ? compositionMap.get(renderItem.targetCompId)
        : undefined;

    if (composition && renderItem.targetCompId) {
      const localFrame = localFrameBySourceId.has(renderItem.sourceId)
        ? localFrameBySourceId.get(renderItem.sourceId) ?? globalFrame
        : globalFrame;
      const meta = metaByCompId[composition.id];
      const targetFrameRate = meta?.frameRate ?? frameRate;
      const position = evaluateCompositionPosition(
        composition,
        localFrame,
        targetFrameRate
      );
      const scale = evaluateCompositionScale(composition, localFrame);
      const rotation = evaluateCompositionRotation(composition, localFrame);
      const opacity = evaluateCompositionOpacity(composition, localFrame);
      const node: EvaluatedSceneCompositionNode = {
        type: "composition",
        renderItemId: renderItem.id,
        sourceId: renderItem.sourceId,
        targetCompId: renderItem.targetCompId,
        localFrame,
        visible: true,
        order,
        size: {
          width: meta?.width ?? width,
          height: meta?.height ?? height,
        },
        transform: buildEvaluatedTransform(
          position,
          composition.transformOffset,
          composition.anchor,
          scale,
          rotation
        ),
        opacity,
        children: buildDrawableNodes({
          renderItem,
          layerMap,
          globalFrame,
          localFrameBySourceId,
          frameRate: targetFrameRate,
        }),
      };

      nodes.push(node);
      return;
    }

    nodes.push(
      ...buildDrawableNodes({
        renderItem,
        layerMap,
        globalFrame,
        localFrameBySourceId,
        frameRate,
      }).map((node) => ({ ...node, order }))
    );
  });

  return {
    compositionId,
    globalFrame,
    size: { width, height },
    localFrameBySourceId,
    nodes,
  };
}

export function buildEvaluatedScene(options: BuildEvaluatedSceneOptions) {
  const localFrameBySourceId = buildLocalFrameBySourceId(
    [...options.timelineItems],
    options.globalFrame
  );
  const activeRenderItems = getActiveRenderItems(
    options.renderItems,
    options.timelineItems,
    options.globalFrame
  );

  return buildEvaluatedSceneFromItems({
    ...options,
    renderItems: activeRenderItems,
    localFrameBySourceId,
    frameRate: options.frameRate ?? 30,
  });
}
