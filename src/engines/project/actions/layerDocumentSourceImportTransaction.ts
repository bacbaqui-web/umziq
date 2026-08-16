import type {
  LayerDocument,
  LayerDocumentProject,
} from "@/models";
import {
  assignSiblingLayerDocumentOrder,
  completeLayerDocumentTransaction,
  insertLayerDocumentAtOrder,
  sortedSiblingLayerDocumentIds,
} from "@/models/layerDocumentTransactionHelpers";
import type {
  ImportSourceRegistryCommand,
  LayerDocumentSourceTransactionResult,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";
import {
  cloneSourceTransactionData,
  completeSourceTransaction,
  failSourceTransaction,
  plainDataValuesEqual,
  validateSourceCommandPlainData,
  validateSourceTransactionAfter,
  validateSourceTransactionBefore,
} from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";

function addImportedLayers(options: {
  before: LayerDocumentProject;
  afterWithSources: LayerDocumentProject;
  layers: readonly LayerDocument[];
}): LayerDocumentSourceTransactionResult | LayerDocumentProject {
  const after = cloneSourceTransactionData(options.afterWithSources);
  const inputIds = new Set<string>();
  for (const layer of options.layers) {
    if (
      inputIds.has(layer.layerDocumentId) ||
      after.payload.layerDocumentsById[layer.layerDocumentId]
    ) {
      return failSourceTransaction(
        options.before,
        "layer-id-conflict",
        `Layer Document ID already exists: ${layer.layerDocumentId}`
      );
    }
    inputIds.add(layer.layerDocumentId);
    const parentId = layer.common.placement.parentLayerDocumentId;
    const parent = parentId
      ? after.payload.layerDocumentsById[parentId]
      : null;
    if (!parent || parent.type !== "group") {
      return failSourceTransaction(
        options.before,
        "layer-transaction-error",
        `Import parent Group not found: ${parentId ?? "<null>"}`
      );
    }
    if (
      !Number.isInteger(layer.common.placement.order) ||
      layer.common.placement.order < 0
    ) {
      return failSourceTransaction(
        options.before,
        "layer-transaction-error",
        "Imported Layer order must be a non-negative integer"
      );
    }
    const siblingIds = sortedSiblingLayerDocumentIds(after, parentId);
    after.payload.layerDocumentsById[layer.layerDocumentId] =
      cloneSourceTransactionData(layer);
    assignSiblingLayerDocumentOrder(
      after,
      parentId,
      insertLayerDocumentAtOrder(
        siblingIds,
        layer.layerDocumentId,
        layer.common.placement.order
      )
    );
  }
  if (options.layers.length === 0) {
    const invalid = validateSourceTransactionAfter(
      options.before,
      after
    );
    return invalid ?? after;
  }
  const completed = completeLayerDocumentTransaction({
    kind: "create-layer",
    before: options.before,
    after,
    selectionChange: { kind: "preserve" },
    historyEntry: {
      label: "Prepare imported Layer Documents",
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: options.layers.map(
      (layer) => layer.layerDocumentId
    ),
    deletedLayerDocumentIds: [],
  });
  if (!completed.ok) {
    return failSourceTransaction(
      options.before,
      completed.error.code === "invalid-after"
        ? "invalid-output"
        : "layer-transaction-error",
      completed.error.message
    );
  }
  return completed.transaction.after;
}

export function prepareSourceRegistryImport(
  project: LayerDocumentProject,
  command: ImportSourceRegistryCommand
): LayerDocumentSourceTransactionResult {
  const invalid = validateSourceTransactionBefore(project) ??
    validateSourceCommandPlainData(project, command);
  if (invalid) return invalid;
  if (command.sources.length === 0) {
    return failSourceTransaction(
      project,
      "invalid-input",
      "Import must provide at least one Source Registry record"
    );
  }
  const afterWithSources = cloneSourceTransactionData(project);
  const createdSourceIds = new Set<string>();
  for (const source of command.sources) {
    if (
      source.kind !== "psd-document" &&
      source.kind !== "psd-node"
    ) {
      return failSourceTransaction(
        project,
        "source-kind-conflict",
        `PSD import cannot create Source kind ${source.kind}`
      );
    }
    if (
      createdSourceIds.has(source.sourceId) ||
      afterWithSources.payload.sourceRegistry.sourcesById[source.sourceId]
    ) {
      return failSourceTransaction(
        project,
        "source-id-conflict",
        `Source ID already exists: ${source.sourceId}`
      );
    }
    createdSourceIds.add(source.sourceId);
    afterWithSources.payload.sourceRegistry.sourcesById[source.sourceId] =
      cloneSourceTransactionData(source);
  }
  if (!createdSourceIds.has(command.selectSourceId)) {
    return failSourceTransaction(
      project,
      "invalid-selection",
      "Import source selection must target a created Source"
    );
  }
  if (
    command.selectLayerDocumentId !== null &&
    !command.layers.some(
      (layer) =>
        layer.layerDocumentId === command.selectLayerDocumentId
    )
  ) {
    return failSourceTransaction(
      project,
      "invalid-selection",
      "Import Layer selection must target a created Layer Document"
    );
  }
  const layerResult = addImportedLayers({
    before: project,
    afterWithSources,
    layers: command.layers,
  });
  if ("ok" in layerResult) return layerResult;
  const invalidAfter = validateSourceTransactionAfter(
    project,
    layerResult
  );
  if (invalidAfter) return invalidAfter;
  const createdLayerDocumentIds = command.layers
    .map((layer) => layer.layerDocumentId)
    .sort();
  const affectedLayerDocumentIds = Object.keys(
    layerResult.payload.layerDocumentsById
  )
    .filter((layerDocumentId) => {
      const before = project.payload.layerDocumentsById[layerDocumentId];
      const after = layerResult.payload.layerDocumentsById[layerDocumentId];
      return !plainDataValuesEqual(before, after);
    })
    .sort();
  return completeSourceTransaction({
    kind: "import-sources-and-layers",
    before: project,
    after: layerResult,
    sourceSelectionChange: {
      kind: "select",
      selection: {
        kind: "library-source",
        sourceId: command.selectSourceId,
      },
    },
    layerSelectionChange: command.selectLayerDocumentId
      ? {
          kind: "select",
          layerDocumentId: command.selectLayerDocumentId,
        }
      : { kind: "preserve" },
    historyPolicy: "record-entry",
    historyEntry: {
      label: "Import PSD Sources",
      affectedSourceIds: [...createdSourceIds].sort(),
      affectedLayerDocumentIds,
    },
    createdSourceIds: [...createdSourceIds].sort(),
    createdLayerDocumentIds,
  });
}
