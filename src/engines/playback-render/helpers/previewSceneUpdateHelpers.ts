import type { Position, Scale } from "@/models";
import type {
  CompositionPreviewNode,
  LayerPreviewNode,
  PreviewNode,
  PreviewScene,
} from "@/engines/playback-render/models/previewSceneModel";
import type { EvaluatedSceneSize } from "@/engines/playback-render/models/evaluatedSceneModel";

export type PreviewSceneUpdateTarget =
  | { kind: "layer"; id: string; itemId?: string; sourceId?: string }
  | { kind: "composition"; id: string; itemId?: string; sourceId?: string };

export type PreviewSceneTransformPatch = {
  position?: Position;
  scale?: Scale;
  rotation?: number;
  opacity?: number;
  anchor?: Position;
  transformOffset?: Position;
};

export type PreviewSceneUpdateStats = {
  readonly updatedNodeCount: number;
  readonly reusedNodeCount: number;
};

export type PreviewSceneUpdateResult = {
  readonly scene: PreviewScene | null;
  readonly stats: PreviewSceneUpdateStats;
};

function isSamePosition(
  left: Position | undefined,
  right: Position | undefined
) {
  return left?.x === right?.x && left?.y === right?.y;
}

function isSameScale(left: Scale | undefined, right: Scale | undefined) {
  return left?.x === right?.x && left?.y === right?.y;
}

function isSameSize(
  left: EvaluatedSceneSize | undefined,
  right: EvaluatedSceneSize | undefined
) {
  return left?.width === right?.width && left?.height === right?.height;
}

function isSamePreviewNodeFrame(
  current: PreviewNode,
  next: PreviewNode,
  children: readonly PreviewNode[]
) {
  return (
    current.kind === next.kind &&
    current.layerDocumentId === next.layerDocumentId &&
    current.itemId === next.itemId &&
    current.sourceId === next.sourceId &&
    current.sourceResourceCacheKey === next.sourceResourceCacheKey &&
    current.layerResultCacheKey === next.layerResultCacheKey &&
    current.sourceType === next.sourceType &&
    current.renderItemId === next.renderItemId &&
    current.parentId === next.parentId &&
    current.opacity === next.opacity &&
    current.visible === next.visible &&
    current.order === next.order &&
    current.localFrame === next.localFrame &&
    current.globalFrame === next.globalFrame &&
    isSameSize(current.logicalSize, next.logicalSize) &&
    isSamePosition(current.transform.position, next.transform.position) &&
    isSamePosition(
      current.transform.transformOffset,
      next.transform.transformOffset
    ) &&
    isSamePosition(current.transform.anchor, next.transform.anchor) &&
    isSameScale(current.transform.scale, next.transform.scale) &&
    current.transform.rotation === next.transform.rotation &&
    current.children === children &&
    (current.kind !== "layer" ||
      (next.kind === "layer" &&
        current.drawableId === next.drawableId &&
        current.layerId === next.layerId)) &&
    (current.kind !== "composition" ||
      (next.kind === "composition" &&
        current.targetCompId === next.targetCompId)) &&
    (current.kind !== "placeholder" ||
      (next.kind === "placeholder" &&
        current.placeholder === next.placeholder))
  );
}

function isPreviewNodeTarget(
  node: PreviewNode,
  target: PreviewSceneUpdateTarget
) {
  if (target.itemId && node.itemId !== target.itemId) return false;
  if (target.sourceId && node.sourceId !== target.sourceId) return false;
  if (node.layerDocumentId) {
    return (
      node.layerDocumentId === target.id &&
      (target.kind === "composition"
        ? node.kind === "composition"
        : node.kind !== "composition")
    );
  }
  if (target.kind === "layer") {
    return (
      node.kind !== "composition" &&
      (node.kind === "placeholder" ||
        node.layerId === target.id ||
        node.sourceId === target.id)
    );
  }

  return (
    node.kind === "composition" &&
    (node.targetCompId === target.id || node.sourceId === target.id)
  );
}

function updatePreviewNode(
  node: PreviewNode,
  target: PreviewSceneUpdateTarget,
  patch: PreviewSceneTransformPatch
): { node: PreviewNode; changed: boolean } {
  const isTarget = isPreviewNodeTarget(node, target);
  let changed = false;
  let children = node.children;

  if (node.kind === "composition") {
    const nextChildren = node.children.map((child) => {
      const result = updatePreviewNode(child, target, patch);
      if (result.changed) changed = true;
      return result.node;
    });

    if (changed) {
      children = nextChildren;
    }
  }

  if (!isTarget && !changed) {
    return { node, changed: false };
  }

  const nextNode = {
    ...node,
    children,
    opacity: patch.opacity ?? node.opacity,
    transform: {
      ...node.transform,
      position: patch.position ?? node.transform.position,
      scale: patch.scale ?? node.transform.scale,
      rotation: patch.rotation ?? node.transform.rotation,
      anchor: patch.anchor ?? node.transform.anchor,
      transformOffset: patch.transformOffset ?? node.transform.transformOffset,
    },
  } as PreviewNode;

  return { node: nextNode, changed: true };
}

function countPreviewNodes(node: PreviewNode): number {
  return 1 + node.children.reduce((total, child) => total + countPreviewNodes(child), 0);
}

export function updatePreviewSceneNodeTransform(
  previewScene: PreviewScene,
  target: PreviewSceneUpdateTarget,
  patch: PreviewSceneTransformPatch
): PreviewScene {
  return updatePreviewSceneNodeTransformWithStats(previewScene, target, patch).scene;
}

export function updatePreviewSceneNodeTransformWithStats(
  previewScene: PreviewScene,
  target: PreviewSceneUpdateTarget,
  patch: PreviewSceneTransformPatch
): { scene: PreviewScene; stats: PreviewSceneUpdateStats } {
  let changed = false;
  let updatedNodeCount = 0;
  let totalNodeCount = 0;
  const nodes = previewScene.nodes.map((node) => {
    totalNodeCount += countPreviewNodes(node);
    const result = updatePreviewNode(node, target, patch);
    if (result.changed) {
      changed = true;
      updatedNodeCount += countPreviewNodes(result.node);
    }
    return result.node;
  });

  return {
    scene: changed ? { ...previewScene, nodes } : previewScene,
    stats: {
      updatedNodeCount,
      reusedNodeCount: Math.max(0, totalNodeCount - updatedNodeCount),
    },
  };
}

function updatePreviewNodeFromPlaybackFrame(
  current: PreviewNode | undefined,
  next: PreviewNode
): PreviewNode {
  if (!current || current.id !== next.id || current.kind !== next.kind) {
    return next;
  }

  if (next.kind === "layer") {
    return isSamePreviewNodeFrame(current, next, next.children)
      ? current
      : ({ ...next } satisfies LayerPreviewNode);
  }

  if (next.kind === "placeholder") {
    return isSamePreviewNodeFrame(current, next, next.children)
      ? current
      : { ...next };
  }

  const currentChildById = new Map(
    current.kind === "composition"
      ? current.children.map((child) => [child.id, child])
      : []
  );
  const children = next.children.map((child) =>
    updatePreviewNodeFromPlaybackFrame(currentChildById.get(child.id), child)
  );

  return isSamePreviewNodeFrame(current, next, children)
    ? current
    : ({ ...next, children } satisfies CompositionPreviewNode);
}

export function updatePreviewSceneFromPlaybackFrame(
  currentScene: PreviewScene | null,
  nextScene: PreviewScene | null
): PreviewScene | null {
  return updatePreviewSceneFromPlaybackFrameWithStats(currentScene, nextScene)
    .scene;
}

function countPreviewSceneNodes(scene: PreviewScene | null): number {
  return scene?.nodes.reduce((total, node) => total + countPreviewNodes(node), 0) ?? 0;
}

export function updatePreviewSceneFromPlaybackFrameWithStats(
  currentScene: PreviewScene | null,
  nextScene: PreviewScene | null
): PreviewSceneUpdateResult {
  if (!currentScene || !nextScene) {
    return {
      scene: nextScene,
      stats: {
        updatedNodeCount: countPreviewSceneNodes(nextScene),
        reusedNodeCount: 0,
      },
    };
  }

  if (currentScene.compositionId !== nextScene.compositionId) {
    return {
      scene: nextScene,
      stats: {
        updatedNodeCount: countPreviewSceneNodes(nextScene),
        reusedNodeCount: 0,
      },
    };
  }

  const currentNodeById = new Map(
    currentScene.nodes.map((node) => [node.id, node])
  );
  const nodes = nextScene.nodes.map((node) =>
    updatePreviewNodeFromPlaybackFrame(currentNodeById.get(node.id), node)
  );
  const changed =
    currentScene.globalFrame !== nextScene.globalFrame ||
    !isSameSize(currentScene.logicalSize, nextScene.logicalSize) ||
    currentScene.nodes.length !== nextScene.nodes.length ||
    nodes.some((node, index) => node !== currentScene.nodes[index]);

  const updatedNodeCount = nodes.reduce(
    (total, node, index) =>
      total + (node === currentScene.nodes[index] ? 0 : countPreviewNodes(node)),
    0
  );
  const totalNodeCount = countPreviewSceneNodes(nextScene);

  return {
    scene: changed ? { ...nextScene, nodes } : currentScene,
    stats: {
      updatedNodeCount,
      reusedNodeCount: Math.max(0, totalNodeCount - updatedNodeCount),
    },
  };
}
