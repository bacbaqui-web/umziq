import type {
  EvaluatedScene,
  EvaluatedSceneNode,
} from "@/engines/playback-render/models/evaluatedSceneModel";
import type {
  CompositionPreviewNode,
  LayerPreviewNode,
  PlaceholderPreviewNode,
  PreviewNode,
  PreviewScene,
} from "@/engines/playback-render/models/previewSceneModel";
import type { PreviewRendererResult } from "@/engines/playback-render/models/rendererResultModel";
import type { RuntimeMetricRecordPort } from "@/engines/playback-render/models/runtimeMetricPortModel";

function createLayerPreviewNodeId(node: Extract<EvaluatedSceneNode, { type: "drawable" }>) {
  const identity = node.layerDocumentId ??
    (node.identityKind === "canonical-placement"
      ? node.itemId
      : node.renderItemId);
  return `layer:${identity}:${node.drawableId}`;
}

function createCompositionPreviewNodeId(
  node: Extract<EvaluatedSceneNode, { type: "composition" }>
) {
  const identity = node.layerDocumentId ??
    (node.identityKind === "canonical-placement"
      ? node.itemId
      : node.renderItemId);
  return `composition:${identity}:${node.targetCompId}`;
}

function createPlaceholderPreviewNodeId(
  node: Extract<EvaluatedSceneNode, { type: "placeholder" }>
) {
  return `placeholder:${node.itemId}`;
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
  switch (node.type) {
    case "drawable":
      return createLayerPreviewNodeId(node);
    case "composition":
      return createCompositionPreviewNodeId(node);
    case "placeholder":
      return createPlaceholderPreviewNodeId(node);
  }
}

function getLayerDocumentIdentity(node: EvaluatedSceneNode) {
  return node.layerDocumentId
    ? { layerDocumentId: node.layerDocumentId }
    : {};
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
      ...getLayerDocumentIdentity(node),
      itemId: node.itemId,
      sourceId: node.sourceId,
      sourceResourceCacheKey:
        node.sourceResourceCacheKey,
      layerResultCacheKey: node.layerResultCacheKey,
      sourceType: node.sourceType,
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

  if (node.type === "placeholder") {
    const previewNode: PlaceholderPreviewNode = {
      id: createPlaceholderPreviewNodeId(node),
      kind: "placeholder",
      ...getLayerDocumentIdentity(node),
      itemId: node.itemId,
      sourceId: node.sourceId,
      sourceResourceCacheKey:
        node.sourceResourceCacheKey,
      layerResultCacheKey: node.layerResultCacheKey,
      sourceType: node.sourceType,
      renderItemId: null,
      parentId,
      children: [],
      transform: node.transform,
      opacity: node.opacity,
      visible: node.visible,
      order: node.order,
      localFrame: node.localFrame,
      globalFrame,
      logicalSize: node.logicalSize,
      placeholder: node.placeholder,
    };
    return previewNode;
  }

  const id = createCompositionPreviewNodeId(node);
  const previewNode: CompositionPreviewNode = {
    id,
    kind: "composition",
    ...getLayerDocumentIdentity(node),
    itemId: node.itemId,
    sourceId: node.sourceId,
    sourceResourceCacheKey:
      node.sourceResourceCacheKey,
    layerResultCacheKey: node.layerResultCacheKey,
    sourceType: node.sourceType,
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
    previous.layerDocumentId === node.layerDocumentId &&
    previous.itemId === node.itemId &&
    previous.sourceId === node.sourceId &&
    previous.sourceResourceCacheKey ===
      node.sourceResourceCacheKey &&
    previous.layerResultCacheKey ===
      node.layerResultCacheKey &&
    previous.sourceType === node.sourceType &&
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

function isPlaceholderRenderStateEqual(
  previous: PreviewNode,
  node: Extract<EvaluatedSceneNode, { type: "placeholder" }>,
  parentId: string | null
): boolean {
  return (
    previous.kind === "placeholder" &&
    previous.id === createPlaceholderPreviewNodeId(node) &&
    previous.layerDocumentId === node.layerDocumentId &&
    previous.itemId === node.itemId &&
    previous.sourceId === node.sourceId &&
    previous.sourceResourceCacheKey ===
      node.sourceResourceCacheKey &&
    previous.layerResultCacheKey ===
      node.layerResultCacheKey &&
    previous.sourceType === node.sourceType &&
    previous.parentId === parentId &&
    previous.order === node.order &&
    previous.visible === node.visible &&
    previous.opacity === node.opacity &&
    previous.placeholder === node.placeholder &&
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
    previous.layerDocumentId === node.layerDocumentId &&
    previous.itemId === node.itemId &&
    previous.sourceId === node.sourceId &&
    previous.sourceResourceCacheKey ===
      node.sourceResourceCacheKey &&
    previous.layerResultCacheKey ===
      node.layerResultCacheKey &&
    previous.sourceType === node.sourceType &&
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

  if (node.type === "placeholder") {
    if (previous && isPlaceholderRenderStateEqual(previous, node, parentId)) {
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
    ...getLayerDocumentIdentity(node),
    itemId: node.itemId,
    sourceId: node.sourceId,
    sourceResourceCacheKey:
      node.sourceResourceCacheKey,
    layerResultCacheKey:
      node.layerResultCacheKey,
    sourceType: node.sourceType,
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

export function renderPreviewRenderer(
  evaluatedScene: EvaluatedScene,
  runtimeMetrics?: RuntimeMetricRecordPort,
  previousPreviewScene?: PreviewScene | null
): PreviewRendererResult {
  const startTime = performance.now();
  runtimeMetrics?.increment("previewRenderer");
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
      previewScene: result.previewScene,
    };
  }

  runtimeMetrics?.increment("previewSceneGeneration");
  return {
    previewScene: buildPreviewSceneFromEvaluatedScene(evaluatedScene),
  };
}
