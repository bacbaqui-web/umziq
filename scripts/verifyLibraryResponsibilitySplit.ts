import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  calculateLibraryDropPosition,
  canDropLibraryNode,
} from "@/engines/library/helpers/libraryDropTargetHelpers";
import {
  findLibraryKeyboardMoveTarget,
  findLibraryNode,
  flattenLibraryNodes,
} from "@/engines/library/helpers/libraryTreeProjectionHelpers";
import type { LibraryNodeViewModel } from "@/engines/library/models/libraryModel";

const engine = readFileSync(
  "src/engines/library/useLayerDocumentLibraryEngine.ts",
  "utf8"
);
const composer = readFileSync(
  "src/engines/library/composers/useLayerDocumentLibraryComposer.ts",
  "utf8"
);
const panel = readFileSync(
  "src/features/library/components/LibraryPanel.tsx",
  "utf8"
);
const tree = readFileSync(
  "src/features/library/components/LibraryTree.tsx",
  "utf8"
);
const node = readFileSync(
  "src/features/library/components/LibraryNode.tsx",
  "utf8"
);

assert.match(engine, /return useLayerDocumentLibraryComposer\(options\)/);
assert.doesNotMatch(
  engine,
  /useState|useEffect|useRef|prepareImport|confirmImport|setDropTarget/,
  "Library Engine facade는 state, lifecycle과 제품 계산을 소유하지 않습니다."
);
assert.ok(
  engine.split("\n").length <= 24,
  "Library Engine facade는 얇은 공개 경계를 유지합니다."
);

const controllerFiles = readdirSync("src/engines/library/controllers")
  .filter((file) => file.endsWith(".ts"));
for (const file of controllerFiles) {
  const source = readFileSync(
    `src/engines/library/controllers/${file}`,
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /@\/engines\/library\/(?:controllers|composers)\//,
    `${file}: Controller는 다른 Controller나 Composer를 직접 참조하지 않습니다.`
  );
  assert.doesNotMatch(
    source,
    /@\/features\//,
    `${file}: Controller는 Feature UI를 참조하지 않습니다.`
  );
}

const helperFiles = readdirSync("src/engines/library/helpers")
  .filter((file) => file.endsWith(".ts"));
for (const file of helperFiles) {
  const source = readFileSync(
    `src/engines/library/helpers/${file}`,
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /from "react"|useState|useEffect|useRef|\bFileSystemHandle\b|\bMediaRecorder\b|\bAudioContext\b/,
    `${file}: Helper는 React state, Handle과 Runtime resource를 소유하지 않습니다.`
  );
}

assert.doesNotMatch(
  composer,
  /\bawait\b|\bfor\s*\(|\bwhile\s*\(|\bswitch\s*\(/,
  "Composer는 Controller 실행 순서나 조건을 소유하지 않습니다."
);
for (const controllerName of [
  "useLibraryPsdImportController",
  "useLibraryAudioImportController",
  "useLibraryRecordingControllerAdapter",
  "useLibraryAssetCopyController",
  "useLibraryDragController",
  "useLibraryHoverPreviewController",
  "createLibraryNodeCommandController",
]) {
  assert.match(composer, new RegExp(controllerName));
}
assert.match(composer, /const viewProps: LibraryViewProps/);

for (const componentName of [
  "LibraryProjectHeader",
  "LibraryTree",
  "LibraryRecordingReview",
  "LibraryAssetCopyDialog",
  "LibraryHoverPreviewCard",
]) {
  assert.match(panel, new RegExp(componentName));
}
assert.match(
  readFileSync(
    "src/features/library/components/LibraryProjectHeader.tsx",
    "utf8"
  ),
  /LibraryAudioMenu/
);
assert.match(tree, /<LibraryNode/);
assert.match(node, /<LibraryNodeIdentity/);
assert.match(node, /<LibraryNodeActions/);
assert.match(node, /<LibraryTreeConnector/);

const assetCopyController = readFileSync(
  "src/engines/library/controllers/useLibraryAssetCopyController.ts",
  "utf8"
);
const audioImportController = readFileSync(
  "src/engines/library/controllers/useLibraryAudioImportController.ts",
  "utf8"
);
const dragController = readFileSync(
  "src/engines/library/controllers/useLibraryDragController.ts",
  "utf8"
);
const hoverController = readFileSync(
  "src/engines/library/controllers/useLibraryHoverPreviewController.ts",
  "utf8"
);
assert.match(assetCopyController, /resolverRef\.current\?\.\(null\)/);
assert.match(audioImportController, /preparedImports\.forEach\(options\.audioImport\.cancel\)/);
assert.match(dragController, /options\.projectIdentity/);
assert.match(hoverController, /pendingRef\.current = null/);

function libraryNode(
  id: string,
  options: {
    type?: LibraryNodeViewModel["type"];
    entityKind?: LibraryNodeViewModel["entityKind"];
    depth?: number;
    children?: readonly LibraryNodeViewModel[];
  } = {}
): LibraryNodeViewModel {
  return {
    id,
    type: options.type ?? "sub",
    entityKind: options.entityKind ?? "layer",
    contentKind: "visual",
    audioProvenance: null,
    playing: false,
    muted: false,
    sourceId: `source:${id}`,
    layerDocumentId: id,
    name: id,
    depth: options.depth ?? 1,
    selected: false,
    visible: true,
    locked: false,
    sourceSyncStatus: "normal",
    canRefresh: false,
    canDelete: true,
    canReorder: true,
    preview: null,
    children: options.children ?? [],
  };
}

const childA = libraryNode("child-a", { depth: 2 });
const childB = libraryNode("child-b", { depth: 2 });
const group = libraryNode("group", {
  entityKind: "composition",
  children: [childA, childB],
});
const sibling = libraryNode("sibling");
const nodes = [group, sibling];

assert.deepEqual(
  flattenLibraryNodes(nodes).map((item) => item.id),
  ["group", "child-a", "child-b", "sibling"]
);
assert.equal(findLibraryNode(nodes, "child-b"), childB);
assert.equal(
  canDropLibraryNode({
    nodes,
    draggedNodeId: "child-a",
    targetNodeId: "group",
  }),
  true
);
assert.equal(
  canDropLibraryNode({
    nodes,
    draggedNodeId: "group",
    targetNodeId: "group",
  }),
  false
);
assert.equal(
  calculateLibraryDropPosition({
    target: group,
    pointerY: 50,
    nodeTop: 0,
    nodeHeight: 100,
    current: null,
  }),
  "inside"
);
assert.equal(
  calculateLibraryDropPosition({
    target: group,
    pointerY: 25,
    nodeTop: 0,
    nodeHeight: 100,
    current: { targetId: "group", position: "inside" },
  }),
  "inside",
  "현재 inside target은 경계 근처에서 hysteresis를 유지합니다."
);

const parentById: Record<string, string> = {
  "child-a": "group",
  "child-b": "group",
};
const orderById: Record<string, number> = {
  "child-a": 0,
  "child-b": 1,
};
assert.equal(
  findLibraryKeyboardMoveTarget({
    nodes,
    nodeId: "child-a",
    direction: 1,
    readParentId: (id) => parentById[id] ?? null,
    readOrder: (id) => orderById[id] ?? 0,
  })?.id,
  "child-b"
);

console.log("Library responsibility split verification passed");
