import assert from "node:assert/strict";
import type { Composition } from "@/models";
import type { PsdSourceFileHandle } from "@/engines/project";
import {
  filesToPsdImportSources,
  getPsdFilePicker,
  handlesToPsdImportSources,
  isPsdPickerCancellation,
  openPsdSourcesFromPicker,
} from "@/engines/psd-tree/adapters/psdFilePickerAdapter";
import {
  getPsdTreeDropPosition,
  isValidPsdTreeDrop,
  reorderPsdTreeIds,
} from "@/engines/psd-tree/helpers/psdTreeDropHelpers";
import {
  buildPsdRefreshSummaryViewModel,
  buildPsdTreeViewModel,
} from "@/engines/psd-tree/helpers/psdTreeViewModelHelpers";
import { movePsdImportPlanNode } from "@/engines/psd-tree/helpers/psdImportPlanTreeHelpers";
import type { PsdImportPlanNode } from "@/engines/project";

const disabledProperties = {
  position: false,
  scale: false,
  rotation: false,
  opacity: false,
};

function createComposition(
  id: string,
  type: Composition["type"],
  children: Composition[] = []
): Composition {
  return {
    id,
    name: id,
    type,
    layers: [],
    children,
    position: { x: 0, y: 0 },
    positionKeyframes: [],
    transformOffset: { x: 0, y: 0 },
    anchor: { x: 0, y: 0 },
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: true,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
    modifiers: [],
  };
}

assert.equal(getPsdTreeDropPosition(10, 10, 20), "before");
assert.equal(getPsdTreeDropPosition(29, 10, 20), "after");
assert.equal(getPsdTreeDropPosition(20, 10, 20), "after");
assert.equal(getPsdTreeDropPosition(20, 10, 0), null);
assert.equal(isValidPsdTreeDrop("main-a", "main-a"), false);
assert.equal(isValidPsdTreeDrop(null, "main-a"), false);
assert.equal(isValidPsdTreeDrop("main-a", null), false);
assert.equal(isValidPsdTreeDrop("main-a", "main-b"), true);

const ids = ["main-a", "main-b", "main-c"];
assert.deepEqual(reorderPsdTreeIds(ids, "main-c", "main-a", "before"), [
  "main-c",
  "main-a",
  "main-b",
]);
assert.deepEqual(reorderPsdTreeIds(ids, "main-a", "main-b", "after"), [
  "main-b",
  "main-a",
  "main-c",
]);
assert.equal(reorderPsdTreeIds(ids, "missing", "main-a", "before"), ids);
assert.equal(reorderPsdTreeIds(ids, "main-a", "main-a", "after"), ids);

const subNested = createComposition("sub-nested", "sub");
subNested.sourceSyncStatus = "updated";
const sub = createComposition("sub", "sub", [subNested]);
sub.sourceSyncStatus = "new";
const mainA = createComposition("main-a", "main", [sub]);
const mainB = createComposition("main-b", "main");
mainB.sourceSyncStatus = "missing";
const master = createComposition("master", "master");
const tree = buildPsdTreeViewModel([master, mainA, mainB], "sub-nested");

assert.deepEqual(tree.map((node) => node.id), ["master", "main-a", "main-b"]);
assert.deepEqual(
  tree.map(({ canRefresh, canDelete, canReorder }) => ({
    canRefresh,
    canDelete,
    canReorder,
  })),
  [
    { canRefresh: false, canDelete: false, canReorder: false },
    { canRefresh: true, canDelete: true, canReorder: true },
    { canRefresh: true, canDelete: true, canReorder: true },
  ]
);
assert.equal(tree[1].children[0].depth, 1);
assert.equal(tree[1].children[0].sourceSyncStatus, "new");
assert.equal(tree[1].children[0].children[0].depth, 2);
assert.equal(tree[1].children[0].children[0].selected, true);
assert.equal(tree[1].children[0].children[0].sourceSyncStatus, "updated");
assert.equal(tree[2].sourceSyncStatus, "missing");
assert.equal(buildPsdTreeViewModel([], null).length, 0);

const psdFile = new File(["psd"], "scene.PSD");
const textFile = new File(["text"], "notes.txt");
assert.deepEqual(filesToPsdImportSources([]), []);
assert.deepEqual(filesToPsdImportSources([textFile]), []);
assert.deepEqual(filesToPsdImportSources([psdFile]), [
  { file: psdFile, fileHandle: null },
]);

const handle: PsdSourceFileHandle = {
  kind: "file",
  name: psdFile.name,
  getFile: async () => psdFile,
};
assert.deepEqual(await handlesToPsdImportSources([handle]), [
  { file: psdFile, fileHandle: handle },
]);
assert.equal(getPsdFilePicker(), undefined);
assert.equal(isPsdPickerCancellation({ name: "AbortError" }), true);
assert.equal(isPsdPickerCancellation(new Error("permission denied")), false);

let pickerMultiple: boolean | undefined;
const picked = await openPsdSourcesFromPicker(async (options) => {
  pickerMultiple = options?.multiple;
  return [handle];
}, true);
assert.equal(pickerMultiple, true);
assert.deepEqual(picked, [{ file: psdFile, fileHandle: handle }]);

await assert.rejects(
  handlesToPsdImportSources([
    {
      ...handle,
      getFile: async () => {
        throw new Error("read failed");
      },
    },
  ]),
  /read failed/
);

function planNode(
  id: string,
  kind: PsdImportPlanNode["kind"],
  children: PsdImportPlanNode[] = [],
  originalName = id
): PsdImportPlanNode {
  return { id, sourceKey: id, kind, originalName, displayName: originalName, autoRenamed: false, children };
}

const previewTree = [
  planNode("group-a", "group", [planNode("layer-a", "layer")]),
  planNode("group-b", "group", [planNode("layer-b", "layer", [], "same")]),
  planNode("layer-root", "layer", [], "same"),
];
const movedInside = movePsdImportPlanNode(previewTree, "layer-root", "group-b", "inside");
assert.deepEqual(movedInside.map((node) => node.id), ["group-a", "group-b"]);
assert.deepEqual(movedInside[1]?.children.map((node) => node.id), ["layer-b", "layer-root"]);
assert.deepEqual(movedInside[1]?.children.map((node) => node.displayName), ["same_1", "same_2"]);
assert.equal(movedInside[1]?.children.every((node) => node.autoRenamed), true);

const reordered = movePsdImportPlanNode(movedInside, "group-b", "group-a", "before");
assert.deepEqual(reordered.map((node) => node.id), ["group-b", "group-a"]);
const preventedCycle = movePsdImportPlanNode(previewTree, "group-a", "layer-a", "inside");
assert.deepEqual(preventedCycle, previewTree);
const movedToRoot = movePsdImportPlanNode(movedInside, "layer-b", null, "inside");
assert.equal(movedToRoot.at(-1)?.id, "layer-b");

const summaryViewModel = buildPsdRefreshSummaryViewModel({
  compositionId: "main-a",
  compositionName: "character.psd",
  newGroups: 2,
  newLayers: 3,
  updated: 4,
  missing: 1,
  deletePending: 2,
  problematic: 3,
});
assert.equal(summaryViewModel.hasChanges, true);
assert.deepEqual(summaryViewModel.items.map((item) => item.label), [
  "새 그룹",
  "새 레이어",
  "업데이트",
  "누락",
  "삭제 대기",
  "문제",
]);
assert.equal(summaryViewModel.items.at(-1)?.value, 3);
assert.equal(
  buildPsdRefreshSummaryViewModel({
    compositionId: "main-a",
    compositionName: "character.psd",
    newGroups: 0,
    newLayers: 0,
    updated: 0,
    missing: 0,
    deletePending: 0,
    problematic: 0,
  }).hasChanges,
  false
);

console.log("PSD Tree helper verification passed");
