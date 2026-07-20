import type { RenderDrawable, RenderItem } from "@/engines/project";
import type {
  EvaluatedSceneDrawableNode,
  EvaluatedSceneNode,
} from "@/engines/playback-render/models/evaluatedSceneModel";
import type {
  RenderCommand,
  RenderDrawableCommand,
  RenderFrame,
} from "@/engines/playback-render/models/renderFrameModel";
import type {
  RenderAccurateFrameOptions,
  AccurateRendererResult,
} from "@/engines/playback-render/models/rendererModeModel";
import type {
  RenderDrawableSource,
  RenderDrawableSourceResolver,
} from "@/engines/playback-render/models/renderSourceModel";
import { buildRenderTransform } from "@/engines/playback-render/helpers/renderTransformHelpers";

function buildDrawableLookup(renderItems: readonly RenderItem[]) {
  const lookup = new Map<string, RenderDrawable>();
  renderItems.forEach((renderItem) => {
    renderItem.drawables.forEach((drawable) => {
      lookup.set(`${renderItem.id}:${drawable.id}`, drawable);
    });
  });
  return lookup;
}

function findDrawable(
  lookup: ReadonlyMap<string, RenderDrawable>,
  node: EvaluatedSceneDrawableNode
) {
  return lookup.get(`${node.renderItemId}:${node.drawableId}`);
}

function buildDrawableCommand(
  node: EvaluatedSceneDrawableNode,
  drawableLookup: ReadonlyMap<string, RenderDrawable>,
  resolveDrawableSource?: RenderDrawableSourceResolver
): RenderDrawableCommand | null {
  const drawable = findDrawable(drawableLookup, node);
  const canvas = drawable?.canvas;

  if (!canvas) {
    return null;
  }

  const originalSource: RenderDrawableSource & { kind: "original" } = {
    kind: "original",
    image: canvas,
    pixelSize: { ...node.logicalSize },
  };
  const source = resolveDrawableSource?.({
    renderItemId: node.renderItemId,
    drawableId: node.drawableId,
    sourceId: node.sourceId,
    logicalSize: node.logicalSize,
    originalSource,
  }) ?? originalSource;

  return {
    type: "drawable",
    renderItemId: node.renderItemId,
    drawableId: node.drawableId,
    sourceId: node.sourceId,
    localFrame: node.localFrame,
    logicalSize: node.logicalSize,
    source,
    transform: buildRenderTransform(
      node.logicalSize.width,
      node.logicalSize.height,
      node.transform
    ),
    opacity: node.opacity,
  };
}

function buildRenderCommand(
  node: EvaluatedSceneNode,
  drawableLookup: ReadonlyMap<string, RenderDrawable>,
  resolveDrawableSource?: RenderDrawableSourceResolver
): RenderCommand | null {
  if (node.type === "drawable") {
    return buildDrawableCommand(node, drawableLookup, resolveDrawableSource);
  }

  return {
    type: "composition",
    renderItemId: node.renderItemId,
    sourceId: node.sourceId,
    targetCompId: node.targetCompId,
    localFrame: node.localFrame,
    width: node.size.width,
    height: node.size.height,
    transform: buildRenderTransform(
      node.size.width,
      node.size.height,
      node.transform
    ),
    opacity: node.opacity,
    children: node.children
      .map((child) =>
        buildRenderCommand(child, drawableLookup, resolveDrawableSource)
      )
      .filter((command): command is RenderCommand => command !== null),
  };
}

export function renderAccurateFrame({
  evaluatedScene,
  renderItems,
  resolveDrawableSource,
}: RenderAccurateFrameOptions): RenderFrame {
  const drawableLookup = buildDrawableLookup(renderItems);
  const commands = evaluatedScene.nodes
    .map((node) =>
      buildRenderCommand(node, drawableLookup, resolveDrawableSource)
    )
    .filter((command): command is RenderCommand => command !== null);

  return {
    compositionId: evaluatedScene.compositionId,
    globalFrame: evaluatedScene.globalFrame,
    width: evaluatedScene.size.width,
    height: evaluatedScene.size.height,
    commands,
  };
}

export function renderAccurateRenderer(
  options: RenderAccurateFrameOptions
): AccurateRendererResult {
  options.runtimeMetrics?.increment("accurateRenderer");
  return {
    mode: "full-render",
    frame: renderAccurateFrame(options),
  };
}
