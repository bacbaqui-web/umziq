import assert from "node:assert/strict";
import { createDirtySceneSnapshotFromPreviewScene } from "@/engines/canvas/helpers/dirtyStateHelpers";
import {
  applyPreviewNodeCache,
  applyPreviewNodeCacheFromScenes,
} from "@/engines/canvas/helpers/nodeCacheHelpers";
import { createDirtyState } from "@/engines/canvas/state/dirtyStateStore";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
import type { PreviewNode, PreviewScene } from "@/engines/playback-render";

const transform = {
  position: { x: 0, y: 0 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 0, y: 0 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

function layer(id: string, overrides: Partial<PreviewNode> = {}): PreviewNode {
  return {
    id,
    kind: "layer",
    sourceId: `${id}:source`,
    renderItemId: `${id}:render`,
    parentId: null,
    children: [],
    transform,
    opacity: 100,
    visible: true,
    order: 0,
    localFrame: 0,
    globalFrame: 0,
    logicalSize: { width: 100, height: 100 },
    drawableId: `${id}:drawable`,
    layerId: id,
    ...overrides,
  } as PreviewNode;
}

function composition(
  id: string,
  children: readonly PreviewNode[],
  overrides: Partial<PreviewNode> = {}
): PreviewNode {
  return {
    id,
    kind: "composition",
    sourceId: `${id}:source`,
    renderItemId: `${id}:render`,
    parentId: null,
    children,
    transform,
    opacity: 100,
    visible: true,
    order: 0,
    localFrame: 0,
    globalFrame: 0,
    logicalSize: { width: 200, height: 200 },
    targetCompId: id,
    ...overrides,
  } as PreviewNode;
}

function scene(nodes: readonly PreviewNode[]): PreviewScene {
  return {
    compositionId: "scene",
    globalFrame: 0,
    logicalSize: { width: 500, height: 500 },
    nodes,
  };
}

function snapshot(previewScene: PreviewScene) {
  return createDirtySceneSnapshotFromPreviewScene(previewScene);
}

const baseLayerA = layer("layer-a");
const baseLayerB = layer("layer-b", { order: 1 });
const baseScene = scene([baseLayerA, baseLayerB]);
const sameValueScene = scene([layer("layer-a"), layer("layer-b", { order: 1 })]);

const sameResult = applyPreviewNodeCacheFromScenes(baseScene, sameValueScene);
assert.equal(sameResult.scene, baseScene);
assert.equal(sameResult.scene?.nodes[0], baseLayerA);
assert.equal(sameResult.scene?.nodes[1], baseLayerB);
assert.equal(sameResult.stats.updatedNodeCount, 0);
assert.equal(sameResult.stats.reusedNodeCount, 2);

const transformDirtyScene = scene([
  layer("layer-a", {
    transform: { ...transform, position: { x: 30, y: 0 } },
  }),
  layer("layer-b", { order: 1 }),
]);
const transformDirtyResult = applyPreviewNodeCacheFromScenes(
  baseScene,
  transformDirtyScene
);
assert.notEqual(transformDirtyResult.scene, baseScene);
assert.notEqual(transformDirtyResult.scene?.nodes[0], baseLayerA);
assert.equal(transformDirtyResult.scene?.nodes[1], baseLayerB);
assert.equal(transformDirtyResult.stats.updatedNodeCount, 1);
assert.equal(transformDirtyResult.stats.reusedNodeCount, 1);

const opacityDirtyResult = applyPreviewNodeCacheFromScenes(
  baseScene,
  scene([layer("layer-a", { opacity: 40 }), layer("layer-b", { order: 1 })])
);
assert.notEqual(opacityDirtyResult.scene?.nodes[0], baseLayerA);
assert.equal(opacityDirtyResult.scene?.nodes[1], baseLayerB);

const child = layer("child", { parentId: "parent" });
const sibling = layer("sibling", { order: 1 });
const parent = composition("parent", [child]);
const hierarchyBaseScene = scene([parent, sibling]);
const hierarchyNextScene = scene([composition("parent", []), sibling]);
const hierarchyResult = applyPreviewNodeCacheFromScenes(
  hierarchyBaseScene,
  hierarchyNextScene
);
assert.notEqual(hierarchyResult.scene?.nodes[0], parent);
assert.equal(hierarchyResult.scene?.nodes[1], sibling);

const explicitCleanResult = applyPreviewNodeCache({
  previousScene: baseScene,
  nextScene: sameValueScene,
  dirtyNodes: [],
});
assert.equal(explicitCleanResult.scene, baseScene);
assert.equal(explicitCleanResult.scene?.nodes[0], baseLayerA);

const compositionDirtyResult = applyPreviewNodeCache({
  previousScene: hierarchyBaseScene,
  nextScene: hierarchyBaseScene,
  dirtyNodes: [
    {
      id: "parent",
      kind: "composition",
      dirtyKinds: ["composition"],
    },
  ],
});
assert.notEqual(compositionDirtyResult.scene?.nodes[0], parent);
assert.equal(compositionDirtyResult.scene?.nodes[0]?.children[0], child);

const dirty = createDirtyState(snapshot(baseScene));
const dirtySnapshot = dirty.updateDirtyState(snapshot(transformDirtyScene));
assert.equal(dirtySnapshot.summary.dirtyNodeCount, 1);
assert.equal(dirtySnapshot.summary.transform, 1);

const metrics = createRuntimeMetricsResource();
metrics.saveTaskBaseline();
const cachedResult = applyPreviewNodeCache({
  previousScene: baseScene,
  nextScene: transformDirtyScene,
  dirtyNodes: dirtySnapshot.dirtyNodes,
});
metrics.increment("dirtyNode", dirtySnapshot.summary.dirtyNodeCount);
metrics.increment("previewNodeUpdated", cachedResult.stats.updatedNodeCount);
metrics.increment("previewNodeReused", cachedResult.stats.reusedNodeCount);

assert.equal(metrics.getGlobalSnapshot().dirtyNode, 1);
assert.equal(metrics.getGlobalSnapshot().previewNodeUpdated, 1);
assert.equal(metrics.getGlobalSnapshot().previewNodeReused, 1);

const baselineComparison = metrics.compareTaskBaseline();
assert.equal(
  baselineComparison.differences.find(
    (difference) => difference.counter === "previewNodeUpdated"
  )?.difference,
  1
);
assert.equal(
  baselineComparison.differences.find(
    (difference) => difference.counter === "previewNodeReused"
  )?.difference,
  1
);

console.log("Node cache verification passed");
