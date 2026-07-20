import assert from "node:assert/strict";
import { createDirtySceneSnapshotFromPreviewScene } from "@/engines/canvas/helpers/dirtyStateHelpers";
import { createDirtyState } from "@/engines/canvas/state/dirtyStateStore";
import type { DirtyKind } from "@/engines/canvas/models/dirtyStateModel";
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

function scene(nodes: readonly PreviewNode[], overrides: Partial<PreviewScene> = {}) {
  return {
    compositionId: "scene",
    globalFrame: 0,
    logicalSize: { width: 500, height: 500 },
    nodes,
    ...overrides,
  };
}

function snapshot(
  previewScene: PreviewScene,
  sourceFingerprintBySourceId?: ReadonlyMap<string, string | null>
) {
  return createDirtySceneSnapshotFromPreviewScene(previewScene, {
    sourceFingerprintBySourceId,
  });
}

function dirtyKindsFor(sceneA: PreviewScene, sceneB: PreviewScene, nodeId: string) {
  const dirty = createDirtyState(snapshot(sceneA));
  const result = dirty.updateDirtyState(snapshot(sceneB));
  return result.dirtyNodes.find((node) => node.id === nodeId)?.dirtyKinds ?? [];
}

function assertKinds(
  actual: readonly DirtyKind[],
  expected: readonly DirtyKind[]
) {
  assert.deepEqual([...actual].sort(), [...expected].sort());
}

const baseLayer = layer("layer-a");
const baseScene = scene([baseLayer]);
const state = createDirtyState(snapshot(baseScene));
assert.equal(state.isDirty(), false);
assert.equal(state.getDirtySummary().dirtyNodeCount, 0);
assert.equal(state.updateDirtyState(snapshot(baseScene)).dirtyNodes.length, 0);
assert.equal(state.isDirty(), false);

assertKinds(
  dirtyKindsFor(
    baseScene,
    scene([
      layer("layer-a", {
        transform: { ...transform, position: { x: 10, y: 0 } },
      }),
    ]),
    "layer-a"
  ),
  ["transform"]
);

assertKinds(
  dirtyKindsFor(baseScene, scene([layer("layer-a", { opacity: 50 })]), "layer-a"),
  ["opacity"]
);

assertKinds(
  dirtyKindsFor(
    baseScene,
    scene([layer("layer-a", { visible: false })]),
    "layer-a"
  ),
  ["visibility"]
);

assertKinds(
  dirtyKindsFor(
    baseScene,
    scene([layer("layer-a", { localFrame: 1, globalFrame: 1 })], {
      globalFrame: 1,
    }),
    "layer-a"
  ),
  ["frame"]
);

assertKinds(
  dirtyKindsFor(
    baseScene,
    scene([layer("layer-a", { logicalSize: { width: 150, height: 100 } })]),
    "layer-a"
  ),
  ["logicalSize"]
);

assertKinds(
  dirtyKindsFor(
    baseScene,
    scene([layer("layer-a", { sourceId: "new-source" })]),
    "layer-a"
  ),
  ["source"]
);

const sourceDirty = createDirtyState(
  snapshot(baseScene, new Map([["layer-a:source", "fingerprint-a"]]))
);
const sourceDirtyResult = sourceDirty.updateDirtyState(
  snapshot(baseScene, new Map([["layer-a:source", "fingerprint-b"]]))
);
assertKinds(
  sourceDirtyResult.dirtyNodes.find((node) => node.id === "layer-a")?.dirtyKinds ??
    [],
  ["source"]
);

const orderedA = layer("a", { order: 0 });
const orderedB = layer("b", { order: 1 });
const orderedBaseScene = scene([orderedA, orderedB]);
const orderedNextScene = scene([
  layer("b", { order: 0 }),
  layer("a", { order: 1 }),
]);
const orderedState = createDirtyState(snapshot(orderedBaseScene));
const orderedResult = orderedState.updateDirtyState(snapshot(orderedNextScene));
assertKinds(
  orderedResult.dirtyNodes.find((node) => node.id === "scene")?.dirtyKinds ?? [],
  ["order"]
);
assert.equal(orderedResult.summary.order, 3);

const child = layer("child", { parentId: "parent" });
const compBase = composition("parent", [child]);
const hierarchyState = createDirtyState(snapshot(scene([compBase])));
const hierarchyResult = hierarchyState.updateDirtyState(
  snapshot(scene([composition("parent", [])]))
);
assertKinds(
  hierarchyResult.dirtyNodes.find((node) => node.id === "parent")?.dirtyKinds ??
    [],
  ["composition", "hierarchy"]
);
assert.equal(hierarchyResult.summary.composition, 1);
assert.equal(hierarchyResult.summary.hierarchy, 1);

state.updateDirtyState(
  snapshot(
    scene([
      layer("layer-a", {
        transform: { ...transform, position: { x: 10, y: 0 } },
        opacity: 25,
      }),
    ])
  )
);
assert.equal(state.isDirty(), true);
assert.equal(state.getDirtySummary().dirtyNodeCount, 1);
assert.equal(state.getDirtySummary().transform, 1);
assert.equal(state.getDirtySummary().opacity, 1);
assert.equal(state.getDirtyNodes()[0]?.id, "layer-a");

state.clearDirtyState();
assert.equal(state.isDirty(), false);
assert.equal(state.getDirtySummary().dirtyNodeCount, 0);
assert.notEqual(state.getSnapshot().current, null);

state.resetDirtyState();
assert.equal(state.isDirty(), false);
assert.equal(state.getSnapshot().current, null);

console.log("Dirty cache verification passed");
