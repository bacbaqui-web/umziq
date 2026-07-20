import type {
  EvaluatedScene,
  EvaluatedSceneNode,
} from "@/engines/playback-render/models/evaluatedSceneModel";
import type {
  CompositionPreviewNode,
  LayerPreviewNode,
  PreviewNode,
  PreviewScene,
} from "@/engines/playback-render/models/previewSceneModel";
import type { FastPreviewRendererResult } from "@/engines/playback-render/models/rendererModeModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";

function createLayerPreviewNodeId(node: Extract<EvaluatedSceneNode, { type: "drawable" }>) {
  return `layer:${node.renderItemId}:${node.drawableId}`;
}

function createCompositionPreviewNodeId(
  node: Extract<EvaluatedSceneNode, { type: "composition" }>
) {
  return `composition:${node.renderItemId}:${node.targetCompId}`;
}

function isSamePosition(
  left: { x: number; y: number },
  right: { x: number; y: number }
): boolean {
  return left.x === right.x && left.y === right.y;
}

function isSameScale(
  left: { x: number; y: number },
  right: { x: number; y: number }
): boolean {
  return left.x === right.x && left.y === right.y;
}

function isSameSize(
  left: { width: number; height: number },
  right: { width: number; height: number }
): boolean {
  return left.width === right.width && left.height === right.height;
}

function isSameTransform(
  left: PreviewNode["transform"],
  right: PreviewNode["transform"]
): boolean {
  return (
    isSamePosition(left.position, right.position) &&
    isSamePosition(left.transformOffset, right.transformOffset) &&
    isSamePosition(left.anchor, right.anchor) &&
    isSameScale(left.scale, right.scale) &&
    left.rotation === right.rotation
  );
}

function getPreviewNodeId(node: EvaluatedSceneNode): string {
  return node.type === "drawable"
    ? createLayerPreviewNodeId(node)
    : createCompositionPreviewNodeId(node);
}

function buildPreviewNode(
  node: EvaluatedSceneNode,
  globalFrame: number,
  parentId: string | null
): PreviewNode {
  if (node.type === "drawable") {
    const previewNode: LayerPreviewNode = {
      id: createLayerPreviewNodeId(node),
      kind: "layer",
      sourceId: node.sourceId,
      renderItemId: node.renderItemId,
      parentId,
      children: [],
      transform: node.transform,
      opacity: node.opacity,
      visible: node.visible,
      order: node.order,
      localFrame: node.localFrame,
      globalFrame,
      logicalSize: node.logicalSize,
      drawableId: node.drawableId,
      layerId: node.layerId,
    };

    return previewNode;
  }

  const id = createCompositionPreviewNodeId(node);
  const previewNode: CompositionPreviewNode = {
    id,
    kind: "composition",
    sourceId: node.sourceId,
    renderItemId: node.renderItemId,
    parentId,
    children: node.children.map((child) =>
      buildPreviewNode(child, globalFrame, id)
    ),
    transform: node.transform,
    opacity: node.opacity,
    visible: node.visible,
    order: node.order,
    localFrame: node.localFrame,
    globalFrame,
    logicalSize: node.size,
    targetCompId: node.targetCompId,
  };

  return previewNode;
}

function isLayerRenderStateEqual(
  previous: PreviewNode,
  node: Extract<EvaluatedSceneNode, { type: "drawable" }>,
  parentId: string | null
): boolean {
  return (
    previous.kind === "layer" &&
    previous.id === createLayerPreviewNodeId(node) &&
    previous.sourceId === node.sourceId &&
    previous.renderItemId === node.renderItemId &&
    previous.parentId === parentId &&
    previous.order === node.order &&
    previous.visible === node.visible &&
    previous.opacity === node.opacity &&
    previous.drawableId === node.drawableId &&
    previous.layerId === node.layerId &&
    isSameSize(previous.logicalSize, node.logicalSize) &&
    isSameTransform(previous.transform, node.transform)
  );
}

function isCompositionRenderStateEqual(
  previous: PreviewNode,
  node: Extract<EvaluatedSceneNode, { type: "composition" }>,
  parentId: string | null,
  children: readonly PreviewNode[]
): boolean {
  return (
    previous.kind === "composition" &&
    previous.id === createCompositionPreviewNodeId(node) &&
    previous.sourceId === node.sourceId &&
    previous.renderItemId === node.renderItemId &&
    previous.parentId === parentId &&
    previous.order === node.order &&
    previous.visible === node.visible &&
    previous.opacity === node.opacity &&
    previous.targetCompId === node.targetCompId &&
    isSameSize(previous.logicalSize, node.size) &&
    isSameTransform(previous.transform, node.transform) &&
    previous.children.length === children.length &&
    previous.children.every((child, index) => child === children[index])
  );
}

type PlaybackPreviewUpdateStats = {
  readonly dirtyNodeCount: number;
  readonly cleanNodeCount: number;
  readonly updatedNodeCount: number;
  readonly reusedNodeCount: number;
  readonly reusedCompositionCount: number;
};

function createEmptyPlaybackStats(): PlaybackPreviewUpdateStats {
  return {
    dirtyNodeCount: 0,
    cleanNodeCount: 0,
    updatedNodeCount: 0,
    reusedNodeCount: 0,
    reusedCompositionCount: 0,
  };
}

function addPlaybackStats(
  left: PlaybackPreviewUpdateStats,
  right: PlaybackPreviewUpdateStats
): PlaybackPreviewUpdateStats {
  return {
    dirtyNodeCount: left.dirtyNodeCount + right.dirtyNodeCount,
    cleanNodeCount: left.cleanNodeCount + right.cleanNodeCount,
    updatedNodeCount: left.updatedNodeCount + right.updatedNodeCount,
    reusedNodeCount: left.reusedNodeCount + right.reusedNodeCount,
    reusedCompositionCount:
      left.reusedCompositionCount + right.reusedCompositionCount,
  };
}

function buildPreviousPreviewNodeMap(
  nodes: readonly PreviewNode[]
): ReadonlyMap<string, PreviewNode> {
  const result = new Map<string, PreviewNode>();
  function visit(node: PreviewNode): void {
    result.set(node.id, node);
    node.children.forEach(visit);
  }
  nodes.forEach(visit);
  return result;
}

function buildPlaybackPreviewNode({
  node,
  globalFrame,
  parentId,
  previousNodeById,
}: {
  node: EvaluatedSceneNode;
  globalFrame: number;
  parentId: string | null;
  previousNodeById: ReadonlyMap<string, PreviewNode>;
}): { node: PreviewNode; stats: PlaybackPreviewUpdateStats } {
  const previous = previousNodeById.get(getPreviewNodeId(node));

  if (node.type === "drawable") {
    if (previous && isLayerRenderStateEqual(previous, node, parentId)) {
      return {
        node: previous,
        stats: {
          ...createEmptyPlaybackStats(),
          cleanNodeCount: 1,
          reusedNodeCount: 1,
        },
      };
    }

    return {
      node: buildPreviewNode(node, globalFrame, parentId),
      stats: {
        ...createEmptyPlaybackStats(),
        dirtyNodeCount: 1,
        updatedNodeCount: 1,
      },
    };
  }

  const id = createCompositionPreviewNodeId(node);
  let stats = createEmptyPlaybackStats();
  const children = node.children.map((child) => {
    const result = buildPlaybackPreviewNode({
      node: child,
      globalFrame,
      parentId: id,
      previousNodeById,
    });
    stats = addPlaybackStats(stats, result.stats);
    return result.node;
  });

  if (
    previous &&
    isCompositionRenderStateEqual(previous, node, parentId, children)
  ) {
    return {
      node: previous,
      stats: addPlaybackStats(stats, {
        ...createEmptyPlaybackStats(),
        cleanNodeCount: 1,
        reusedNodeCount: 1,
        reusedCompositionCount: 1,
      }),
    };
  }

  const previewNode: CompositionPreviewNode = {
    id,
    kind: "composition",
    sourceId: node.sourceId,
    renderItemId: node.renderItemId,
    parentId,
    children,
    transform: node.transform,
    opacity: node.opacity,
    visible: node.visible,
    order: node.order,
    localFrame: node.localFrame,
    globalFrame,
    logicalSize: node.size,
    targetCompId: node.targetCompId,
  };

  return {
    node: previewNode,
    stats: addPlaybackStats(stats, {
      ...createEmptyPlaybackStats(),
      dirtyNodeCount: 1,
      updatedNodeCount: 1,
    }),
  };
}

function buildPreviewSceneFromEvaluatedSceneForPlayback({
  evaluatedScene,
  previousPreviewScene,
}: {
  evaluatedScene: EvaluatedScene;
  previousPreviewScene: PreviewScene;
}): { previewScene: PreviewScene; stats: PlaybackPreviewUpdateStats } {
  const previousNodeById = buildPreviousPreviewNodeMap(
    previousPreviewScene.nodes
  );
  let stats = createEmptyPlaybackStats();
  const nodes = evaluatedScene.nodes.map((node) => {
    const result = buildPlaybackPreviewNode({
      node,
      globalFrame: evaluatedScene.globalFrame,
      parentId: null,
      previousNodeById,
    });
    stats = addPlaybackStats(stats, result.stats);
    return result.node;
  });
  const sceneChanged =
    previousPreviewScene.compositionId !== evaluatedScene.compositionId ||
    previousPreviewScene.globalFrame !== evaluatedScene.globalFrame ||
    !isSameSize(previousPreviewScene.logicalSize, evaluatedScene.size) ||
    previousPreviewScene.nodes.length !== nodes.length ||
    previousPreviewScene.nodes.some((node, index) => node !== nodes[index]);

  return {
    previewScene: sceneChanged
      ? {
          compositionId: evaluatedScene.compositionId,
          globalFrame: evaluatedScene.globalFrame,
          logicalSize: evaluatedScene.size,
          nodes,
        }
      : previousPreviewScene,
    stats,
  };
}

function recordPlaybackPreviewUpdateMetrics(
  runtimeMetrics: RuntimeMetricRecordPort | undefined,
  stats: PlaybackPreviewUpdateStats,
  elapsedMs: number
): void {
  runtimeMetrics?.increment("playbackDirtyNode", stats.dirtyNodeCount);
  runtimeMetrics?.increment("playbackCleanNode", stats.cleanNodeCount);
  runtimeMetrics?.increment("playbackNodeUpdated", stats.updatedNodeCount);
  runtimeMetrics?.increment("playbackNodeReused", stats.reusedNodeCount);
  runtimeMetrics?.increment(
    "playbackCompositionReused",
    stats.reusedCompositionCount
  );
  runtimeMetrics?.increment(
    "playbackFrameUpdateTime",
    Math.max(1, Math.ceil(elapsedMs))
  );
}

export function buildPreviewSceneFromEvaluatedScene(
  evaluatedScene: EvaluatedScene
): PreviewScene {
  return {
    compositionId: evaluatedScene.compositionId,
    globalFrame: evaluatedScene.globalFrame,
    logicalSize: evaluatedScene.size,
    nodes: evaluatedScene.nodes.map((node) =>
      buildPreviewNode(node, evaluatedScene.globalFrame, null)
    ),
  };
}

export function renderFastPreviewRenderer(
  evaluatedScene: EvaluatedScene,
  runtimeMetrics?: RuntimeMetricRecordPort,
  previousPreviewScene?: PreviewScene | null
): FastPreviewRendererResult {
  const startTime = performance.now();
  runtimeMetrics?.increment("fastPreviewRenderer");
  if (
    previousPreviewScene &&
    previousPreviewScene.compositionId === evaluatedScene.compositionId
  ) {
    const result = buildPreviewSceneFromEvaluatedSceneForPlayback({
      evaluatedScene,
      previousPreviewScene,
    });
    recordPlaybackPreviewUpdateMetrics(
      runtimeMetrics,
      result.stats,
      performance.now() - startTime
    );
    return {
      mode: "fast-render",
      previewScene: result.previewScene,
    };
  }

  runtimeMetrics?.increment("previewSceneGeneration");
  return {
    mode: "fast-render",
    previewScene: buildPreviewSceneFromEvaluatedScene(evaluatedScene),
  };
}
