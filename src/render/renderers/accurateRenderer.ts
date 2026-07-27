import type {
  EvaluatedSceneNode,
} from "@/render/models/evaluatedSceneModel";
import type {
  RenderCommand,
  RenderDrawableCommand,
  RenderFrame,
} from "@/render/models/renderFrameModel";
import type {
  RenderAccurateFrameOptions,
  AccurateRendererResult,
} from "@/render/models/rendererResultModel";
import type {
  RenderNodeVisualResolver,
} from "@/render/models/renderSourceModel";
import { buildRenderTransform } from "@/render/helpers/renderTransformHelpers";

function buildDrawableCommand(
  node: Extract<EvaluatedSceneNode, { type: "drawable" }>,
  resolveNodeVisual?: RenderNodeVisualResolver
): RenderDrawableCommand | null {
  const nodeNativeSource =
    node.layerDocumentId &&
    node.sourceId &&
    node.sourceResourceCacheKey &&
    node.layerResultCacheKey
      ? resolveNodeVisual?.({
          layerDocumentId: node.layerDocumentId,
          sourceId: node.sourceId,
          sourceResourceCacheKey:
            node.sourceResourceCacheKey,
          layerResultCacheKey:
            node.layerResultCacheKey,
          renderItemId: node.renderItemId,
          drawableId: node.drawableId,
          logicalSize: node.logicalSize,
        }) ?? null
      : null;
  if (nodeNativeSource) {
    return {
      type: "drawable",
      layerDocumentId: node.layerDocumentId,
      renderItemId: node.renderItemId,
      drawableId: node.drawableId,
      sourceId: node.sourceId,
      sourceResourceCacheKey:
        node.sourceResourceCacheKey,
      layerResultCacheKey:
        node.layerResultCacheKey,
      sourceType: node.sourceType,
      localFrame: node.localFrame,
      logicalSize: node.logicalSize,
      source: nodeNativeSource,
      transform: buildRenderTransform(
        node.logicalSize.width,
        node.logicalSize.height,
        node.transform
      ),
      opacity: node.opacity,
    };
  }
  return null;
}

function buildRenderCommand(
  node: EvaluatedSceneNode,
  resolveNodeVisual?: RenderNodeVisualResolver
): RenderCommand | null {
  if (node.type === "drawable") {
    return buildDrawableCommand(node, resolveNodeVisual);
  }

  if (node.type === "placeholder") {
    return {
      type: "placeholder",
      layerDocumentId: node.layerDocumentId,
      renderItemId: null,
      sourceId: node.sourceId,
      sourceType: node.sourceType,
      localFrame: node.localFrame,
      logicalSize: node.logicalSize,
      transform: buildRenderTransform(
        node.logicalSize.width,
        node.logicalSize.height,
        node.transform
      ),
      opacity: node.opacity,
      placeholder: node.placeholder,
    };
  }

  return {
    type: "composition",
    layerDocumentId: node.layerDocumentId,
    renderItemId: node.renderItemId,
    sourceId: node.sourceId,
    sourceType: node.sourceType,
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
        buildRenderCommand(
          child,
          resolveNodeVisual
        )
      )
      .filter((command): command is RenderCommand => command !== null),
  };
}

export function renderAccurateFrame({
  evaluatedScene,
  resolveNodeVisual,
}: RenderAccurateFrameOptions): RenderFrame {
  const commands = evaluatedScene.nodes
    .map((node) =>
      buildRenderCommand(node, resolveNodeVisual)
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
    frame: renderAccurateFrame(options),
  };
}
