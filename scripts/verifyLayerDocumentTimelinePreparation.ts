import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  applyLayerDocumentSelectionChange,
  buildLayerDocumentTimelineIntentTransaction,
  buildLayerDocumentTimelineReadModel,
  normalizeLayerDocumentSelection,
  validateLayerDocumentProject,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerDocumentSelection,
  type LayerDocumentTimelineIntent,
  type LayerDocumentTimelineRowReadModel,
  type LayerDocumentTransaction,
  type LayerDocumentTransactionResult,
  type LayerSourceReference,
  type SourceRegistryRecord,
} from "@/models";

function common<TSource extends LayerSourceReference | null>(
  id: string,
  parentLayerDocumentId: string | null,
  order: number,
  source: TSource,
  timing = {
    startFrame: 0,
    durationFrames: 60,
    sourceOffsetFrames: 0,
  }
): LayerDocumentCommon<TSource> {
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
      ...timing,
      visible: true,
      alias: null,
    },
    animation: {
      positionKeyframes: [{
        frame: 0,
        value: { x: order * 10, y: order * 20 },
      }],
      scaleKeyframes: [{
        frame: 0,
        value: { x: 100, y: 100 },
      }],
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
      type: "fixture",
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

function sources(): Record<string, SourceRegistryRecord> {
  const refresh = {
    status: "normal" as const,
  };
  return {
    "source-document": {
      sourceId: "source-document",
      kind: "psd-document",
      displayName: "fixture.psd",
      locator: {
        locatorId: "linked:source-document",
        kind: "linked-file",
        suggestedFileName: "fixture.psd",
        relativePathHint: "fixture.psd",
      },
      contentFingerprint: {
        algorithm: "sha-256",
        digestHex:
          "0000000000000000000000000000000000000000000000000000000000000000",
        byteLength: 1,
      },
      version: 1,
      refresh,
      data: {
        importSettings: {
          compositionName: "Fixture",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "source-node": {
      sourceId: "source-node",
      kind: "psd-node",
      displayName: "Shared PSD Node",
      version: 1,
      refresh,
      data: {
        documentSourceId: "source-document",
        sourceKey: "layer:shared",
        sourcePath: "Shared",
        visualFingerprint: "node",
      },
    },
  };
}

function fixture(): LayerDocumentProject {
  const layers: Record<string, LayerDocument> = {
    root: {
      layerDocumentId: "root",
      name: "Project Root",
      revision: 0,
      type: "group",
      common: common("root", null, 0, null),
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
      revision: 1,
      type: "group",
      common: common("group-a", "root", 0, null),
      data: {
        role: "composition",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 120,
      },
    },
    "psd-a": {
      layerDocumentId: "psd-a",
      name: "PSD A",
      revision: 2,
      type: "psd",
      common: common("psd-a", "group-a", 0, {
        sourceId: "source-node",
      }, {
        startFrame: 10,
        durationFrames: 20,
        sourceOffsetFrames: 3,
      }),
      data: {},
    },
    "psd-a-2": {
      layerDocumentId: "psd-a-2",
      name: "PSD A second placement",
      revision: 3,
      type: "psd",
      common: {
        ...common("psd-a-2", "group-a", 1, {
          sourceId: "source-node",
        }),
        placement: {
          ...common(
            "psd-a-2-placement",
            "group-a",
            1,
            null
          ).placement,
          alias: "Alias A2",
        },
      },
      data: {},
    },
    nested: {
      layerDocumentId: "nested",
      name: "Nested Group",
      revision: 4,
      type: "group",
      common: common("nested", "group-a", 2, null),
      data: {
        role: "composition",
        width: 500,
        height: 500,
        frameRate: 24,
        durationFrames: 60,
      },
    },
    shape: {
      layerDocumentId: "shape",
      name: "Nested Shape",
      revision: 5,
      type: "shape",
      common: common("shape", "nested", 0, null),
      data: {
        documentVersion: 1,
        shapes: [{ kind: "rectangle", width: 100 }],
      },
    },
    "group-b": {
      layerDocumentId: "group-b",
      name: "Group B",
      revision: 6,
      type: "group",
      common: common("group-b", "root", 1, null),
      data: {
        role: "composition",
        width: 720,
        height: 1280,
        frameRate: 30,
        durationFrames: 90,
      },
    },
    text: {
      layerDocumentId: "text",
      name: "Text B",
      revision: 7,
      type: "text",
      common: common("text", "group-b", 0, null),
      data: {
        text: "Fixture",
        style: {
          fontFamily: "Fixture Sans",
          fontSize: 48,
          color: "#ffffff",
        },
      },
    },
  };
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "timeline-preparation",
      name: "Timeline preparation",
    },
    payload: {
      layerDocumentsById: layers,
      sourceRegistry: { sourcesById: sources() },
    },
  };
}

function success(
  result: LayerDocumentTransactionResult
): LayerDocumentTransaction {
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : result.error.message
  );
  assert.deepEqual(validateLayerDocumentProject(result.transaction.after), []);
  assertLayerDiffContract(result.transaction);
  return result.transaction;
}

function failure(
  result: LayerDocumentTransactionResult,
  code: string,
  expectedProject: LayerDocumentProject = project
) {
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, code);
    assert.equal(result.project, expectedProject);
    assert.equal(
      (result as unknown as { transaction?: unknown }).transaction,
      undefined
    );
  }
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
        beforeLayers[layerDocumentId],
        afterLayers[layerDocumentId]
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
  allIds.forEach((layerDocumentId) => {
    const before = beforeLayers[layerDocumentId];
    const after = afterLayers[layerDocumentId];
    if (!before && after) {
      assert.equal(after.revision, 0);
    } else if (
      before &&
      after &&
      changedIds.includes(layerDocumentId)
    ) {
      assert.equal(after.revision, before.revision + 1);
    }
  });
  assert.deepEqual(
    transaction.after.payload.sourceRegistry,
    transaction.before.payload.sourceRegistry
  );
}

function assertOtherLayersUnchanged(
  before: LayerDocumentProject,
  after: LayerDocumentProject,
  targetLayerDocumentId: string
) {
  Object.keys(before.payload.layerDocumentsById)
    .filter((layerDocumentId) => layerDocumentId !== targetLayerDocumentId)
    .forEach((layerDocumentId) => {
      assert.deepEqual(
        after.payload.layerDocumentsById[layerDocumentId],
        before.payload.layerDocumentsById[layerDocumentId]
      );
    });
}

function findRow(
  rows: readonly LayerDocumentTimelineRowReadModel[],
  layerDocumentId: string
): LayerDocumentTimelineRowReadModel | null {
  for (const row of rows) {
    if (row.layerDocumentId === layerDocumentId) return row;
    const child = findRow(row.children, layerDocumentId);
    if (child) return child;
  }
  return null;
}

const project = fixture();
assert.deepEqual(validateLayerDocumentProject(project), []);
const untouchedProject = structuredClone(project);

const firstPlacement = normalizeLayerDocumentSelection(project, {
  kind: "layer-document",
  layerDocumentId: "psd-a",
});
const secondPlacement = normalizeLayerDocumentSelection(project, {
  kind: "layer-document",
  layerDocumentId: "psd-a-2",
});
assert.equal(firstPlacement.selection?.layerDocumentId, "psd-a");
assert.equal(secondPlacement.selection?.layerDocumentId, "psd-a-2");
assert.notEqual(
  firstPlacement.selection?.layerDocumentId,
  secondPlacement.selection?.layerDocumentId
);

const forgedSourceSelection = {
  kind: "library-source",
  sourceId: "source-node",
} as unknown as LayerDocumentSelection;
assert.deepEqual(
  normalizeLayerDocumentSelection(project, forgedSourceSelection),
  { status: "cleared", selection: null }
);
assert.deepEqual(
  normalizeLayerDocumentSelection(project, {
    kind: "layer-document",
    layerDocumentId: "stale-layer",
  }),
  { status: "cleared", selection: null }
);
assert.deepEqual(
  normalizeLayerDocumentSelection(
    project,
    {
      kind: "layer-document",
      layerDocumentId: "stale-layer",
    },
    { kind: "select-layer", layerDocumentId: "group-a" }
  ),
  {
    status: "fallback",
    selection: {
      kind: "layer-document",
      layerDocumentId: "group-a",
    },
  }
);

const timelineResult = buildLayerDocumentTimelineReadModel(project);
assert.equal(timelineResult.ok, true);
if (!timelineResult.ok) throw new Error("Expected Timeline read model");
assert.equal(timelineResult.model.rootRowPolicy, "exclude");
assert.deepEqual(
  timelineResult.model.rows.map((row) => row.layerDocumentId),
  ["group-a", "group-b"]
);
assert.equal(findRow(timelineResult.model.rows, "root"), null);
assert.equal(findRow(timelineResult.model.rows, "shape")?.depth, 2);
const psdRow = findRow(timelineResult.model.rows, "psd-a");
const secondPsdRow = findRow(timelineResult.model.rows, "psd-a-2");
assert.equal(psdRow?.label, "PSD A");
assert.equal(secondPsdRow?.label, "Alias A2");
assert.equal(psdRow?.source?.sourceId, "source-node");
assert.equal(secondPsdRow?.source?.sourceId, "source-node");
assert.notEqual(psdRow?.layerDocumentId, secondPsdRow?.layerDocumentId);
assert.deepEqual(Object.keys(psdRow?.placement ?? {}).sort(), [
  "durationFrames",
  "order",
  "parentLayerDocumentId",
  "sourceOffsetFrames",
  "startFrame",
  "visible",
]);
const timelineWithRoot = buildLayerDocumentTimelineReadModel(
  project,
  "include"
);
assert.equal(timelineWithRoot.ok, true);
if (timelineWithRoot.ok) {
  assert.deepEqual(
    timelineWithRoot.model.rows.map((row) => row.layerDocumentId),
    ["root"]
  );
  assert.equal(timelineWithRoot.model.rows[0].depth, 0);
}

const duplicate = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "duplicate-layer",
    layerDocumentId: "psd-a",
    newLayerDocumentId: "psd-copy",
  })
);
const duplicateLayer =
  duplicate.after.payload.layerDocumentsById["psd-copy"];
assert.equal(duplicateLayer.common.source?.sourceId, "source-node");
assert.equal(duplicateLayer.revision, 0);
["psd-a", "psd-a-2", "nested"].forEach((layerDocumentId) => {
  assert.equal(
    duplicate.after.payload.layerDocumentsById[layerDocumentId]
      .revision,
    project.payload.layerDocumentsById[layerDocumentId].revision + 1
  );
});
assert.deepEqual(
  duplicate.historyEntry.affectedLayerDocumentIds,
  ["nested", "psd-a", "psd-a-2", "psd-copy"]
);
assert.deepEqual(duplicate.selectionChange, {
  kind: "select",
  layerDocumentId: "psd-copy",
});
duplicateLayer.common.effects[0].parameters.amount = 999;
assert.equal(
  duplicate.after.payload.layerDocumentsById["psd-a"]
    .common.effects[0].parameters.amount,
  1
);
assert.equal(
  project.payload.layerDocumentsById["psd-a"]
    .common.effects[0].parameters.amount,
  1
);

const deleted = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "delete-layer",
    layerDocumentId: "psd-a",
  })
);
assert.equal(
  deleted.after.payload.layerDocumentsById["psd-a"],
  undefined
);
["psd-a-2", "nested"].forEach((layerDocumentId) => {
  assert.equal(
    deleted.after.payload.layerDocumentsById[layerDocumentId].revision,
    project.payload.layerDocumentsById[layerDocumentId].revision + 1
  );
});
assert.deepEqual(
  deleted.historyEntry.affectedLayerDocumentIds,
  ["nested", "psd-a", "psd-a-2"]
);
assert.deepEqual(
  applyLayerDocumentSelectionChange(
    deleted.after,
    {
      kind: "layer-document",
      layerDocumentId: "psd-a",
    },
    deleted.selectionChange
  ),
  { status: "cleared", selection: null }
);

const renamed = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "rename-layer",
    layerDocumentId: "psd-a-2",
    name: "  Renamed placement  ",
  })
);
assert.equal(
  renamed.after.payload.layerDocumentsById["psd-a-2"].name,
  "Renamed placement"
);
assert.equal(
  renamed.after.payload.layerDocumentsById["psd-a-2"]
    .common.placement.alias,
  "Alias A2"
);
assertOtherLayersUnchanged(project, renamed.after, "psd-a-2");

const aliased = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "set-alias",
    layerDocumentId: "psd-a",
    alias: "  Cutaway  ",
  })
);
assert.equal(
  aliased.after.payload.layerDocumentsById["psd-a"]
    .common.placement.alias,
  "Cutaway"
);
assertOtherLayersUnchanged(project, aliased.after, "psd-a");

const hidden = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "set-visibility",
    layerDocumentId: "psd-a",
    visible: false,
  })
);
assert.equal(
  hidden.after.payload.layerDocumentsById["psd-a"]
    .common.placement.visible,
  false
);
assert.equal(
  hidden.after.payload.layerDocumentsById["psd-a"].revision,
  project.payload.layerDocumentsById["psd-a"].revision + 1
);
assertOtherLayersUnchanged(project, hidden.after, "psd-a");

const timed = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "set-timing",
    layerDocumentId: "psd-a",
    startFrame: 12,
    durationFrames: 30,
    sourceOffsetFrames: 4,
  })
);
assert.deepEqual(
  {
    startFrame:
      timed.after.payload.layerDocumentsById["psd-a"]
        .common.placement.startFrame,
    durationFrames:
      timed.after.payload.layerDocumentsById["psd-a"]
        .common.placement.durationFrames,
    sourceOffsetFrames:
      timed.after.payload.layerDocumentsById["psd-a"]
        .common.placement.sourceOffsetFrames,
  },
  {
    startFrame: 12,
    durationFrames: 30,
    sourceOffsetFrames: 4,
  }
);
assertOtherLayersUnchanged(project, timed.after, "psd-a");

const reorderedLayer = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "move-layer",
    layerDocumentId: "psd-a",
    newParentLayerDocumentId: "group-a",
    newOrder: 2,
  })
);
assert.deepEqual(
  ["psd-a-2", "nested", "psd-a"].map(
    (id) =>
      reorderedLayer.after.payload.layerDocumentsById[id]
        .common.placement.order
  ),
  [0, 1, 2]
);
assert.deepEqual(
  reorderedLayer.historyEntry.affectedLayerDocumentIds,
  ["nested", "psd-a", "psd-a-2"]
);

const movedLayer = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "move-layer",
    layerDocumentId: "psd-a-2",
    newParentLayerDocumentId: "group-b",
    newOrder: 0,
  })
);
assert.equal(
  movedLayer.after.payload.layerDocumentsById["psd-a-2"]
    .common.placement.parentLayerDocumentId,
  "group-b"
);
assert.deepEqual(
  ["psd-a", "nested"].map(
    (id) =>
      movedLayer.after.payload.layerDocumentsById[id]
        .common.placement.order
  ),
  [0, 1]
);
assert.deepEqual(
  ["psd-a-2", "text"].map(
    (id) =>
      movedLayer.after.payload.layerDocumentsById[id]
        .common.placement.order
  ),
  [0, 1]
);
assert.deepEqual(
  movedLayer.historyEntry.affectedLayerDocumentIds,
  ["nested", "psd-a-2", "text"]
);

const movedGroup = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "move-layer",
    layerDocumentId: "nested",
    newParentLayerDocumentId: "group-b",
    newOrder: 1,
  })
);
assert.equal(
  movedGroup.after.payload.layerDocumentsById.nested
    .common.placement.parentLayerDocumentId,
  "group-b"
);
assert.deepEqual(
  movedGroup.historyEntry.affectedLayerDocumentIds,
  ["nested"]
);
failure(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "move-layer",
    layerDocumentId: "group-a",
    newParentLayerDocumentId: "nested",
    newOrder: 0,
  }),
  "cycle-detected"
);
failure(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "move-layer",
    layerDocumentId: "root",
    newParentLayerDocumentId: "group-a",
    newOrder: 0,
  }),
  "root-operation-forbidden"
);

const split = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "split-layer",
    layerDocumentId: "psd-a",
    newLayerDocumentId: "psd-right",
    splitGlobalFrame: 18,
  })
);
const splitLeft = split.after.payload.layerDocumentsById["psd-a"];
const splitRight =
  split.after.payload.layerDocumentsById["psd-right"];
assert.equal(split.kind, "split-layer");
assert.deepEqual(split.selectionChange, {
  kind: "select",
  layerDocumentId: "psd-right",
});
assert.deepEqual(
  {
    leftStart: splitLeft.common.placement.startFrame,
    leftDuration: splitLeft.common.placement.durationFrames,
    leftOffset: splitLeft.common.placement.sourceOffsetFrames,
    rightStart: splitRight.common.placement.startFrame,
    rightDuration: splitRight.common.placement.durationFrames,
    rightOffset: splitRight.common.placement.sourceOffsetFrames,
  },
  {
    leftStart: 10,
    leftDuration: 8,
    leftOffset: 3,
    rightStart: 18,
    rightDuration: 12,
    rightOffset: 11,
  }
);
assert.equal(splitRight.common.source?.sourceId, "source-node");
assert.equal(splitLeft.common.placement.order + 1,
  splitRight.common.placement.order);
assert.equal(splitRight.revision, 0);
["psd-a", "psd-a-2", "nested"].forEach((layerDocumentId) => {
  assert.equal(
    split.after.payload.layerDocumentsById[layerDocumentId].revision,
    project.payload.layerDocumentsById[layerDocumentId].revision + 1
  );
});
assert.deepEqual(
  split.historyEntry.affectedLayerDocumentIds,
  ["nested", "psd-a", "psd-a-2", "psd-right"]
);
assert.deepEqual(splitRight.common.transform, splitLeft.common.transform);
assert.deepEqual(splitRight.common.animation, splitLeft.common.animation);
assert.deepEqual(splitRight.data, splitLeft.data);
splitRight.common.transform.position.x = 999;
splitRight.common.effects[0].parameters.amount = 999;
assert.notEqual(
  splitLeft.common.transform.position.x,
  splitRight.common.transform.position.x
);
assert.notEqual(
  splitLeft.common.effects[0].parameters.amount,
  splitRight.common.effects[0].parameters.amount
);
assert.equal(split.historyEntry.label, "Split PSD A");
assert.deepEqual(split.createdLayerDocumentIds, ["psd-right"]);
assert.equal(split.deletedLayerDocumentIds.length, 0);

const groupSplit = success(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "split-layer",
    layerDocumentId: "group-a",
    newLayerDocumentId: "group-a-right",
    splitGlobalFrame: 30,
  })
);
assert.deepEqual(groupSplit.createdLayerDocumentIds, [
  "group-a-right",
  "group-a-right:psd-a",
  "group-a-right:psd-a-2",
  "group-a-right:nested",
  "group-a-right:shape",
]);
groupSplit.createdLayerDocumentIds.forEach((layerDocumentId) => {
  assert.equal(
    groupSplit.after.payload.layerDocumentsById[layerDocumentId]
      .revision,
    0
  );
});
assert.equal(
  groupSplit.after.payload.layerDocumentsById[
    "group-a-right:shape"
  ].common.placement.parentLayerDocumentId,
  "group-a-right:nested"
);
assert.equal(
  groupSplit.after.payload.layerDocumentsById["group-a-right"]
    .common.placement.startFrame,
  30
);
assert.equal(
  groupSplit.after.payload.layerDocumentsById["group-a-right"]
    .common.placement.durationFrames,
  30
);
assert.equal(
  groupSplit.after.payload.layerDocumentsById["group-b"].revision,
  project.payload.layerDocumentsById["group-b"].revision + 1
);

failure(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "split-layer",
    layerDocumentId: "psd-a",
    newLayerDocumentId: "bad-split",
    splitGlobalFrame: 10,
  }),
  "invalid-command"
);
failure(
  buildLayerDocumentTimelineIntentTransaction(project, {
    kind: "split-layer",
    layerDocumentId: "root",
    newLayerDocumentId: "bad-root-split",
    splitGlobalFrame: 10,
  }),
  "root-operation-forbidden"
);

const noChangeTimelineIntents: LayerDocumentTimelineIntent[] = [
  {
    kind: "set-timing",
    layerDocumentId: "psd-a",
    startFrame: 10,
    durationFrames: 20,
    sourceOffsetFrames: 3,
  },
  {
    kind: "set-visibility",
    layerDocumentId: "psd-a",
    visible: true,
  },
  {
    kind: "set-alias",
    layerDocumentId: "psd-a",
    alias: "   ",
  },
  {
    kind: "rename-layer",
    layerDocumentId: "psd-a",
    name: "  PSD A  ",
  },
  {
    kind: "move-layer",
    layerDocumentId: "psd-a",
    newParentLayerDocumentId: "group-a",
    newOrder: 0,
  },
];
noChangeTimelineIntents.forEach((intent) => {
  failure(
    buildLayerDocumentTimelineIntentTransaction(project, intent),
    "no-change"
  );
});

assert.deepEqual(project, untouchedProject);

const taskFiles = [
  "src/models/layerDocumentSelectionModel.ts",
  "src/models/layerDocumentTimelineReadModel.ts",
  "src/models/layerDocumentTimelineIntentModel.ts",
  "src/models/layerDocumentTimelineIntentAdapter.ts",
  "src/models/layerDocumentTimelineTransactions.ts",
];
taskFiles.forEach((path) => {
  const source = readFileSync(path, "utf8");
  for (const match of source.matchAll(/from "([^"]+)"/g)) {
    assert.match(match[1], /^@\/models\//);
  }
  assert.doesNotMatch(source, /\bReact\b|useState|setState/);
  assert.doesNotMatch(source, /@\/editor|@\/engines|@\/features/);
});
const adapterSource = readFileSync(
  "src/models/layerDocumentTimelineIntentAdapter.ts",
  "utf8"
);
assert.doesNotMatch(adapterSource, /commitTransaction|commit\(/);
const intentModelSource = readFileSync(
  "src/models/layerDocumentTimelineIntentModel.ts",
  "utf8"
);
assert.doesNotMatch(intentModelSource, /commitTransaction:/);

console.log("Layer Document Timeline preparation verification passed");
