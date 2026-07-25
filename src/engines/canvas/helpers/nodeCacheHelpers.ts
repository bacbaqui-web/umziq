import type {
  CompositionPreviewNode,
  LayerPreviewNode,
  PlaceholderPreviewNode,
  PreviewNode,
  PreviewScene,
} from "@/engines/playback-render";
import {
  createCleanDirtyStateSnapshot,
  createDirtySceneSnapshotFromPreviewScene,
  updateDirtyStateSnapshot,
} from "@/engines/canvas/helpers/dirtyStateHelpers";
import type { DirtyNodeRecord } from "@/engines/canvas/models/dirtyStateModel";
import type {
  PreviewNodeCacheResult,
  PreviewNodeCacheStats,
} from "@/engines/canvas/models/nodeCacheModel";

function countPreviewNodes(node: PreviewNode): number {
  return (
    1 +
    node.children.reduce((total, child) => total + countPreviewNodes(child), 0)
  );
}

function countPreviewSceneNodes(scene: PreviewScene | null): number {
  return (
    scene?.nodes.reduce((total, node) => total + countPreviewNodes(node), 0) ??
    0
  );
}

function createEmptyStats(): PreviewNodeCacheStats {
  return {
    updatedNodeCount: 0,
    reusedNodeCount: 0,
  };
}

function addStats(
  left: PreviewNodeCacheStats,
  right: PreviewNodeCacheStats
): PreviewNodeCacheStats {
  return {
    updatedNodeCount: left.updatedNodeCount + right.updatedNodeCount,
    reusedNodeCount: left.reusedNodeCount + right.reusedNodeCount,
  };
}

function mapPreviewNodesById(
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

function createDirtyNodeIdSet(
  dirtyNodes: readonly DirtyNodeRecord[]
): ReadonlySet<string> {
  return new Set(
    dirtyNodes
      .filter((record) => record.kind !== "scene")
      .map((record) => record.id)
  );
}

function cloneDirtyNode(node: PreviewNode, children: PreviewNode[]) {
  if (node.kind === "layer") {
    return { ...node } satisfies LayerPreviewNode;
  }

  if (node.kind === "placeholder") {
    return { ...node } satisfies PlaceholderPreviewNode;
  }

  return {
    ...node,
    children,
  } satisfies CompositionPreviewNode;
}

function areSameNodeReferences(
  left: readonly PreviewNode[],
  right: readonly PreviewNode[]
): boolean {
  return (
    left.length === right.length &&
    left.every((node, index) => node === right[index])
  );
}

function cachePreviewNode({
  previousNodeById,
  dirtyNodeIds,
  nextNode,
}: {
  previousNodeById: ReadonlyMap<string, PreviewNode>;
  dirtyNodeIds: ReadonlySet<string>;
  nextNode: PreviewNode;
}): { node: PreviewNode; stats: PreviewNodeCacheStats } {
  const previousNode = previousNodeById.get(nextNode.id);
  let childStats = createEmptyStats();
  const children = nextNode.children.map((child) => {
    const result = cachePreviewNode({
      previousNodeById,
      dirtyNodeIds,
      nextNode: child,
    });
    childStats = addStats(childStats, result.stats);
    return result.node;
  });

  const canReuse =
    previousNode &&
    previousNode.kind === nextNode.kind &&
    !dirtyNodeIds.has(nextNode.id) &&
    areSameNodeReferences(previousNode.children, children);

  if (canReuse) {
    return {
      node: previousNode,
      stats: addStats(childStats, {
        updatedNodeCount: 0,
        reusedNodeCount: 1,
      }),
    };
  }

  return {
    node: cloneDirtyNode(nextNode, children),
    stats: addStats(childStats, {
      updatedNodeCount: 1,
      reusedNodeCount: 0,
    }),
  };
}

export function applyPreviewNodeCache({
  previousScene,
  nextScene,
  dirtyNodes,
}: {
  previousScene: PreviewScene | null;
  nextScene: PreviewScene | null;
  dirtyNodes: readonly DirtyNodeRecord[];
}): PreviewNodeCacheResult {
  if (!nextScene) {
    return {
      scene: null,
      stats: createEmptyStats(),
    };
  }

  if (
    !previousScene ||
    previousScene.compositionId !== nextScene.compositionId
  ) {
    return {
      scene: nextScene,
      stats: {
        updatedNodeCount: countPreviewSceneNodes(nextScene),
        reusedNodeCount: 0,
      },
    };
  }

  const previousNodeById = mapPreviewNodesById(previousScene.nodes);
  const dirtyNodeIds = createDirtyNodeIdSet(dirtyNodes);
  let stats = createEmptyStats();
  const nodes = nextScene.nodes.map((node) => {
    const result = cachePreviewNode({
      previousNodeById,
      dirtyNodeIds,
      nextNode: node,
    });
    stats = addStats(stats, result.stats);
    return result.node;
  });
  const sceneDirty = dirtyNodes.some((record) => record.kind === "scene");
  const nodesChanged = nodes.some(
    (node, index) => node !== previousScene.nodes[index]
  );
  const scene =
    sceneDirty || nodesChanged ? { ...nextScene, nodes } : previousScene;

  return {
    scene,
    stats,
  };
}

export function applyPreviewNodeCacheFromScenes(
  previousScene: PreviewScene | null,
  nextScene: PreviewScene | null
): PreviewNodeCacheResult {
  const previousSnapshot =
    createDirtySceneSnapshotFromPreviewScene(previousScene);
  const nextSnapshot = createDirtySceneSnapshotFromPreviewScene(nextScene);
  const dirtySnapshot = updateDirtyStateSnapshot(
    createCleanDirtyStateSnapshot(previousSnapshot),
    nextSnapshot
  );

  return applyPreviewNodeCache({
    previousScene,
    nextScene,
    dirtyNodes: dirtySnapshot.dirtyNodes,
  });
}
