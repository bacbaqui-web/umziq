import { getRenderTransformBounds } from "@/engines/playback-render/helpers/renderTransformHelpers";
import type {
  PreviewNode,
  PreviewScene,
} from "@/engines/playback-render/models/previewSceneModel";
import type {
  PreviewCanvasDrawState,
  PreviewNodeBounds,
} from "@/engines/playback-render/models/previewCanvasRenderModel";

export type PreviewSceneDrawPlan =
  | {
      mode: "full";
      nextNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
    }
  | {
      mode: "skip";
      nextNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
      skippedNodeCount: number;
    }
  | {
      mode: "dirty";
      dirtyBounds: PreviewNodeBounds;
      previousNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
      nextNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
    };

export function countPreviewNodes(node: PreviewNode): number {
  return (
    1 +
    node.children.reduce((total, child) => total + countPreviewNodes(child), 0)
  );
}

function countPreviewSceneNodes(nodes: readonly PreviewNode[]): number {
  return nodes.reduce((total, node) => total + countPreviewNodes(node), 0);
}

function getPreviewNodeBounds(node: PreviewNode): PreviewNodeBounds {
  return getRenderTransformBounds(
    node.logicalSize.width,
    node.logicalSize.height,
    node.transform
  );
}

function buildPreviewNodeBoundsMap(
  nodes: readonly PreviewNode[]
): ReadonlyMap<string, PreviewNodeBounds> {
  const result = new Map<string, PreviewNodeBounds>();
  function visit(node: PreviewNode): void {
    result.set(node.id, getPreviewNodeBounds(node));
    node.children.forEach(visit);
  }
  nodes.forEach(visit);
  return result;
}

function buildPreviewNodeMap(
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

function doBoundsIntersect(
  left: PreviewNodeBounds,
  right: PreviewNodeBounds
): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

function mergeBounds(
  left: PreviewNodeBounds | null,
  right: PreviewNodeBounds
): PreviewNodeBounds {
  if (!left) return right;
  return {
    left: Math.min(left.left, right.left),
    top: Math.min(left.top, right.top),
    right: Math.max(left.right, right.right),
    bottom: Math.max(left.bottom, right.bottom),
  };
}

function inflateBounds(bounds: PreviewNodeBounds, amount: number): PreviewNodeBounds {
  return {
    left: bounds.left - amount,
    top: bounds.top - amount,
    right: bounds.right + amount,
    bottom: bounds.bottom + amount,
  };
}

function getDirtyBounds({
  previousScene,
  nextScene,
  previousNodeBoundsById,
  nextNodeBoundsById,
}: {
  previousScene: PreviewScene;
  nextScene: PreviewScene;
  previousNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
  nextNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
}): PreviewNodeBounds | null {
  const previousNodeById = buildPreviewNodeMap(previousScene.nodes);
  const nextNodeById = buildPreviewNodeMap(nextScene.nodes);
  let dirtyBounds: PreviewNodeBounds | null = null;

  nextNodeById.forEach((node, id) => {
    const previousNode = previousNodeById.get(id);
    if (previousNode === node) return;
    const previousBounds = previousNodeBoundsById.get(id);
    const nextBounds = nextNodeBoundsById.get(id);
    if (previousBounds) dirtyBounds = mergeBounds(dirtyBounds, previousBounds);
    if (nextBounds) dirtyBounds = mergeBounds(dirtyBounds, nextBounds);
  });

  previousNodeById.forEach((_node, id) => {
    if (nextNodeById.has(id)) return;
    const previousBounds = previousNodeBoundsById.get(id);
    if (previousBounds) dirtyBounds = mergeBounds(dirtyBounds, previousBounds);
  });

  return dirtyBounds ? inflateBounds(dirtyBounds, 2) : null;
}

export function shouldDrawNodeForDirtyBounds({
  node,
  dirtyBounds,
  previousNodeBoundsById,
  nextNodeBoundsById,
}: {
  node: PreviewNode;
  dirtyBounds: PreviewNodeBounds;
  previousNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
  nextNodeBoundsById: ReadonlyMap<string, PreviewNodeBounds>;
}): boolean {
  const nextBounds = nextNodeBoundsById.get(node.id);
  const previousBounds = previousNodeBoundsById.get(node.id);
  return Boolean(
    (nextBounds && doBoundsIntersect(nextBounds, dirtyBounds)) ||
      (previousBounds && doBoundsIntersect(previousBounds, dirtyBounds))
  );
}

export function buildPreviewSceneDrawPlan({
  previewScene,
  pixelScale,
  drawState,
}: {
  previewScene: PreviewScene;
  pixelScale: number;
  drawState?: PreviewCanvasDrawState;
}): PreviewSceneDrawPlan {
  const nextNodeBoundsById = buildPreviewNodeBoundsMap(previewScene.nodes);
  const previousScene = drawState?.previousScene ?? null;
  const canDrawIncrementally =
    drawState &&
    previousScene &&
    previousScene.compositionId === previewScene.compositionId &&
    previousScene.logicalSize.width === previewScene.logicalSize.width &&
    previousScene.logicalSize.height === previewScene.logicalSize.height &&
    drawState.previousPixelScale === pixelScale;

  if (!canDrawIncrementally) {
    return { mode: "full", nextNodeBoundsById };
  }

  const dirtyBounds = getDirtyBounds({
    previousScene,
    nextScene: previewScene,
    previousNodeBoundsById: drawState.previousNodeBoundsById,
    nextNodeBoundsById,
  });
  if (!dirtyBounds) {
    return {
      mode: "skip",
      nextNodeBoundsById,
      skippedNodeCount: countPreviewSceneNodes(previewScene.nodes),
    };
  }

  return {
    mode: "dirty",
    dirtyBounds,
    previousNodeBoundsById: drawState.previousNodeBoundsById,
    nextNodeBoundsById,
  };
}
