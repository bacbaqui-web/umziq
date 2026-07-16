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
  EvaluatedRenderTransform,
  RenderCommand,
  RenderDrawableCommand,
  RenderFrame,
} from "@/engines/playback-render/models/renderFrameModel";

type BuildRenderFrameOptions = {
  compositionId: string;
  width: number;
  height: number;
  renderItems: readonly RenderItem[];
  timelineItems: readonly TimelineItem[];
  layerMap: ReadonlyMap<string, Layer>;
  compositionMap: ReadonlyMap<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  globalFrame: number;
};

type BuildRenderFrameFromItemsOptions = Omit<
  BuildRenderFrameOptions,
  "timelineItems"
> & {
  localFrameBySourceId: ReadonlyMap<string, number>;
};

function buildEvaluatedTransform(
  width: number,
  height: number,
  position: Position,
  transformOffset: Position,
  anchor: Position,
  scale: Scale,
  rotation: number
): EvaluatedRenderTransform {
  return {
    position,
    transformOffset,
    anchor,
    scale,
    rotation,
    origin: {
      x: position.x + transformOffset.x - width / 2,
      y: position.y + transformOffset.y - height / 2,
    },
  };
}

function buildDrawableCommand(options: {
  renderItem: RenderItem;
  drawable: RenderDrawable;
  layerMap: ReadonlyMap<string, Layer>;
  globalFrame: number;
  localFrameBySourceId: ReadonlyMap<string, number>;
}): RenderDrawableCommand | null {
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
  const width = canvas.width || 0;
  const height = canvas.height || 0;
  const position = layer
    ? evaluateLayerPosition(layer, localFrame)
    : { x: drawable.left + width / 2, y: drawable.top + height / 2 };
  const scale = layer
    ? evaluateLayerScale(layer, localFrame)
    : { x: 100, y: 100 };
  const rotation = layer ? evaluateLayerRotation(layer, localFrame) : 0;
  const opacity = layer ? evaluateLayerOpacity(layer, localFrame) : 100;
  const anchor = layer ? layer.anchor : { x: width / 2, y: height / 2 };
  const transformOffset = layer?.transformOffset ?? { x: 0, y: 0 };

  return {
    type: "drawable",
    renderItemId: renderItem.id,
    drawableId: drawable.id,
    sourceId: drawable.sourceLayerId ?? renderItem.sourceId,
    localFrame,
    width,
    height,
    canvas,
    transform: buildEvaluatedTransform(
      width,
      height,
      position,
      transformOffset,
      anchor,
      scale,
      rotation
    ),
    opacity,
  };
}

export function buildRenderFrameFromItems({
  compositionId,
  width,
  height,
  renderItems,
  layerMap,
  compositionMap,
  metaByCompId,
  globalFrame,
  localFrameBySourceId,
}: BuildRenderFrameFromItemsOptions): RenderFrame {
  const commands: RenderCommand[] = [];

  [...renderItems].reverse().forEach((renderItem) => {
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
      const compositionWidth = meta?.width ?? width;
      const compositionHeight = meta?.height ?? height;
      const position = evaluateCompositionPosition(composition, localFrame);
      const scale = evaluateCompositionScale(composition, localFrame);
      const rotation = evaluateCompositionRotation(composition, localFrame);
      const opacity = evaluateCompositionOpacity(composition, localFrame);
      const children = [...renderItem.drawables]
        .reverse()
        .map((drawable) =>
          buildDrawableCommand({
            renderItem,
            drawable,
            layerMap,
            globalFrame,
            localFrameBySourceId,
          })
        )
        .filter((command): command is RenderDrawableCommand => command !== null);

      commands.push({
        type: "composition",
        renderItemId: renderItem.id,
        sourceId: renderItem.sourceId,
        targetCompId: renderItem.targetCompId,
        localFrame,
        width: compositionWidth,
        height: compositionHeight,
        transform: buildEvaluatedTransform(
          compositionWidth,
          compositionHeight,
          position,
          composition.transformOffset,
          composition.anchor,
          scale,
          rotation
        ),
        opacity,
        children,
      });
      return;
    }

    [...renderItem.drawables].reverse().forEach((drawable) => {
      const command = buildDrawableCommand({
        renderItem,
        drawable,
        layerMap,
        globalFrame,
        localFrameBySourceId,
      });

      if (command) {
        commands.push(command);
      }
    });
  });

  return { compositionId, globalFrame, width, height, commands };
}

export function buildRenderFrame(options: BuildRenderFrameOptions) {
  const localFrameBySourceId = buildLocalFrameBySourceId(
    [...options.timelineItems],
    options.globalFrame
  );
  const activeRenderItems = getActiveRenderItems(
    options.renderItems,
    options.timelineItems,
    options.globalFrame
  );

  return buildRenderFrameFromItems({
    ...options,
    renderItems: activeRenderItems,
    localFrameBySourceId,
  });
}
