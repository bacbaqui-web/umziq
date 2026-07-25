import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  buildCreateLayerDocumentTransaction,
  buildDeleteLayerDocumentTransaction,
  buildDuplicateLayerDocumentTransaction,
  buildMoveGroupLayerDocumentTransaction,
  buildReplaceLayerDocumentSourceTransaction,
  buildSetLayerDocumentNameTransaction,
  buildUpdateLayerDocumentCommonTransaction,
  buildUpdateLayerDocumentDomainTransaction,
  findNonPlainDataPath,
  validateLayerDocumentProject,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentCommonUpdate,
  type LayerDocumentProject,
  type LayerDocumentTransaction,
  type LayerDocumentTransactionResult,
  type LayerSourceReference,
  type SourceRegistryRecord,
} from "@/models";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertLayerDiffContract(
  transaction: LayerDocumentTransaction
) {
  const beforeLayers =
    transaction.before.payload.layerDocumentsById;
  const afterLayers =
    transaction.after.payload.layerDocumentsById;
  const allIds = Array.from(
    new Set([...Object.keys(beforeLayers), ...Object.keys(afterLayers)])
  ).sort((left, right) => left.localeCompare(right));
  const changedIds = allIds.filter(
    (layerDocumentId) =>
      !beforeLayers[layerDocumentId] ||
      !afterLayers[layerDocumentId] ||
      !isDeepStrictEqual(
        afterLayers[layerDocumentId],
        beforeLayers[layerDocumentId]
      )
  );
  assert.deepEqual(
    transaction.historyEntry.affectedLayerDocumentIds,
    changedIds
  );
  assert.deepEqual(
    transaction.historyEntry.affectedLayerDocumentIds,
    [...new Set(
      transaction.historyEntry.affectedLayerDocumentIds
    )].sort((left, right) => left.localeCompare(right))
  );

  const createdIds = allIds.filter(
    (layerDocumentId) =>
      !beforeLayers[layerDocumentId] && afterLayers[layerDocumentId]
  );
  const deletedIds = allIds.filter(
    (layerDocumentId) =>
      beforeLayers[layerDocumentId] && !afterLayers[layerDocumentId]
  );
  assert.deepEqual(
    [...transaction.createdLayerDocumentIds].sort(),
    createdIds
  );
  assert.deepEqual(
    [...transaction.deletedLayerDocumentIds].sort(),
    deletedIds
  );
  createdIds.forEach((layerDocumentId) => {
    assert.equal(afterLayers[layerDocumentId].revision, 0);
  });
  changedIds
    .filter(
      (layerDocumentId) =>
        beforeLayers[layerDocumentId] && afterLayers[layerDocumentId]
    )
    .forEach((layerDocumentId) => {
      assert.equal(
        afterLayers[layerDocumentId].revision,
        beforeLayers[layerDocumentId].revision + 1
      );
    });
  assert.deepEqual(
    transaction.after.payload.sourceRegistry,
    transaction.before.payload.sourceRegistry
  );
}

function common(
  id: string,
  parentLayerDocumentId: string | null,
  order: number,
  source: LayerSourceReference | null = null
): LayerDocumentCommon {
  return {
    source,
    transform: {
      position: { x: order * 10, y: order * 20 },
      transformOffset: { x: 1, y: 2 },
      anchor: { x: 50, y: 60 },
      scale: { x: 100, y: 100 },
      scaleLinked: true,
      rotation: order,
      opacity: 100,
    },
    placement: {
      parentLayerDocumentId,
      order,
      startFrame: order * 5,
      durationFrames: 90,
      sourceOffsetFrames: order,
      visible: true,
      alias: null,
    },
    animation: {
      positionKeyframes: [{
        frame: 0,
        value: { x: order * 10, y: order * 20 },
      }],
      scaleKeyframes: [{ frame: 0, value: { x: 100, y: 100 } }],
      rotationKeyframes: [{ frame: 0, value: order }],
      opacityKeyframes: [{ frame: 0, value: 100 }],
      enabledProperties: {
        position: true,
        scale: false,
        rotation: false,
        opacity: false,
      },
    },
    effects: [{
      effectId: `effect-${id}`,
      type: "fixture-effect",
      enabled: true,
      parameters: { id, amount: order + 1 },
    }],
    modifiers: [{
      modifierId: `modifier-${id}`,
      type: "wiggle",
      enabled: true,
      frequency: order + 1,
      amount: order + 2,
    }],
  };
}

function sourceRegistry(): Record<string, SourceRegistryRecord> {
  const refresh = {
    status: "normal" as const,
    reconnectHint: {
      fileName: "fixture.psd",
      path: "/fixture.psd",
    },
  };
  return {
    "source-document": {
      sourceId: "source-document",
      kind: "psd-document",
      displayName: "fixture.psd",
      path: "/fixture.psd",
      fingerprint: "document-fingerprint",
      version: 1,
      availability: "available",
      refresh,
      data: {
        fileName: "fixture.psd",
        importSettings: {
          compositionName: "Fixture",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "source-node-a": {
      sourceId: "source-node-a",
      kind: "psd-node",
      displayName: "Node A",
      path: "fixture.psd/Node A",
      fingerprint: "node-a-fingerprint",
      version: 1,
      availability: "available",
      refresh,
      data: {
        documentSourceId: "source-document",
        sourceKey: "layer:a",
        sourcePath: "Node A",
        nativeVisible: null,
      },
    },
    "source-node-b": {
      sourceId: "source-node-b",
      kind: "psd-node",
      displayName: "Node B",
      path: "fixture.psd/Node B",
      fingerprint: "node-b-fingerprint",
      version: 1,
      availability: "available",
      refresh,
      data: {
        documentSourceId: "source-document",
        sourceKey: "layer:b",
        sourcePath: "Node B",
        nativeVisible: true,
      },
    },
  };
}

function createLayers(): Record<string, LayerDocument> {
  return {
    root: {
      layerDocumentId: "root",
      name: "Project Root",
      revision: 0,
      type: "group",
      common: common("root", null, 0),
      data: {
        role: "project-root",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 180,
      },
    },
    "group-a": {
      layerDocumentId: "group-a",
      name: "Group A",
      revision: 2,
      type: "group",
      common: common("group-a", "root", 0, {
        sourceId: "source-document",
      }),
      data: {
        role: "composition",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 120,
      },
    },
    "text-a": {
      layerDocumentId: "text-a",
      name: "Text A",
      revision: 3,
      type: "text",
      common: common("text-a", "group-a", 0),
      data: {
        text: "Alpha",
        style: {
          fontFamily: "Fixture Sans",
          fontSize: 48,
          color: "#ffffff",
        },
      },
    },
    "group-nested": {
      layerDocumentId: "group-nested",
      name: "Nested Group",
      revision: 4,
      type: "group",
      common: common("group-nested", "group-a", 1),
      data: {
        role: "composition",
        width: 500,
        height: 500,
        frameRate: 24,
        durationFrames: 60,
      },
    },
    "drawing-nested": {
      layerDocumentId: "drawing-nested",
      name: "Nested Drawing",
      revision: 5,
      type: "drawing",
      common: common("drawing-nested", "group-nested", 0),
      data: {
        documentVersion: 1,
        elements: [{
          kind: "stroke",
          points: [1, 2, 3],
        }],
      },
    },
    "psd-nested": {
      layerDocumentId: "psd-nested",
      name: "Nested PSD",
      revision: 6,
      type: "psd",
      common: common("psd-nested", "group-nested", 1, {
        sourceId: "source-node-a",
      }),
      data: {},
    },
    "group-b": {
      layerDocumentId: "group-b",
      name: "Group B",
      revision: 7,
      type: "group",
      common: common("group-b", "root", 1),
      data: {
        role: "composition",
        width: 720,
        height: 1280,
        frameRate: 30,
        durationFrames: 90,
      },
    },
    "psd-b": {
      layerDocumentId: "psd-b",
      name: "PSD B",
      revision: 8,
      type: "psd",
      common: common("psd-b", "group-b", 0, {
        sourceId: "source-node-a",
      }),
      data: {},
    },
    "text-b": {
      layerDocumentId: "text-b",
      name: "Text B",
      revision: 9,
      type: "text",
      common: common("text-b", "group-b", 1),
      data: {
        text: "Beta",
        style: {
          fontFamily: "Fixture Serif",
          fontSize: 36,
          color: "#00ffff",
        },
      },
    },
  };
}

function createProject(): LayerDocumentProject {
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "transaction-project",
      name: "Transaction Fixture",
    },
    payload: {
      layerDocumentsById: createLayers(),
      sourceRegistry: {
        sourcesById: sourceRegistry(),
      },
    },
  };
}

function expectSuccess(
  result: LayerDocumentTransactionResult
): LayerDocumentTransaction {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error(`Expected transaction success: ${result.error.message}`);
  }
  assert.deepEqual(validateLayerDocumentProject(result.transaction.before), []);
  assert.deepEqual(validateLayerDocumentProject(result.transaction.after), []);
  assert.equal(findNonPlainDataPath(result.transaction), null);
  assert.ok(result.transaction.historyEntry);
  assert.equal(
    (result.transaction as unknown as { historyEntries?: unknown })
      .historyEntries,
    undefined
  );
  assertLayerDiffContract(result.transaction);
  return result.transaction;
}

function expectFailure(
  result: LayerDocumentTransactionResult,
  expectedCode: string,
  expectedProject: LayerDocumentProject,
  snapshot: LayerDocumentProject
) {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected transaction failure");
  assert.equal(result.error.code, expectedCode);
  assert.equal(result.project, expectedProject);
  assert.equal(
    (result as unknown as { transaction?: unknown }).transaction,
    undefined
  );
  assert.deepEqual(expectedProject, snapshot);
}

function siblingIds(
  project: LayerDocumentProject,
  parentLayerDocumentId: string
) {
  return Object.values(project.payload.layerDocumentsById)
    .filter(
      (layer) =>
        layer.common.placement.parentLayerDocumentId ===
        parentLayerDocumentId
    )
    .sort(
      (left, right) =>
        left.common.placement.order - right.common.placement.order
    )
    .map((layer) => layer.layerDocumentId);
}

const base = createProject();
assert.deepEqual(validateLayerDocumentProject(base), []);

const createInput = createProject();
const createSnapshot = clone(createInput);
const shapeLayer: LayerDocument = {
  layerDocumentId: "shape-new",
  name: "New Shape",
  revision: 42,
  type: "shape",
  common: common("shape-new", "group-b", 1),
  data: {
    documentVersion: 1,
    shapes: [{ kind: "rectangle", width: 100, height: 50 }],
  },
};
const created = expectSuccess(
  buildCreateLayerDocumentTransaction(createInput, {
    layer: shapeLayer,
  })
);
assert.deepEqual(createInput, createSnapshot);
assert.deepEqual(
  siblingIds(created.after, "group-b"),
  ["psd-b", "shape-new", "text-b"]
);
assert.deepEqual(created.createdLayerDocumentIds, ["shape-new"]);
assert.equal(
  created.after.payload.layerDocumentsById["shape-new"].revision,
  0
);
assert.equal(
  created.after.payload.layerDocumentsById["text-b"].revision,
  createInput.payload.layerDocumentsById["text-b"].revision + 1
);
assert.deepEqual(
  created.historyEntry.affectedLayerDocumentIds,
  ["shape-new", "text-b"]
);
assert.deepEqual(created.selectionChange, {
  kind: "select",
  layerDocumentId: "shape-new",
});
assert.notStrictEqual(
  created.after.payload.layerDocumentsById["shape-new"],
  shapeLayer
);

const duplicateInput = createProject();
const duplicateSnapshot = clone(duplicateInput);
const duplicated = expectSuccess(
  buildDuplicateLayerDocumentTransaction(duplicateInput, {
    layerDocumentId: "psd-b",
    newLayerDocumentId: "psd-b-copy",
  })
);
assert.deepEqual(duplicateInput, duplicateSnapshot);
assert.deepEqual(
  siblingIds(duplicated.after, "group-b"),
  ["psd-b-copy", "psd-b", "text-b"]
);
const originalPsd =
  duplicated.after.payload.layerDocumentsById["psd-b"];
const duplicatePsd =
  duplicated.after.payload.layerDocumentsById["psd-b-copy"];
assert.equal(originalPsd.type, "psd");
assert.equal(duplicatePsd.type, "psd");
assert.equal(
  duplicatePsd.name,
  `${originalPsd.name}_2`
);
assert.equal(duplicatePsd.revision, 0);
assert.equal(
  originalPsd.revision,
  duplicateInput.payload.layerDocumentsById["psd-b"].revision + 1
);
assert.equal(
  duplicated.after.payload.layerDocumentsById["text-b"].revision,
  duplicateInput.payload.layerDocumentsById["text-b"].revision + 1
);
assert.deepEqual(
  duplicated.historyEntry.affectedLayerDocumentIds,
  ["psd-b", "psd-b-copy", "text-b"]
);
assert.equal(
  duplicatePsd.common.source?.sourceId,
  originalPsd.common.source?.sourceId
);
assert.notStrictEqual(duplicatePsd.common, originalPsd.common);
assert.notStrictEqual(
  duplicatePsd.common.transform,
  originalPsd.common.transform
);
assert.notStrictEqual(
  duplicatePsd.common.animation,
  originalPsd.common.animation
);
assert.notStrictEqual(
  duplicatePsd.common.effects,
  originalPsd.common.effects
);
assert.notStrictEqual(
  duplicatePsd.common.effects[0].parameters,
  originalPsd.common.effects[0].parameters
);
duplicatePsd.common.transform.position.x = 999;
duplicatePsd.common.effects[0].parameters.amount = 999;
assert.notEqual(originalPsd.common.transform.position.x, 999);
assert.notEqual(originalPsd.common.effects[0].parameters.amount, 999);
assert.notEqual(
  duplicateInput.payload.layerDocumentsById["psd-b"]
    .common.transform.position.x,
  999
);

const groupDuplicateInput = createProject();
const groupDuplicateSnapshot = clone(groupDuplicateInput);
const groupDuplicated = expectSuccess(
  buildDuplicateLayerDocumentTransaction(groupDuplicateInput, {
    layerDocumentId: "group-a",
    newLayerDocumentId: "group-a-copy",
  })
);
assert.deepEqual(groupDuplicateInput, groupDuplicateSnapshot);
assert.deepEqual(
  siblingIds(groupDuplicated.after, "root"),
  ["group-a-copy", "group-a", "group-b"]
);
assert.deepEqual(groupDuplicated.createdLayerDocumentIds, [
  "group-a-copy",
  "group-a-copy:text-a",
  "group-a-copy:group-nested",
  "group-a-copy:drawing-nested",
  "group-a-copy:psd-nested",
]);
assert.equal(
  groupDuplicated.createdLayerDocumentIds.every(
    (layerDocumentId) =>
      groupDuplicated.after.payload.layerDocumentsById[layerDocumentId]
        .revision === 0
  ),
  true
);
assert.equal(
  groupDuplicated.after.payload.layerDocumentsById["group-a"].revision,
  groupDuplicateInput.payload.layerDocumentsById["group-a"].revision + 1
);
assert.equal(
  groupDuplicated.after.payload.layerDocumentsById["group-b"].revision,
  groupDuplicateInput.payload.layerDocumentsById["group-b"].revision + 1
);
assert.deepEqual(
  siblingIds(groupDuplicated.after, "group-a-copy"),
  ["group-a-copy:text-a", "group-a-copy:group-nested"]
);
assert.deepEqual(
  siblingIds(groupDuplicated.after, "group-a-copy:group-nested"),
  ["group-a-copy:drawing-nested", "group-a-copy:psd-nested"]
);
const copiedNestedPsd =
  groupDuplicated.after.payload.layerDocumentsById[
    "group-a-copy:psd-nested"
  ];
const originalNestedPsd =
  groupDuplicated.after.payload.layerDocumentsById["psd-nested"];
assert.equal(
  copiedNestedPsd.common.source?.sourceId,
  originalNestedPsd.common.source?.sourceId
);
const copiedDrawing =
  groupDuplicated.after.payload.layerDocumentsById[
    "group-a-copy:drawing-nested"
  ];
const originalDrawing =
  groupDuplicated.after.payload.layerDocumentsById["drawing-nested"];
assert.equal(copiedDrawing.type, "drawing");
assert.equal(originalDrawing.type, "drawing");
if (copiedDrawing.type !== "drawing" || originalDrawing.type !== "drawing") {
  throw new Error("Expected Drawing subtree duplicate");
}
assert.notStrictEqual(copiedDrawing.data, originalDrawing.data);
assert.notStrictEqual(
  copiedDrawing.common.transform,
  originalDrawing.common.transform
);
copiedDrawing.data.elements[0].kind = "changed";
assert.equal(originalDrawing.data.elements[0].kind, "stroke");

const deleteInput = createProject();
const deleteSnapshot = clone(deleteInput);
const deleted = expectSuccess(
  buildDeleteLayerDocumentTransaction(deleteInput, {
    layerDocumentId: "group-a",
  })
);
assert.deepEqual(deleteInput, deleteSnapshot);
assert.deepEqual(deleted.deletedLayerDocumentIds, [
  "group-a",
  "text-a",
  "group-nested",
  "drawing-nested",
  "psd-nested",
]);
assert.deepEqual(siblingIds(deleted.after, "root"), ["group-b"]);
assert.equal(
  deleted.after.payload.layerDocumentsById["group-b"].revision,
  deleteInput.payload.layerDocumentsById["group-b"].revision + 1
);
assert.deepEqual(deleted.historyEntry.affectedLayerDocumentIds, [
  "drawing-nested",
  "group-a",
  "group-b",
  "group-nested",
  "psd-nested",
  "text-a",
]);
assert.deepEqual(
  deleted.after.payload.sourceRegistry,
  deleteInput.payload.sourceRegistry
);
assert.equal(
  Object.keys(deleted.after.payload.sourceRegistry.sourcesById).length,
  3
);

const leafDeleteInput = createProject();
const leafDeleteSnapshot = clone(leafDeleteInput);
const leafDeleted = expectSuccess(
  buildDeleteLayerDocumentTransaction(leafDeleteInput, {
    layerDocumentId: "psd-b",
  })
);
assert.deepEqual(leafDeleteInput, leafDeleteSnapshot);
assert.deepEqual(leafDeleted.deletedLayerDocumentIds, ["psd-b"]);
assert.deepEqual(siblingIds(leafDeleted.after, "group-b"), ["text-b"]);
assert.equal(
  leafDeleted.after.payload.layerDocumentsById["text-b"].revision,
  leafDeleteInput.payload.layerDocumentsById["text-b"].revision + 1
);
assert.deepEqual(
  leafDeleted.historyEntry.affectedLayerDocumentIds,
  ["psd-b", "text-b"]
);
assert.ok(
  leafDeleted.after.payload.sourceRegistry.sourcesById["source-node-a"]
);

const sourceInput = createProject();
const sourceSnapshot = clone(sourceInput);
const sourceReplaced = expectSuccess(
  buildReplaceLayerDocumentSourceTransaction(sourceInput, {
    layerDocumentId: "psd-b",
    sourceId: "source-node-b",
  })
);
assert.deepEqual(sourceInput, sourceSnapshot);
const sourceBeforeLayer =
  sourceInput.payload.layerDocumentsById["psd-b"];
const sourceAfterLayer =
  sourceReplaced.after.payload.layerDocumentsById["psd-b"];
const expectedSourceLayer = clone(sourceBeforeLayer);
expectedSourceLayer.common.source = { sourceId: "source-node-b" };
expectedSourceLayer.revision += 1;
assert.deepEqual(sourceAfterLayer, expectedSourceLayer);
assert.deepEqual(
  sourceReplaced.after.payload.sourceRegistry,
  sourceInput.payload.sourceRegistry
);

const nameInput = createProject();
nameInput.payload.layerDocumentsById["text-a"]
  .common.placement.alias = "Placement Alias";
const nameSnapshot = clone(nameInput);
const nameUpdated = expectSuccess(
  buildSetLayerDocumentNameTransaction(nameInput, {
    layerDocumentId: "text-a",
    name: "  Renamed Text  ",
  })
);
assert.deepEqual(nameInput, nameSnapshot);
const renamedLayer =
  nameUpdated.after.payload.layerDocumentsById["text-a"];
assert.equal(renamedLayer.name, "Renamed Text");
assert.equal(
  renamedLayer.common.placement.alias,
  "Placement Alias"
);
assert.equal(
  renamedLayer.revision,
  nameInput.payload.layerDocumentsById["text-a"].revision + 1
);
assert.deepEqual(nameUpdated.selectionChange, { kind: "preserve" });
assert.equal(nameUpdated.kind, "set-name");

const emptyNameInput = createProject();
const emptyNameSnapshot = clone(emptyNameInput);
expectFailure(
  buildSetLayerDocumentNameTransaction(emptyNameInput, {
    layerDocumentId: "text-a",
    name: "   ",
  }),
  "invalid-command",
  emptyNameInput,
  emptyNameSnapshot
);

const moveInput = createProject();
const moveSnapshot = clone(moveInput);
const moved = expectSuccess(
  buildMoveGroupLayerDocumentTransaction(moveInput, {
    layerDocumentId: "group-nested",
    newParentLayerDocumentId: "group-b",
    newOrder: 1,
  })
);
assert.deepEqual(moveInput, moveSnapshot);
assert.deepEqual(siblingIds(moved.after, "group-a"), ["text-a"]);
assert.deepEqual(
  siblingIds(moved.after, "group-b"),
  ["psd-b", "group-nested", "text-b"]
);
assert.equal(
  moved.after.payload.layerDocumentsById["group-nested"]
    .common.placement.parentLayerDocumentId,
  "group-b"
);
assert.equal(
  moved.after.payload.layerDocumentsById["drawing-nested"]
    .common.placement.parentLayerDocumentId,
  "group-nested"
);
assert.equal(
  moved.after.payload.layerDocumentsById["group-nested"].revision,
  moveInput.payload.layerDocumentsById["group-nested"].revision + 1
);
assert.equal(
  moved.after.payload.layerDocumentsById["text-b"].revision,
  moveInput.payload.layerDocumentsById["text-b"].revision + 1
);
assert.deepEqual(
  moved.historyEntry.affectedLayerDocumentIds,
  ["group-nested", "text-b"]
);

const sameParentMoveInput = createProject();
const sameParentMoved = expectSuccess(
  buildMoveGroupLayerDocumentTransaction(sameParentMoveInput, {
    layerDocumentId: "group-a",
    newParentLayerDocumentId: "root",
    newOrder: 1,
  })
);
assert.deepEqual(siblingIds(sameParentMoved.after, "root"), [
  "group-b",
  "group-a",
]);
assert.equal(
  sameParentMoved.after.payload.layerDocumentsById["group-a"].revision,
  sameParentMoveInput.payload.layerDocumentsById["group-a"].revision + 1
);
assert.equal(
  sameParentMoved.after.payload.layerDocumentsById["group-b"].revision,
  sameParentMoveInput.payload.layerDocumentsById["group-b"].revision + 1
);
assert.deepEqual(
  sameParentMoved.historyEntry.affectedLayerDocumentIds,
  ["group-a", "group-b"]
);

const commonInput = createProject();
const commonSnapshot = clone(commonInput);
const nextTransform = {
  position: { x: 400, y: 500 },
  transformOffset: { x: 4, y: 5 },
  anchor: { x: 20, y: 30 },
  scale: { x: 120, y: 80 },
  scaleLinked: false,
  rotation: 15,
  opacity: 75,
};
const commonUpdated = expectSuccess(
  buildUpdateLayerDocumentCommonTransaction(commonInput, {
    layerDocumentId: "text-a",
    update: {
      kind: "set-transform",
      transform: nextTransform,
    },
  })
);
assert.deepEqual(commonInput, commonSnapshot);
assert.deepEqual(
  commonUpdated.after.payload.layerDocumentsById["text-a"]
    .common.transform,
  nextTransform
);
assert.notStrictEqual(
  commonUpdated.after.payload.layerDocumentsById["text-a"]
    .common.transform,
  nextTransform
);
assert.equal(
  commonUpdated.after.payload.layerDocumentsById["text-a"].revision,
  commonInput.payload.layerDocumentsById["text-a"].revision + 1
);

const domainInput = createProject();
const domainSnapshot = clone(domainInput);
const nextTextData = {
  text: "Updated text",
  style: {
    fontFamily: "Updated Sans",
    fontSize: 64,
    color: "#ff00ff",
  },
};
const domainUpdated = expectSuccess(
  buildUpdateLayerDocumentDomainTransaction(domainInput, {
    layerDocumentId: "text-a",
    update: {
      kind: "replace-text-document",
      data: nextTextData,
    },
  })
);
assert.deepEqual(domainInput, domainSnapshot);
const updatedText =
  domainUpdated.after.payload.layerDocumentsById["text-a"];
assert.equal(updatedText.type, "text");
if (updatedText.type !== "text") throw new Error("Expected Text update");
assert.deepEqual(updatedText.data, nextTextData);
assert.notStrictEqual(updatedText.data, nextTextData);
assert.equal(
  updatedText.revision,
  domainInput.payload.layerDocumentsById["text-a"].revision + 1
);

const noChangeCommonInput = createProject();
const noChangeLayer =
  noChangeCommonInput.payload.layerDocumentsById["text-a"];
const noChangeCommonUpdates: LayerDocumentCommonUpdate[] = [
  {
    kind: "set-transform",
    transform: clone(noChangeLayer.common.transform),
  },
  {
    kind: "set-placement-timing",
    startFrame: noChangeLayer.common.placement.startFrame,
    durationFrames: noChangeLayer.common.placement.durationFrames,
    sourceOffsetFrames:
      noChangeLayer.common.placement.sourceOffsetFrames,
  },
  {
    kind: "set-visibility",
    visible: noChangeLayer.common.placement.visible,
  },
  {
    kind: "set-alias",
    alias: noChangeLayer.common.placement.alias,
  },
  {
    kind: "set-animation",
    animation: clone(noChangeLayer.common.animation),
  },
  {
    kind: "set-effects",
    effects: clone(noChangeLayer.common.effects),
  },
  {
    kind: "set-modifiers",
    modifiers: clone(noChangeLayer.common.modifiers),
  },
];
noChangeCommonUpdates.forEach((update) => {
  const input = createProject();
  const snapshot = clone(input);
  const layer = input.payload.layerDocumentsById["text-a"];
  const normalizedUpdate: LayerDocumentCommonUpdate =
    update.kind === "set-transform"
      ? { ...update, transform: clone(layer.common.transform) }
      : update.kind === "set-placement-timing"
        ? {
            ...update,
            startFrame: layer.common.placement.startFrame,
            durationFrames: layer.common.placement.durationFrames,
            sourceOffsetFrames:
              layer.common.placement.sourceOffsetFrames,
          }
        : update.kind === "set-visibility"
          ? {
              ...update,
              visible: layer.common.placement.visible,
            }
          : update.kind === "set-alias"
            ? { ...update, alias: layer.common.placement.alias }
            : update.kind === "set-animation"
              ? { ...update, animation: clone(layer.common.animation) }
              : update.kind === "set-effects"
                ? { ...update, effects: clone(layer.common.effects) }
                : {
                    ...update,
                    modifiers: clone(layer.common.modifiers),
                  };
  expectFailure(
    buildUpdateLayerDocumentCommonTransaction(input, {
      layerDocumentId: "text-a",
      update: normalizedUpdate,
    }),
    "no-change",
    input,
    snapshot
  );
});

const noChangeNameInput = createProject();
expectFailure(
  buildSetLayerDocumentNameTransaction(noChangeNameInput, {
    layerDocumentId: "text-a",
    name: `  ${noChangeNameInput.payload.layerDocumentsById["text-a"].name}  `,
  }),
  "no-change",
  noChangeNameInput,
  clone(noChangeNameInput)
);

const noChangeDomainInput = createProject();
const noChangeText =
  noChangeDomainInput.payload.layerDocumentsById["text-a"];
if (noChangeText.type !== "text") {
  throw new Error("Expected Text no-change fixture");
}
expectFailure(
  buildUpdateLayerDocumentDomainTransaction(noChangeDomainInput, {
    layerDocumentId: "text-a",
    update: {
      kind: "replace-text-document",
      data: clone(noChangeText.data),
    },
  }),
  "no-change",
  noChangeDomainInput,
  clone(noChangeDomainInput)
);

const noChangeSourceInput = createProject();
expectFailure(
  buildReplaceLayerDocumentSourceTransaction(noChangeSourceInput, {
    layerDocumentId: "psd-b",
    sourceId: "source-node-a",
  }),
  "no-change",
  noChangeSourceInput,
  clone(noChangeSourceInput)
);

const noChangeMoveInput = createProject();
expectFailure(
  buildMoveGroupLayerDocumentTransaction(noChangeMoveInput, {
    layerDocumentId: "group-a",
    newParentLayerDocumentId: "root",
    newOrder: 0,
  }),
  "no-change",
  noChangeMoveInput,
  clone(noChangeMoveInput)
);

const cycleInput = createProject();
const cycleSnapshot = clone(cycleInput);
expectFailure(
  buildMoveGroupLayerDocumentTransaction(cycleInput, {
    layerDocumentId: "group-a",
    newParentLayerDocumentId: "group-nested",
    newOrder: 0,
  }),
  "cycle-detected",
  cycleInput,
  cycleSnapshot
);

const incompatibleSourceInput = createProject();
const incompatibleSourceSnapshot = clone(incompatibleSourceInput);
expectFailure(
  buildReplaceLayerDocumentSourceTransaction(incompatibleSourceInput, {
    layerDocumentId: "text-a",
    sourceId: "source-node-b",
  }),
  "invalid-after",
  incompatibleSourceInput,
  incompatibleSourceSnapshot
);

const domainMismatchInput = createProject();
const domainMismatchSnapshot = clone(domainMismatchInput);
expectFailure(
  buildUpdateLayerDocumentDomainTransaction(domainMismatchInput, {
    layerDocumentId: "text-a",
    update: {
      kind: "replace-drawing-document",
      data: {
        documentVersion: 1,
        elements: [],
      },
    },
  }),
  "domain-type-mismatch",
  domainMismatchInput,
  domainMismatchSnapshot
);

const invalidBeforeInput = createProject();
invalidBeforeInput.payload.layerDocumentsById["text-a"]
  .common.placement.order = 99;
const invalidBeforeSnapshot = clone(invalidBeforeInput);
expectFailure(
  buildUpdateLayerDocumentCommonTransaction(invalidBeforeInput, {
    layerDocumentId: "text-a",
    update: {
      kind: "set-visibility",
      visible: false,
    },
  }),
  "invalid-before",
  invalidBeforeInput,
  invalidBeforeSnapshot
);

const rootDeleteInput = createProject();
const rootDeleteSnapshot = clone(rootDeleteInput);
expectFailure(
  buildDeleteLayerDocumentTransaction(rootDeleteInput, {
    layerDocumentId: "root",
  }),
  "root-operation-forbidden",
  rootDeleteInput,
  rootDeleteSnapshot
);

const transactionImplementation = readFileSync(
  new URL(
    "../src/models/layerDocumentTransactions.ts",
    import.meta.url
  ),
  "utf8"
);
const transactionContract = readFileSync(
  new URL(
    "../src/models/layerDocumentTransactionModel.ts",
    import.meta.url
  ),
  "utf8"
);
const transactionHelpers = readFileSync(
  new URL(
    "../src/models/layerDocumentTransactionHelpers.ts",
    import.meta.url
  ),
  "utf8"
);
const structuralTransactions = readFileSync(
  new URL(
    "../src/models/layerDocumentStructuralTransactions.ts",
    import.meta.url
  ),
  "utf8"
);
const contentTransactions = readFileSync(
  new URL(
    "../src/models/layerDocumentContentTransactions.ts",
    import.meta.url
  ),
  "utf8"
);
assert.match(
  transactionImplementation,
  /export \* from "@\/models\/layerDocumentContentTransactions"/
);
assert.match(
  transactionImplementation,
  /export \* from "@\/models\/layerDocumentStructuralTransactions"/
);
assert.doesNotMatch(transactionImplementation, /export function/);
for (const source of [
  transactionImplementation,
  transactionContract,
  transactionHelpers,
  structuralTransactions,
  contentTransactions,
]) {
  assert.doesNotMatch(
    source,
    /from\s+["']@\/(?:editor|engines|features)\//
  );
  assert.doesNotMatch(
    source,
    /\b(?:useState|useReducer|setComps|setTimelineItems|setProject)\b/
  );
}
assert.doesNotMatch(
  [
    transactionHelpers,
    structuralTransactions,
    contentTransactions,
  ].join("\n"),
  /ProjectSourceDocument|TimelineItem|Composition/
);

console.log("Layer Document transaction verification passed");
