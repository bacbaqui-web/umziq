import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Psd } from "ag-psd";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  type LayerDocument,
  type LayerDocumentProject,
  type PsdTreeSourceSelection,
} from "@/models";
import {
  prepareSourceRegistryDelete,
  prepareSourceRegistryImport,
  preparePsdSourceRegistryRefresh,
} from "@/engines/project/actions/layerDocumentSourceTransactions";
import {
  createLayerDocumentPsdPreparedSessionController,
} from "@/engines/project/adapters/layerDocumentPsdPreparedSessionController";
import {
  createLayerDocumentPsdTreeController,
  type LayerDocumentPsdTreeCommandPort,
} from "@/engines/project/adapters/layerDocumentPsdTreeController";
import {
  buildPsdSourceTreeReadModel,
} from "@/engines/project/helpers/layerDocumentSourceTreeHelpers";
import type {
  PreparedLayerDocumentPsdImport,
  PreparedLayerDocumentPsdRefresh,
} from "@/engines/project/import/layerDocumentPsdImportAdapter";
import {
  buildLayerDocumentPsdImportViewPlan,
  buildLayerDocumentPsdTreeNodes,
} from "@/engines/psd-tree/useLayerDocumentPsdTreeEngine";

function rootLayer(): LayerDocument {
  return {
    layerDocumentId: "root",
    name: "Project",
    revision: 0,
    type: "group",
    common: {
      source: null,
      transform: {
        position: { x: 0, y: 0 },
        transformOffset: { x: 0, y: 0 },
        anchor: { x: 0, y: 0 },
        scale: { x: 100, y: 100 },
        scaleLinked: true,
        rotation: 0,
        opacity: 100,
      },
      placement: {
        parentLayerDocumentId: null,
        order: 0,
        startFrame: 0,
        durationFrames: 120,
        sourceOffsetFrames: 0,
        visible: true,
        alias: null,
      },
      animation: {
        positionKeyframes: [],
        scaleKeyframes: [],
        rotationKeyframes: [],
        opacityKeyframes: [],
        enabledProperties: {
          position: false,
          scale: false,
          rotation: false,
          opacity: false,
        },
      },
      effects: [],
      modifiers: [],
    },
    data: {
      role: "project-root",
      width: 1080,
      height: 1920,
      frameRate: 30,
      durationFrames: 120,
    },
  };
}

let project: LayerDocumentProject = {
  metadata: {
    schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
    projectId: "psd-tree-controller",
    name: "PSD tree controller",
  },
  payload: {
    layerDocumentsById: { root: rootLayer() },
    sourceRegistry: { sourcesById: {} },
  },
};
let sourceSelection: PsdTreeSourceSelection | null = null;
const layerSelection = "root";
const activeGroupLayerDocumentId = "root";
let ownerCommitCount = 0;
let registrationAttemptCount = 0;
let failNextRegistration = true;
let confirmedImport: PreparedLayerDocumentPsdImport | null = null;

function confirmPreparedImport(
  prepared: PreparedLayerDocumentPsdImport
) {
  confirmedImport = prepared;
  const claim = prepared.runtime.claimForConfirm();
  if (!claim.ok) return claim;
  if (claim.mode === "commit-owner") {
    const result = prepareSourceRegistryImport(project, prepared.command);
    if (!result.ok) {
      prepared.runtime.failBeforeOwner();
      return result;
    }
    project = result.transaction.after;
    ownerCommitCount += 1;
    prepared.runtime.markOwnerCommitted();
  }
  registrationAttemptCount += 1;
  if (failNextRegistration) {
    failNextRegistration = false;
    prepared.runtime.markRegistrationFailed();
    return { ok: false as const, reason: "registration-failed" };
  }
  prepared.runtime.markTransferred();
  return { ok: true as const };
}

const port: LayerDocumentPsdTreeCommandPort = {
  readTree: () =>
    buildPsdSourceTreeReadModel({
      project,
      selection: sourceSelection,
    }),
  readProject: () => project,
  selectSource: (selection) => {
    sourceSelection = selection;
  },
  confirmImport: confirmPreparedImport,
  cancelImport: (prepared) => prepared.runtime.cancel(),
  confirmRefresh: (
    prepared: PreparedLayerDocumentPsdRefresh
  ) => {
    const claim = prepared.runtime.claimForConfirm();
    if (!claim.ok) return claim;
    prepared.runtime.failBeforeOwner();
    return { ok: false as const };
  },
  cancelRefresh: (prepared) => prepared.runtime.cancel(),
  refreshSource: () => ({ ok: true }),
  markMissing: () => ({ ok: true }),
  reconnect: () => ({ ok: true }),
  deleteSource: (command) => {
    const result = prepareSourceRegistryDelete(project, command);
    if (result.ok) project = result.transaction.after;
    return result;
  },
};
const controller = createLayerDocumentPsdTreeController({ port });

function parsedPsd(
  childNames: readonly string[],
  canvasSize = 10
): Psd {
  return {
    width: 200,
    height: 100,
    children: [{
      id: 10,
      name: "Folder",
      children: childNames.map((name, index) => ({
        id: name === "Gamma" ? 3 : index + 1,
        name,
        left: 0,
        top: 0,
        canvas: {
          width: canvasSize + index,
          height: canvasSize + index,
          getContext: () => null,
        } as never,
      })),
    }],
  };
}

const importPlan = await controller.prepareImport({
  file: new File(["fixture"], "fixture.psd"),
  token: "fixture",
  parentLayerDocumentId: "root",
  order: 0,
  durationFrames: 120,
  parsePsd: async () => parsedPsd(["Alpha", "Beta"]),
});
assert.equal(importPlan.prepared.runtime.readState(), "prepared");
const group = importPlan.nodes.find((node) =>
  node.layerDocumentId.includes("id:10")
);
assert.ok(group);
const originalChildren = importPlan.nodes
  .filter((node) =>
    node.parentLayerDocumentId === group.layerDocumentId
  )
  .sort((left, right) => left.order - right.order);
assert.equal(originalChildren.length, 2);
const reordered = controller.reorderImportPreviewNode(importPlan, {
  parentLayerDocumentId: group.layerDocumentId,
  fromIndex: 0,
  toIndex: 1,
});
const reorderedChildren = reordered.nodes
  .filter((node) =>
    node.parentLayerDocumentId === group.layerDocumentId
  )
  .sort((left, right) => left.order - right.order);
assert.equal(
  reorderedChildren[0].layerDocumentId,
  originalChildren[1].layerDocumentId
);
assert.equal(controller.confirmImport(reordered).ok, false);
assert.equal(ownerCommitCount, 1);
assert.equal(registrationAttemptCount, 1);
assert.equal(
  importPlan.prepared.runtime.readState(),
  "runtime-registration-pending"
);
assert.equal(controller.confirmImport(reordered).ok, true);
assert.equal(ownerCommitCount, 1);
assert.equal(registrationAttemptCount, 2);
assert.equal(importPlan.prepared.runtime.readState(), "transferred");
assert.ok(confirmedImport);
for (const source of importPlan.prepared.command.sources) {
  assert.equal(source.refresh.status, "normal");
  assert.equal(
    project.payload.sourceRegistry.sourcesById[
      source.sourceId
    ].refresh.status,
    "normal"
  );
}
const materializedChildren = confirmedImport.command.layers
  .filter((layer) =>
    layer.common.placement.parentLayerDocumentId === group.layerDocumentId
  )
  .sort((left, right) =>
    left.common.placement.order - right.common.placement.order
  );
assert.equal(
  materializedChildren[0].layerDocumentId,
  originalChildren[1].layerDocumentId
);

const beforeLayerSelection = layerSelection;
const beforeActiveGroup = activeGroupLayerDocumentId;
const documentSourceId =
  importPlan.prepared.command.sources.find(
    (source) => source.kind === "psd-document"
  )?.sourceId;
assert.ok(documentSourceId);
controller.selectSource(documentSourceId);
assert.equal(sourceSelection?.sourceId, documentSourceId);
assert.equal(layerSelection, beforeLayerSelection);
assert.equal(activeGroupLayerDocumentId, beforeActiveGroup);

const referencedNodeSourceId =
  project.payload.layerDocumentsById[
    originalChildren[0].layerDocumentId
  ].common.source?.sourceId;
assert.ok(referencedNodeSourceId);
const deleteReferenced = controller.deleteSource({
  sourceId: referencedNodeSourceId,
});
assert.equal(deleteReferenced.ok, false);
if (!deleteReferenced.ok) {
  assert.equal(deleteReferenced.error.code, "source-is-referenced");
}
assert.ok(project.payload.layerDocumentsById[
  originalChildren[0].layerDocumentId
]);

const existingDocument = controller.sourceForRefresh(documentSourceId);
assert.ok(existingDocument);
const refreshPlan = await controller.prepareRefresh({
  file: new File(["refresh-larger"], "fixture.psd"),
  documentSource: existingDocument,
  existingSources: Object.values(
    project.payload.sourceRegistry.sourcesById
  ),
  parsePsd: async () => parsedPsd(["Alpha", "Gamma"], 20),
});
assert.equal(refreshPlan.summary.documentSourceId, documentSourceId);
assert.equal(refreshPlan.summary.updatedSourceIds.includes(
  documentSourceId
), true);
assert.equal(refreshPlan.summary.newSourceIds.length, 1);
assert.equal(refreshPlan.summary.deletePendingSourceIds.length, 1);
assert.equal(
  refreshPlan.prepared.command.documentSource.refresh.status,
  "updated"
);
for (const sourceId of refreshPlan.summary.updatedSourceIds) {
  if (sourceId === documentSourceId) continue;
  assert.equal(
    refreshPlan.prepared.command.nodeSources.find(
      (source) => source.sourceId === sourceId
    )?.refresh.status,
    "updated"
  );
}
const newSourceId = refreshPlan.summary.newSourceIds[0];
assert.equal(
  refreshPlan.prepared.command.nodeSources.find(
    (source) => source.sourceId === newSourceId
  )?.refresh.status,
  "new"
);
const deletePendingId =
  refreshPlan.summary.deletePendingSourceIds[0];
assert.equal(
  refreshPlan.prepared.command.nodeSources.find(
    (source) => source.sourceId === deletePendingId
  )?.refresh.status,
  "deletePending"
);
const refreshTransaction =
  preparePsdSourceRegistryRefresh(project, {
    ...refreshPlan.prepared.command,
    cacheContext: {
      globalFrame: 0,
      localFrameByLayerDocumentId: {},
      quality: "preview",
    },
  });
assert.equal(refreshTransaction.ok, true);
if (refreshTransaction.ok) {
  const refreshedProject =
    refreshTransaction.transaction.after;
  assert.equal(
    refreshedProject.payload.sourceRegistry.sourcesById[
      documentSourceId
    ].refresh.status,
    "updated"
  );
  assert.equal(
    refreshedProject.payload.sourceRegistry.sourcesById[
      newSourceId
    ].refresh.status,
    "new"
  );
  assert.equal(
    refreshedProject.payload.sourceRegistry
      .sourcesById[deletePendingId]
      .refresh.status,
    "deletePending"
  );
  const refreshedController =
    createLayerDocumentPsdTreeController({
      port: {
        ...port,
        readProject: () => refreshedProject,
        readTree: () =>
          buildPsdSourceTreeReadModel({
            project: refreshedProject,
            selection: null,
          }),
      },
    });
  const flattenedUiNodes = (
    nodes: ReturnType<
      typeof buildLayerDocumentPsdTreeNodes
    >
  ): ReturnType<
    typeof buildLayerDocumentPsdTreeNodes
  > => nodes.flatMap((node) => [
    node,
    ...flattenedUiNodes(node.children),
  ]);
  const uiNodes = flattenedUiNodes(
    buildLayerDocumentPsdTreeNodes(
      refreshedController
    )
  );
  assert.equal(
    uiNodes.find((node) =>
      node.id === documentSourceId
    )?.sourceSyncStatus,
    "updated"
  );
  assert.equal(
    uiNodes.find((node) =>
      node.id === newSourceId
    )?.sourceSyncStatus,
    "new"
  );
  assert.equal(
    uiNodes.find((node) =>
      node.id === deletePendingId
    )?.sourceSyncStatus,
    "deletePending"
  );
}
assert.equal(
  controller.confirmRefresh(refreshPlan, {
    globalFrame: 0,
    localFrameByLayerDocumentId: {},
    quality: "preview",
  }).ok,
  false
);
assert.equal(
  refreshPlan.prepared.runtime.readState(),
  "failed-before-owner"
);

const cancelledPlan = await controller.prepareImport({
  file: new File(["cancel"], "cancel.psd"),
  token: "cancel",
  parentLayerDocumentId: "root",
  order: 1,
  durationFrames: 120,
  parsePsd: async () => parsedPsd(["Cancelled"]),
});
assert.equal(controller.cancelImport(cancelledPlan).changed, true);
assert.equal(
  cancelledPlan.prepared.runtime.readState(),
  "cancelled"
);
assert.equal(controller.cancelImport(cancelledPlan).changed, false);

const stalePlan = await controller.prepareImport({
  file: new File(["stale"], "stale.psd"),
  token: "stale",
  parentLayerDocumentId: "root",
  order: 2,
  durationFrames: 120,
  parsePsd: async () => parsedPsd(["Stale"]),
});
const activePlan = await controller.prepareImport({
  file: new File(["active"], "active.psd"),
  token: "active",
  parentLayerDocumentId: "root",
  order: 3,
  durationFrames: 120,
  parsePsd: async () => parsedPsd(["Active"]),
});
let disposedPreparedResourceCount = 0;
const preparedSession =
  createLayerDocumentPsdPreparedSessionController({
    cancelImport: (plan) => {
      const disposition = controller.cancelImport(plan);
      disposedPreparedResourceCount +=
        disposition.disposedCount;
      return disposition;
    },
    cancelRefresh: controller.cancelRefresh,
  });
const staleSequence = preparedSession.begin();
const activeSequence = preparedSession.begin();
assert.equal(
  preparedSession.acceptImports(
    staleSequence,
    [stalePlan]
  ).accepted,
  false
);
assert.equal(
  stalePlan.prepared.runtime.readState(),
  "cancelled"
);
assert.equal(disposedPreparedResourceCount, 1);
assert.equal(
  preparedSession.acceptImports(
    activeSequence,
    [activePlan]
  ).accepted,
  true
);
assert.equal(
  buildLayerDocumentPsdImportViewPlan([activePlan])
    .entries.length,
  1
);
assert.equal(buildLayerDocumentPsdTreeNodes(controller).length > 0, true);
assert.equal(preparedSession.cancelActive(), true);
assert.equal(
  activePlan.prepared.runtime.readState(),
  "cancelled"
);
assert.equal(disposedPreparedResourceCount, 2);

const tree = controller.read();
const sortedDocumentNames = tree.documents.map(
  (document) => document.displayName
);
assert.deepEqual(
  sortedDocumentNames,
  [...sortedDocumentNames].sort((left, right) =>
    left.localeCompare(right)
  )
);

const propertiesControllerSource = readFileSync(
  "src/engines/properties/adapters/layerDocumentPropertiesController.ts",
  "utf8"
);
const psdControllerSource = readFileSync(
  "src/engines/project/adapters/layerDocumentPsdTreeController.ts",
  "utf8"
);
for (const source of [propertiesControllerSource, psdControllerSource]) {
  assert.doesNotMatch(source, /from ["']@\/cutover/);
  assert.doesNotMatch(source, /LayerDocumentConsumerCutoverAssembly/);
}
const cutoverAdapterSource = readFileSync(
  "src/cutover/layerDocumentUiControllerPortAdapters.ts",
  "utf8"
);
assert.match(
  cutoverAdapterSource,
  /createLayerDocumentPropertiesCommandPort/
);
assert.match(
  readFileSync(
    "src/engines/properties/adapters/useLayerDocumentPropertiesEngine.ts",
    "utf8"
  ),
  /PropertiesEngineViewProps/
);
assert.match(
  readFileSync(
    "src/engines/psd-tree/useLayerDocumentPsdTreeEngine.ts",
    "utf8"
  ),
  /PsdTreeViewProps/
);
assert.match(cutoverAdapterSource, /evaluateLayerDocumentTransform/);
assert.match(cutoverAdapterSource, /isLayerDocumentDraftForInput/);
assert.match(
  cutoverAdapterSource,
  /createLayerDocumentPsdTreeCommandPort/
);

console.log("LayerDocument PSD Tree controller verified");
