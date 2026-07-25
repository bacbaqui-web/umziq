import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
  findNonPlainDataPath,
  validateLayerDocumentProject,
  type LayerDocument,
  type LayerDocumentCommon,
  type LayerDocumentProject,
  type LayerDocumentSelection,
  type LayerSourceReference,
  type PsdTreeSourceSelection,
  type SourceRegistryRecord,
} from "@/models";
import {
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT,
} from "@/engines/project/adapters/layerDocumentSourcePreparationAdapter";
import {
  buildPsdSourceTreeReadModel,
} from "@/engines/project/helpers/layerDocumentSourceTreeHelpers";
import {
  completeSourceTransaction,
} from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";
import type {
  ImportSourceRegistryCommand,
  LayerDocumentSourceTransactionResult,
  SourceRegistryCacheInvalidationContext,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

function common<TSource extends LayerSourceReference | null>(
  parentLayerDocumentId: string | null,
  order: number,
  source: TSource,
  seed: number
): LayerDocumentCommon<TSource> {
  return {
    source,
    transform: {
      position: { x: seed * 10, y: seed * 20 },
      transformOffset: { x: seed, y: seed + 1 },
      anchor: { x: 50, y: 50 },
      scale: { x: 100 + seed, y: 100 + seed },
      scaleLinked: true,
      rotation: seed,
      opacity: 100 - seed,
    },
    placement: {
      parentLayerDocumentId,
      order,
      startFrame: seed,
      durationFrames: 120,
      sourceOffsetFrames: seed,
      visible: true,
      alias: seed === 1 ? "Layer edit alias" : null,
    },
    animation: {
      positionKeyframes: [{
        frame: 3,
        value: { x: seed * 30, y: seed * 40 },
      }],
      scaleKeyframes: [],
      rotationKeyframes: [],
      opacityKeyframes: [],
      enabledProperties: {
        position: true,
        scale: false,
        rotation: false,
        opacity: false,
      },
    },
    effects: [{
      effectId: `effect-${seed}`,
      type: "fixture",
      enabled: true,
      parameters: { amount: seed },
    }],
    modifiers: [{
      modifierId: `modifier-${seed}`,
      type: "wiggle",
      enabled: true,
      frequency: seed + 1,
      amount: seed + 2,
    }],
  };
}

function refresh() {
  return {
    status: "normal" as const,
    reconnectHint: null,
  };
}

function sourceFixture(): Record<string, SourceRegistryRecord> {
  return {
    "psd-document": {
      sourceId: "psd-document",
      kind: "psd-document",
      displayName: "Editor source.psd",
      path: "/source.psd",
      fingerprint: "document-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        fileName: "source.psd",
        importSettings: {
          compositionName: "Source",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "shared-node": {
      sourceId: "shared-node",
      kind: "psd-node",
      displayName: "Registry pixel node",
      path: "source.psd/Pixel",
      fingerprint: "pixel-v1",
      version: 4,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "layer:pixel",
        sourcePath: "Pixel",
        nativeVisible: true,
      },
    },
    "production-group": {
      sourceId: "production-group",
      kind: "psd-node",
      displayName: "Production Group",
      path: "source.psd/Production Group",
      fingerprint: "production-group-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "group:production",
        sourcePath: "source.psd/Production Group",
        nativeVisible: true,
      },
    },
    "production-layer": {
      sourceId: "production-layer",
      kind: "psd-node",
      displayName: "Production Layer",
      path: "source.psd/Production Group/Layer",
      fingerprint: "production-layer-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "layer:production",
        sourcePath: "source.psd/Production Group/Layer",
        nativeVisible: true,
      },
    },
    "path-root-document": {
      sourceId: "path-root-document",
      kind: "psd-document",
      displayName: "Path root.psd",
      path: "folder/path-root.psd",
      fingerprint: "path-document-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        fileName: "fallback-does-not-match.psd",
        importSettings: {
          compositionName: "Path Root",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "null-root-document": {
      sourceId: "null-root-document",
      kind: "psd-document",
      displayName: "Null root.psd",
      path: null,
      fingerprint: "null-document-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        fileName: "null-root.psd",
        importSettings: {
          compositionName: "Null Root",
          hiddenLayerMode: "preserve",
        },
      },
    },
    "null-root-layer": {
      sourceId: "null-root-layer",
      kind: "psd-node",
      displayName: "Null Path Layer",
      path: "null-root.psd/Layer",
      fingerprint: "null-layer-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "null-root-document",
        sourceKey: "layer:null-root",
        sourcePath: "null-root.psd/Layer",
        nativeVisible: true,
      },
    },
    "path-root-group": {
      sourceId: "path-root-group",
      kind: "psd-node",
      displayName: "Path Group",
      path: "folder/path-root.psd/Group",
      fingerprint: "path-group-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "path-root-document",
        sourceKey: "group:path-root",
        sourcePath: "folder/path-root.psd/Group",
        nativeVisible: true,
      },
    },
    "path-root-layer": {
      sourceId: "path-root-layer",
      kind: "psd-node",
      displayName: "Path Layer",
      path: "folder/path-root.psd/Group/Layer",
      fingerprint: "path-layer-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "path-root-document",
        sourceKey: "layer:path-root",
        sourcePath: "folder/path-root.psd/Group/Layer",
        nativeVisible: true,
      },
    },
    "group-a": {
      sourceId: "group-a",
      kind: "psd-node",
      displayName: "Group",
      path: "source.psd/Group A",
      fingerprint: "group-a-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "group:a",
        sourcePath: "Group A",
        nativeVisible: true,
      },
    },
    "group-a-pixel": {
      sourceId: "group-a-pixel",
      kind: "psd-node",
      displayName: "Pixel",
      path: "source.psd/Group A/Pixel",
      fingerprint: "group-a-pixel-v1",
      version: 2,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "layer:group-a-pixel",
        sourcePath: "Group A/Pixel",
        nativeVisible: true,
      },
    },
    "nested-group": {
      sourceId: "nested-group",
      kind: "psd-node",
      displayName: "Group",
      path: "source.psd/Group A/Nested",
      fingerprint: "nested-group-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "group:a-nested",
        sourcePath: "Group A/Nested",
        nativeVisible: true,
      },
    },
    "nested-pixel": {
      sourceId: "nested-pixel",
      kind: "psd-node",
      displayName: "Pixel",
      path: "source.psd/Group A/Nested/Pixel",
      fingerprint: "nested-pixel-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "layer:nested-pixel",
        sourcePath: "Group A/Nested/Pixel",
        nativeVisible: true,
      },
    },
    "group-b": {
      sourceId: "group-b",
      kind: "psd-node",
      displayName: "Group",
      path: "source.psd/Group B",
      fingerprint: "group-b-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "group:b",
        sourcePath: "Group B",
        nativeVisible: true,
      },
    },
    "group-b-pixel": {
      sourceId: "group-b-pixel",
      kind: "psd-node",
      displayName: "Pixel",
      path: "source.psd/Group B/Pixel",
      fingerprint: "group-b-pixel-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "layer:group-b-pixel",
        sourcePath: "Group B/Pixel",
        nativeVisible: false,
      },
    },
    "duplicate-group-a": {
      sourceId: "duplicate-group-a",
      kind: "psd-node",
      displayName: "Duplicate",
      path: "source.psd/Duplicate",
      fingerprint: "duplicate-a-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "group:duplicate-a",
        sourcePath: "Duplicate",
        nativeVisible: true,
      },
    },
    "duplicate-group-b": {
      sourceId: "duplicate-group-b",
      kind: "psd-node",
      displayName: "Duplicate",
      path: "source.psd/Duplicate",
      fingerprint: "duplicate-b-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "group:duplicate-b",
        sourcePath: "Duplicate",
        nativeVisible: true,
      },
    },
    "duplicate-child": {
      sourceId: "duplicate-child",
      kind: "psd-node",
      displayName: "Pixel",
      path: "source.psd/Duplicate/Pixel",
      fingerprint: "duplicate-child-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "layer:duplicate-child",
        sourcePath: "Duplicate/Pixel",
        nativeVisible: true,
      },
    },
    "orphan-pixel": {
      sourceId: "orphan-pixel",
      kind: "psd-node",
      displayName: "Orphan Pixel",
      path: "source.psd/Missing/Pixel",
      fingerprint: "orphan-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        documentSourceId: "psd-document",
        sourceKey: "layer:orphan",
        sourcePath: "Missing/Pixel",
        nativeVisible: true,
      },
    },
    "audio-source": {
      sourceId: "audio-source",
      kind: "audio",
      displayName: "Voice.wav",
      path: "/voice.wav",
      fingerprint: "audio-v1",
      version: 2,
      availability: "available",
      refresh: refresh(),
      data: {
        fileName: "voice.wav",
        mimeType: "audio/wav",
        durationFrames: 120,
      },
    },
    "video-source": {
      sourceId: "video-source",
      kind: "video",
      displayName: "Future.mov",
      path: "/future.mov",
      fingerprint: "video-v1",
      version: 1,
      availability: "missing",
      refresh: {
        status: "missing",
        reconnectHint: {
          fileName: "future.mov",
          path: "/future.mov",
        },
      },
      data: {
        fileName: "future.mov",
        mimeType: "video/quicktime",
        durationFrames: 120,
        width: 1920,
        height: 1080,
      },
    },
    "unused-unknown": {
      sourceId: "unused-unknown",
      kind: "unknown",
      displayName: "Unused plugin resource",
      path: null,
      fingerprint: "plugin-v1",
      version: 1,
      availability: "available",
      refresh: refresh(),
      data: {
        originalKind: "plugin",
        rawData: { preserved: true },
      },
    },
  };
}

function projectFixture(): LayerDocumentProject {
  const rootCommon = common(null, 0, null, 0);
  rootCommon.effects = [];
  rootCommon.modifiers = [];
  const layers: Record<string, LayerDocument> = {
    root: {
      layerDocumentId: "root",
      name: "Project root edit",
      revision: 0,
      type: "group",
      common: rootCommon,
      data: {
        role: "project-root",
        width: 1080,
        height: 1920,
        frameRate: 30,
        durationFrames: 120,
      },
    },
    "layer-a": {
      layerDocumentId: "layer-a",
      name: "Layer edit A",
      revision: 3,
      type: "psd",
      common: common(
        "root",
        0,
        { sourceId: "shared-node" },
        1
      ),
      data: {},
    },
    "layer-b": {
      layerDocumentId: "layer-b",
      name: "Layer edit B",
      revision: 8,
      type: "psd",
      common: common(
        "root",
        1,
        { sourceId: "shared-node" },
        2
      ),
      data: {},
    },
    "layer-c": {
      layerDocumentId: "layer-c",
      name: "Nested source layer edit",
      revision: 5,
      type: "psd",
      common: common(
        "root",
        2,
        { sourceId: "group-a-pixel" },
        4
      ),
      data: {},
    },
    audio: {
      layerDocumentId: "audio",
      name: "Audio edit",
      revision: 2,
      type: "audio",
      common: common(
        "root",
        3,
        { sourceId: "audio-source" },
        3
      ),
      data: {},
    },
  };
  return {
    metadata: {
      schemaVersion: LAYER_DOCUMENT_PROJECT_SCHEMA_VERSION,
      projectId: "source-preparation",
      name: "Source preparation",
    },
    payload: {
      layerDocumentsById: layers,
      sourceRegistry: {
        sourcesById: sourceFixture(),
      },
    },
  };
}

function assertSuccess(
  result: LayerDocumentSourceTransactionResult
) {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error.message);
  return result.transaction;
}

const project = projectFixture();
const projectSnapshot = structuredClone(project);
assert.deepEqual(validateLayerDocumentProject(project), []);

const sourceSelection: PsdTreeSourceSelection = {
  kind: "psd-tree-source",
  sourceId: "shared-node",
};
const layerSelection: LayerDocumentSelection = {
  kind: "layer-document",
  layerDocumentId: "layer-a",
};
assert.notEqual(sourceSelection.kind, layerSelection.kind);
assert.notEqual(
  "sourceId" in sourceSelection,
  "sourceId" in layerSelection
);

const tree = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.query.readTree({
  project,
  selection: sourceSelection,
});
assert.equal(tree.selectionKind, "psd-tree-source");
assert.equal(tree.selectionStatus, "selected");
assert.equal(tree.selectedSourceId, "shared-node");
assert.equal(tree.documents.length, 3);
assert.equal(tree.documents[0].sourceId, "psd-document");
assert.deepEqual(
  tree.documents[0].children.map((node) => node.sourceId),
  [
    "duplicate-group-a",
    "duplicate-group-b",
    "group-a",
    "group-b",
    "production-group",
    "shared-node",
  ]
);
const groupA = tree.documents[0].children[2];
const groupB = tree.documents[0].children[3];
const productionGroup = tree.documents[0].children[4];
const sharedTreeNode = tree.documents[0].children[5];
assert.equal(sharedTreeNode.displayName, "Registry pixel node");
assert.equal(sharedTreeNode.path, "source.psd/Pixel");
assert.equal(sharedTreeNode.availability, "available");
assert.deepEqual(
  groupA.children.map((node) => node.sourceId),
  ["nested-group", "group-a-pixel"]
);
assert.deepEqual(
  groupA.children[0].children.map((node) => node.sourceId),
  ["nested-pixel"]
);
assert.deepEqual(
  groupB.children.map((node) => node.sourceId),
  ["group-b-pixel"]
);
assert.deepEqual(
  productionGroup.children.map((node) => node.sourceId),
  ["production-layer"]
);
assert.equal(productionGroup.orphanReason, null);
assert.deepEqual(
  tree.documents[1].children.map((node) => node.sourceId),
  ["null-root-layer"]
);
assert.deepEqual(
  tree.documents[2].children.map((node) => node.sourceId),
  ["path-root-group"]
);
assert.deepEqual(
  tree.documents[2].children[0].children.map((node) => node.sourceId),
  ["path-root-layer"]
);
assert.equal(groupA.displayName, groupB.displayName);
assert.equal(
  groupA.children[1].displayName,
  groupB.children[0].displayName
);
assert.deepEqual(
  tree.orphanNodes.map((node) => [
    node.sourceId,
    node.orphanReason,
  ]),
  [
    ["orphan-pixel", "missing-parent"],
    ["duplicate-child", "ambiguous-parent"],
  ]
);
assert.deepEqual(
  Object.fromEntries(
    tree.nonPsdSources.map((source) => [
      source.kind,
      source.treePolicy,
    ])
  ),
  {
    video: "resource-leaf",
    unknown: "preserved-resource-leaf",
    audio: "resource-leaf",
  }
);
const serializedTree = JSON.stringify(tree);
assert.doesNotMatch(
  serializedTree,
  /Layer edit|alias|placement|transform|animation|effect|modifier/
);
const staleTree = buildPsdSourceTreeReadModel({
  project,
  selection: {
    kind: "psd-tree-source",
    sourceId: "stale-source",
  },
});
assert.equal(staleTree.selectionStatus, "stale");
assert.equal(staleTree.selectedSourceId, null);

const newDocument: SourceRegistryRecord = {
  sourceId: "import-document",
  kind: "psd-document",
  displayName: "Imported.psd",
  path: "/imported.psd",
  fingerprint: "import-document-v1",
  version: 1,
  availability: "available",
  refresh: refresh(),
  data: {
    fileName: "imported.psd",
    importSettings: {
      compositionName: "Imported",
      hiddenLayerMode: "preserve",
    },
  },
};
const newNode: SourceRegistryRecord = {
  sourceId: "import-node",
  kind: "psd-node",
  displayName: "Explicit layer node",
  path: "imported.psd/Explicit",
  fingerprint: "import-node-v1",
  version: 1,
  availability: "available",
  refresh: refresh(),
  data: {
    documentSourceId: "import-document",
    sourceKey: "layer:explicit",
    sourcePath: "Explicit",
    nativeVisible: true,
  },
};
const unplacedNode: SourceRegistryRecord = {
  sourceId: "import-unplaced-node",
  kind: "psd-node",
  displayName: "Registry only node",
  path: "imported.psd/Registry Only",
  fingerprint: "import-unplaced-v1",
  version: 1,
  availability: "available",
  refresh: refresh(),
  data: {
    documentSourceId: "import-document",
    sourceKey: "layer:unplaced",
    sourcePath: "Registry Only",
    nativeVisible: false,
  },
};
const importedLayer: LayerDocument = {
  layerDocumentId: "import-layer",
  name: "Explicit imported edit",
  revision: 99,
  type: "psd",
  common: common(
    "root",
    1,
    { sourceId: "import-node" },
    11
  ),
  data: {},
};
const importCommand: ImportSourceRegistryCommand = {
  sources: [newDocument, newNode, unplacedNode],
  layers: [importedLayer],
  selectSourceId: "import-node",
  selectLayerDocumentId: "import-layer",
};
const imported = assertSuccess(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareImport(
    project,
    importCommand
  )
);
assert.equal(imported.kind, "import-sources-and-layers");
assert.equal(imported.historyPolicy, "record-entry");
assert.equal(imported.historyEntryCount, 1);
assert.equal(imported.clearHistory, false);
assert.deepEqual(imported.createdSourceIds, [
  "import-document",
  "import-node",
  "import-unplaced-node",
]);
assert.deepEqual(imported.createdLayerDocumentIds, ["import-layer"]);
assert.deepEqual(imported.sourceSelectionChange, {
  kind: "select",
  selection: {
    kind: "psd-tree-source",
    sourceId: "import-node",
  },
});
assert.deepEqual(imported.layerSelectionChange, {
  kind: "select",
  layerDocumentId: "import-layer",
});
assert.equal(
  imported.after.payload.layerDocumentsById["import-layer"].revision,
  0
);
assert.equal(
  imported.after.payload.layerDocumentsById["import-layer"]
    .common.placement.order,
  1
);
assert.equal(
  imported.after.payload.layerDocumentsById["layer-b"]
    .common.placement.order,
  2
);
assert.equal(
  imported.after.payload.layerDocumentsById["layer-b"].revision,
  project.payload.layerDocumentsById["layer-b"].revision + 1
);
assert.equal(
  Object.values(imported.after.payload.layerDocumentsById).some(
    (layer) =>
      layer.common.source?.sourceId === "import-unplaced-node"
  ),
  false
);
assert.equal(
  imported.after.payload.sourceRegistry.sourcesById[
    "import-unplaced-node"
  ]?.kind,
  "psd-node"
);
assert.deepEqual(imported.historyEntry?.affectedSourceIds, [
  "import-document",
  "import-node",
  "import-unplaced-node",
]);
assert.deepEqual(imported.historyEntry?.affectedLayerDocumentIds, [
  "audio",
  "import-layer",
  "layer-b",
  "layer-c",
]);
assert.deepEqual(project, projectSnapshot);
assert.equal(findNonPlainDataPath(imported.after), null);
assert.deepEqual(validateLayerDocumentProject(imported.after), []);

const sourceConflict = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT
  .commands.prepareImport(project, {
    ...importCommand,
    sources: [project.payload.sourceRegistry.sourcesById["shared-node"]],
    layers: [],
    selectSourceId: "shared-node",
    selectLayerDocumentId: null,
  });
assert.equal(sourceConflict.ok, false);
if (!sourceConflict.ok) {
  assert.equal(sourceConflict.error.code, "source-id-conflict");
  assert.strictEqual(sourceConflict.project, project);
}
const badReferenceNode: SourceRegistryRecord = {
  ...newNode,
  sourceId: "bad-reference-node",
  data: {
    ...newNode.data,
    documentSourceId: "audio-source",
  },
};
const badReference = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
  .prepareImport(project, {
    sources: [badReferenceNode],
    layers: [],
    selectSourceId: "bad-reference-node",
    selectLayerDocumentId: null,
  });
assert.equal(badReference.ok, false);
if (!badReference.ok) {
  assert.equal(badReference.error.code, "source-reference-conflict");
}
const wrongImportKind = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
  .prepareImport(project, {
    sources: [{
      ...project.payload.sourceRegistry.sourcesById["audio-source"],
      sourceId: "import-audio",
    }],
    layers: [],
    selectSourceId: "import-audio",
    selectLayerDocumentId: null,
  });
assert.equal(wrongImportKind.ok, false);
if (!wrongImportKind.ok) {
  assert.equal(wrongImportKind.error.code, "source-kind-conflict");
}
const runtimeImport = {
  ...importCommand,
  sources: [{
    ...newNode,
    sourceId: "runtime-node",
    data: {
      ...newNode.data,
      runtimeHandle: new Map(),
    },
  }],
  layers: [],
  selectSourceId: "runtime-node",
  selectLayerDocumentId: null,
} as unknown as ImportSourceRegistryCommand;
const runtimeRejected = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
  .prepareImport(project, runtimeImport);
assert.equal(runtimeRejected.ok, false);
if (!runtimeRejected.ok) {
  assert.equal(runtimeRejected.error.code, "invalid-input");
}
assert.deepEqual(project, projectSnapshot);

const cacheContext: SourceRegistryCacheInvalidationContext = {
  globalFrame: 12,
  localFrameByLayerDocumentId: {
    "layer-a": 5,
    "layer-b": 7,
  },
  quality: "preview",
};
const sharedSource =
  project.payload.sourceRegistry.sourcesById["shared-node"];
assert.equal(sharedSource.kind, "psd-node");
const refreshedSource: SourceRegistryRecord = {
  ...sharedSource,
  displayName: "Registry pixel node refreshed",
  path: "source.psd/Pixel Refreshed",
  fingerprint: "pixel-v2",
  version: sharedSource.version + 1,
  availability: "available",
  refresh: {
    status: "updated",
    reconnectHint: {
      fileName: "source.psd",
      path: "/source.psd",
    },
  },
  data: {
    ...sharedSource.data,
    sourcePath: "Pixel Refreshed",
    nativeVisible: false,
  },
};
const refreshed = assertSuccess(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareRefresh(
    project,
    {
      source: refreshedSource,
      cacheContext,
    }
  )
);
assert.equal(refreshed.kind, "refresh-source");
assert.equal(refreshed.historyPolicy, "clear-history");
assert.equal(refreshed.historyEntryCount, 0);
assert.equal(refreshed.historyEntry, null);
assert.equal(refreshed.clearHistory, true);
assert.equal(
  refreshed.after.payload.sourceRegistry.sourcesById["shared-node"]
    .sourceId,
  "shared-node"
);
assert.equal(
  refreshed.after.payload.sourceRegistry.sourcesById["shared-node"].kind,
  "psd-node"
);
assert.equal(
  refreshed.after.payload.sourceRegistry.sourcesById["shared-node"]
    .version,
  sharedSource.version + 1
);
assert.deepEqual(
  refreshed.after.payload.layerDocumentsById,
  project.payload.layerDocumentsById
);
assert.equal(refreshed.cacheInvalidations.length, 2);
for (const invalidation of refreshed.cacheInvalidations) {
  assert.equal(invalidation.sourceId, "shared-node");
  assert.equal(
    invalidation.layerRevisionBefore,
    invalidation.layerRevisionAfter
  );
  assert.notEqual(
    invalidation.sourceResourceCacheKeyBefore,
    invalidation.sourceResourceCacheKeyAfter
  );
  assert.notEqual(
    invalidation.layerResultCacheKeyBefore,
    invalidation.layerResultCacheKeyAfter
  );
}
for (const layerDocumentId of ["layer-a", "layer-b"]) {
  assert.equal(
    refreshed.after.payload.layerDocumentsById[layerDocumentId]
      .common.source?.sourceId,
    "shared-node"
  );
}
const sameRefresh = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
  .prepareRefresh(project, {
    source: structuredClone(sharedSource),
    cacheContext,
  });
assert.equal(sameRefresh.ok, false);
if (!sameRefresh.ok) assert.equal(sameRefresh.error.code, "no-change");
const skippedVersion = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
  .prepareRefresh(project, {
    source: {
      ...refreshedSource,
      version: sharedSource.version + 2,
    },
    cacheContext,
  });
assert.equal(skippedVersion.ok, false);
if (!skippedVersion.ok) {
  assert.equal(skippedVersion.error.code, "version-not-monotonic");
}
const changedKindRefresh = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
  .prepareRefresh(project, {
    source: {
      ...project.payload.sourceRegistry.sourcesById["audio-source"],
      sourceId: "shared-node",
      version: sharedSource.version + 1,
    },
    cacheContext,
  });
assert.equal(changedKindRefresh.ok, false);
if (!changedKindRefresh.ok) {
  assert.equal(changedKindRefresh.error.code, "source-kind-conflict");
}
for (const changedIdentityData of [
  {
    ...sharedSource.data,
    documentSourceId: "other-document",
  },
  {
    ...sharedSource.data,
    sourceKey: "layer:replacement-identity",
  },
]) {
  const changedIdentityRefresh =
    LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareRefresh(
      project,
      {
        source: {
          ...refreshedSource,
          data: changedIdentityData,
        },
        cacheContext,
      }
    );
  assert.equal(changedIdentityRefresh.ok, false);
  if (!changedIdentityRefresh.ok) {
    assert.equal(
      changedIdentityRefresh.error.code,
      "source-identity-conflict"
    );
    assert.strictEqual(changedIdentityRefresh.project, project);
  }
}

const missing = assertSuccess(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareMissing(
    project,
    {
      sourceId: "shared-node",
      reconnectHint: {
        fileName: "source.psd",
        path: "/source.psd",
      },
      cacheContext,
    }
  )
);
assert.equal(missing.kind, "mark-source-missing");
assert.equal(missing.historyPolicy, "clear-history");
assert.equal(missing.historyEntryCount, 0);
assert.equal(
  missing.after.payload.sourceRegistry.sourcesById["shared-node"]
    .availability,
  "missing"
);
assert.equal(
  missing.after.payload.sourceRegistry.sourcesById["shared-node"]
    .refresh.status,
  "missing"
);
assert.equal(
  missing.after.payload.sourceRegistry.sourcesById["shared-node"]
    .version,
  sharedSource.version + 1
);
assert.deepEqual(
  missing.after.payload.layerDocumentsById,
  project.payload.layerDocumentsById
);
const repeatedMissing = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
  .prepareMissing(missing.after, {
    sourceId: "shared-node",
    reconnectHint: {
      fileName: "source.psd",
      path: "/source.psd",
    },
    cacheContext,
  });
assert.equal(repeatedMissing.ok, false);
if (!repeatedMissing.ok) {
  assert.equal(repeatedMissing.error.code, "no-change");
}

const missingSource =
  missing.after.payload.sourceRegistry.sourcesById["shared-node"];
assert.equal(missingSource.kind, "psd-node");
const reconnectSource: SourceRegistryRecord = {
  ...missingSource,
  displayName: "Registry pixel node reconnected",
  path: "/reconnected/source.psd/Pixel",
  fingerprint: "pixel-reconnected",
  version: missingSource.version + 1,
  availability: "available",
  refresh: {
    status: "normal",
    reconnectHint: {
      fileName: "source.psd",
      path: "/reconnected/source.psd",
    },
  },
  data: {
    ...missingSource.data,
    sourcePath: "Pixel",
    nativeVisible: true,
  },
};
const reconnected = assertSuccess(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareReconnect(
    missing.after,
    {
      source: reconnectSource,
      cacheContext,
    }
  )
);
assert.equal(reconnected.kind, "reconnect-source");
assert.equal(reconnected.historyPolicy, "clear-history");
assert.equal(reconnected.historyEntryCount, 0);
assert.equal(
  reconnected.after.payload.sourceRegistry.sourcesById["shared-node"]
    .sourceId,
  "shared-node"
);
assert.equal(
  reconnected.after.payload.sourceRegistry.sourcesById["shared-node"]
    .availability,
  "available"
);
assert.deepEqual(
  reconnected.after.payload.layerDocumentsById,
  project.payload.layerDocumentsById
);
const changedIdentityReconnect =
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareReconnect(
    missing.after,
    {
      source: {
        ...reconnectSource,
        data: {
          ...reconnectSource.data,
          sourceKey: "layer:reconnect-replacement",
        },
      },
      cacheContext,
    }
  );
assert.equal(changedIdentityReconnect.ok, false);
if (!changedIdentityReconnect.ok) {
  assert.equal(
    changedIdentityReconnect.error.code,
    "source-identity-conflict"
  );
}

const psdDocumentSource =
  project.payload.sourceRegistry.sourcesById["psd-document"];
const groupAPixelSource =
  project.payload.sourceRegistry.sourcesById["group-a-pixel"];
assert.equal(psdDocumentSource.kind, "psd-document");
assert.equal(groupAPixelSource.kind, "psd-node");
if (
  psdDocumentSource.kind !== "psd-document" ||
  groupAPixelSource.kind !== "psd-node"
) {
  throw new Error("Invalid PSD batch fixture");
}
const batchDocument = {
  ...psdDocumentSource,
  fingerprint: "document-v2",
  version: psdDocumentSource.version + 1,
  refresh: {
    status: "updated" as const,
    reconnectHint: null,
  },
};
const batchSharedNode = {
  ...sharedSource,
  displayName: "Batch refreshed pixel",
  fingerprint: "pixel-batch-v2",
  version: sharedSource.version + 1,
  refresh: {
    status: "updated" as const,
    reconnectHint: null,
  },
  data: {
    ...sharedSource.data,
    sourcePath: "Pixel Batch Refreshed",
    nativeVisible: false,
  },
};
const batchRemovedNode = {
  ...groupAPixelSource,
  fingerprint: "group-a-pixel-removed",
  version: groupAPixelSource.version + 1,
  refresh: {
    status: "deletePending" as const,
    reconnectHint: null,
  },
};
const batchDiscoveredNode = {
  sourceId: "batch-discovered-node",
  kind: "psd-node" as const,
  displayName: "Batch discovered node",
  path: "source.psd/Batch Discovered",
  fingerprint: "batch-discovered-v1",
  version: 1,
  availability: "available" as const,
  refresh: {
    status: "new" as const,
    reconnectHint: null,
  },
  data: {
    documentSourceId: "psd-document",
    sourceKey: "layer:batch-discovered",
    sourcePath: "Batch Discovered",
    nativeVisible: true,
  },
};
const batchCommand = {
  documentSource: batchDocument,
  nodeSources: [
    batchSharedNode,
    batchRemovedNode,
    batchDiscoveredNode,
  ],
  cacheContext,
};
const batchCommandSnapshot = structuredClone(batchCommand);
const batchRefreshed = assertSuccess(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.preparePsdRefresh(
    project,
    batchCommand
  )
);
assert.equal(batchRefreshed.kind, "refresh-psd-document");
assert.equal(batchRefreshed.historyPolicy, "clear-history");
assert.equal(batchRefreshed.historyEntryCount, 0);
assert.equal(batchRefreshed.historyEntry, null);
assert.equal(batchRefreshed.clearHistory, true);
assert.deepEqual(
  batchRefreshed.createdSourceIds,
  ["batch-discovered-node"]
);
assert.deepEqual(
  batchRefreshed.after.payload.layerDocumentsById,
  project.payload.layerDocumentsById
);
assert.deepEqual(
  Object.keys(
    batchRefreshed.after.payload.sourceRegistry.sourcesById
  )
    .filter((sourceId) =>
      JSON.stringify(
        project.payload.sourceRegistry.sourcesById[sourceId]
      ) !== JSON.stringify(
        batchRefreshed.after.payload.sourceRegistry.sourcesById[
          sourceId
        ]
      )
    )
    .sort(),
  [
    "batch-discovered-node",
    "group-a-pixel",
    "psd-document",
    "shared-node",
  ]
);
assert.equal(
  batchRefreshed.after.payload.sourceRegistry.sourcesById[
    "group-a-pixel"
  ].refresh.status,
  "deletePending"
);
assert.equal(
  Object.values(batchRefreshed.after.payload.layerDocumentsById).some(
    (layer) =>
      layer.common.source?.sourceId === "batch-discovered-node"
  ),
  false
);
assert.deepEqual(
  batchRefreshed.cacheInvalidations.map((descriptor) => [
    descriptor.sourceId,
    descriptor.layerDocumentId,
  ]),
  [
    ["group-a-pixel", "layer-c"],
    ["shared-node", "layer-a"],
    ["shared-node", "layer-b"],
  ]
);
for (const invalidation of batchRefreshed.cacheInvalidations) {
  assert.equal(
    invalidation.layerRevisionBefore,
    invalidation.layerRevisionAfter
  );
  assert.notEqual(
    invalidation.sourceResourceCacheKeyBefore,
    invalidation.sourceResourceCacheKeyAfter
  );
  assert.notEqual(
    invalidation.layerResultCacheKeyBefore,
    invalidation.layerResultCacheKeyAfter
  );
}
assert.deepEqual(project, projectSnapshot);
assert.deepEqual(batchCommand, batchCommandSnapshot);
assert.equal(findNonPlainDataPath(batchRefreshed.after), null);
assert.deepEqual(
  validateLayerDocumentProject(batchRefreshed.after),
  []
);

const invalidBatchCommand = {
  ...batchCommand,
  nodeSources: [
    batchSharedNode,
    {
      ...batchRemovedNode,
      data: {
        ...batchRemovedNode.data,
        sourceKey: "layer:illegal-replacement",
      },
    },
  ],
};
const invalidBatchSnapshot = structuredClone(invalidBatchCommand);
const rejectedBatch =
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.preparePsdRefresh(
    project,
    invalidBatchCommand
  );
assert.equal(rejectedBatch.ok, false);
if (!rejectedBatch.ok) {
  assert.equal(
    rejectedBatch.error.code,
    "source-identity-conflict"
  );
  assert.strictEqual(rejectedBatch.project, project);
}
assert.deepEqual(project, projectSnapshot);
assert.deepEqual(invalidBatchCommand, invalidBatchSnapshot);

const wrongDocumentBatch =
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.preparePsdRefresh(
    project,
    {
      ...batchCommand,
      nodeSources: [{
        ...batchDiscoveredNode,
        sourceId: "wrong-document-node",
        data: {
          ...batchDiscoveredNode.data,
          documentSourceId: "other-document",
        },
      }],
    }
  );
assert.equal(wrongDocumentBatch.ok, false);
if (!wrongDocumentBatch.ok) {
  assert.equal(
    wrongDocumentBatch.error.code,
    "source-reference-conflict"
  );
}
for (const versionConflictCommand of [
  {
    ...batchCommand,
    documentSource: {
      ...batchDocument,
      version: psdDocumentSource.version + 2,
    },
  },
  {
    ...batchCommand,
    nodeSources: [{
      ...batchSharedNode,
      version: sharedSource.version + 2,
    }],
  },
]) {
  const versionConflict =
    LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.preparePsdRefresh(
      project,
      versionConflictCommand
    );
  assert.equal(versionConflict.ok, false);
  if (!versionConflict.ok) {
    assert.equal(
      versionConflict.error.code,
      "version-not-monotonic"
    );
  }
}
const batchNewIdConflict =
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.preparePsdRefresh(
    project,
    {
      ...batchCommand,
      nodeSources: [{
        ...batchDiscoveredNode,
        sourceId: "audio-source",
      }],
    }
  );
assert.equal(batchNewIdConflict.ok, false);
if (!batchNewIdConflict.ok) {
  assert.equal(
    batchNewIdConflict.error.code,
    "source-id-conflict"
  );
}
assert.deepEqual(project, projectSnapshot);

const discoveredNode: SourceRegistryRecord = {
  ...newNode,
  sourceId: "discovered-node",
  displayName: "Discovered registry node",
  data: {
    ...newNode.data,
    documentSourceId: "psd-document",
    sourceKey: "layer:discovered",
  },
};
const discovered = assertSuccess(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareDiscovery(
    project,
    {
      sources: [discoveredNode],
    }
  )
);
assert.equal(discovered.kind, "discover-psd-nodes");
assert.equal(discovered.historyPolicy, "clear-history");
assert.equal(discovered.historyEntryCount, 0);
assert.deepEqual(discovered.createdSourceIds, ["discovered-node"]);
assert.deepEqual(
  discovered.after.payload.layerDocumentsById,
  project.payload.layerDocumentsById
);
assert.equal(
  Object.values(discovered.after.payload.layerDocumentsById).some(
    (layer) =>
      layer.common.source?.sourceId === "discovered-node"
  ),
  false
);
assert.equal(
  buildPsdSourceTreeReadModel({
    project: discovered.after,
    selection: null,
  }).documents[0].children.some(
    (node) => node.sourceId === "discovered-node"
  ),
  true
);

for (const sourceId of ["shared-node", "psd-document", "audio-source"]) {
  const blockedDelete = LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands
    .prepareDelete(project, { sourceId });
  assert.equal(blockedDelete.ok, false);
  if (!blockedDelete.ok) {
    assert.equal(blockedDelete.error.code, "source-is-referenced");
    assert.strictEqual(blockedDelete.project, project);
  }
}
const deleted = assertSuccess(
  LAYER_DOCUMENT_SOURCE_PREPARATION_PORT.commands.prepareDelete(
    project,
    { sourceId: "unused-unknown" }
  )
);
assert.equal(deleted.kind, "delete-source");
assert.equal(deleted.historyPolicy, "record-entry");
assert.equal(deleted.historyEntryCount, 1);
assert.equal(deleted.clearHistory, false);
assert.deepEqual(deleted.deletedSourceIds, ["unused-unknown"]);
assert.equal(
  deleted.after.payload.sourceRegistry.sourcesById["unused-unknown"],
  undefined
);
assert.deepEqual(
  deleted.after.payload.layerDocumentsById,
  project.payload.layerDocumentsById
);
assert.deepEqual(deleted.sourceSelectionChange, {
  kind: "clear-if-selected",
  sourceId: "unused-unknown",
});
assert.deepEqual(deleted.historyEntry?.affectedSourceIds, [
  "unused-unknown",
]);
assert.deepEqual(deleted.historyEntry?.affectedLayerDocumentIds, []);
assert.equal(findNonPlainDataPath(deleted.after), null);
assert.deepEqual(validateLayerDocumentProject(deleted.after), []);
assert.deepEqual(project, projectSnapshot);

const missingHistoryEntry = completeSourceTransaction({
  kind: "delete-source",
  before: project,
  after: project,
  sourceSelectionChange: { kind: "preserve" },
  historyPolicy: "record-entry",
});
assert.equal(missingHistoryEntry.ok, false);
if (!missingHistoryEntry.ok) {
  assert.equal(
    missingHistoryEntry.error.code,
    "internal-invalid-transaction"
  );
}
const mismatchedHistoryDiff = completeSourceTransaction({
  kind: "delete-source",
  before: project,
  after: deleted.after,
  sourceSelectionChange: { kind: "preserve" },
  historyPolicy: "record-entry",
  historyEntry: {
    label: "Invalid fixture",
    affectedSourceIds: [],
    affectedLayerDocumentIds: [],
  },
  deletedSourceIds: ["unused-unknown"],
});
assert.equal(mismatchedHistoryDiff.ok, false);
if (!mismatchedHistoryDiff.ok) {
  assert.equal(
    mismatchedHistoryDiff.error.code,
    "internal-invalid-transaction"
  );
}

const taskFiles = [
  "src/engines/project/models/layerDocumentSourcePreparationModel.ts",
  "src/engines/project/helpers/layerDocumentSourceTreeHelpers.ts",
  "src/engines/project/actions/layerDocumentSourceTransactionHelpers.ts",
  "src/engines/project/actions/layerDocumentSourceImportTransaction.ts",
  "src/engines/project/actions/layerDocumentSourceLifecycleTransactions.ts",
  "src/engines/project/actions/layerDocumentPsdRefreshTransaction.ts",
  "src/engines/project/actions/layerDocumentSourceDeleteTransaction.ts",
  "src/engines/project/actions/layerDocumentSourceTransactions.ts",
  "src/engines/project/adapters/layerDocumentSourcePreparationAdapter.ts",
];
taskFiles.forEach((path) => {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(
    source,
    /@\/editor|@\/features|ProjectSourceDomainPort|useState|useReducer/
  );
  assert.doesNotMatch(
    source,
    /setProject|setComps|setTimelineItems|commitTransaction\s*\(/
  );
  assert.doesNotMatch(
    source,
    /\bHTMLCanvasElement\b|\bImageBitmap\b|\bFileSystemFileHandle\b/
  );
});
const compositionRootSource = readFileSync(
  "src/editor/useEditorCompositionRoot.ts",
  "utf8"
);
const productPsdTreeSource = readFileSync(
  "src/features/psdtree/components/PsdTree.tsx",
  "utf8"
);
assert.doesNotMatch(
  compositionRootSource,
  /LAYER_DOCUMENT_SOURCE_PREPARATION_PORT|prepareSourceRegistryImport/
);
assert.doesNotMatch(
  productPsdTreeSource,
  /LAYER_DOCUMENT_SOURCE_PREPARATION_PORT|buildPsdSourceTreeReadModel/
);

console.log("Layer Document Source preparation verification passed");
