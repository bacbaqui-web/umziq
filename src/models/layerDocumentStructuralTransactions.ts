import type { LayerDocumentProject } from "@/models/layerDocumentModel";
import {
  type CreateLayerDocumentCommand,
  type DeleteLayerDocumentCommand,
  type DuplicateLayerDocumentCommand,
  type LayerDocumentTransactionResult,
  type MoveGroupLayerDocumentCommand,
  type ReplaceLayerDocumentSourceCommand,
} from "@/models/layerDocumentTransactionModel";
import {
  allocateDuplicateLayerDocumentDisplayName as allocateDuplicateDisplayName,
  allocateDescendantDuplicateLayerDocumentId as allocateDescendantDuplicateId,
  assignSiblingLayerDocumentOrder as assignSiblingOrder,
  cloneTransactionData as clonePlainData,
  collectLayerDocumentSubtreeIds as collectSubtreeIds,
  completeLayerDocumentTransaction as complete,
  failLayerDocumentTransaction as fail,
  findLayerDocument as layerById,
  insertLayerDocumentAtOrder as insertAtOrder,
  isGroupLayerDocument as isGroupLayer,
  isProjectRootLayer as isProjectRoot,
  sortedSiblingLayerDocumentIds as sortedSiblingIds,
  validateLayerDocumentTransactionInput as validateBefore,
} from "@/models/layerDocumentTransactionHelpers";

export function buildCreateLayerDocumentTransaction(
  project: LayerDocumentProject,
  command: CreateLayerDocumentCommand
): LayerDocumentTransactionResult {
  const invalid = validateBefore(project);
  if (invalid) return invalid;
  const layer = command.layer;
  if (!layer.layerDocumentId.trim()) {
    return fail(
      project,
      "invalid-command",
      "New Layer Document ID must be non-empty",
      []
    );
  }
  if (layerById(project, layer.layerDocumentId)) {
    return fail(
      project,
      "layer-id-conflict",
      `Layer Document ID already exists: ${layer.layerDocumentId}`,
      []
    );
  }
  if (isProjectRoot(layer)) {
    return fail(
      project,
      "root-operation-forbidden",
      "A transaction cannot create a second project-root",
      []
    );
  }
  const parentId = layer.common.placement.parentLayerDocumentId;
  if (!parentId || !isGroupLayer(layerById(project, parentId))) {
    return fail(
      project,
      "parent-group-not-found",
      `Target parent Group not found: ${parentId ?? "<null>"}`,
      []
    );
  }
  if (
    !Number.isInteger(layer.common.placement.order) ||
    layer.common.placement.order < 0
  ) {
    return fail(
      project,
      "invalid-command",
      "Create placement order must be a non-negative integer",
      []
    );
  }

  const after = clonePlainData(project);
  after.payload.layerDocumentsById[layer.layerDocumentId] =
    clonePlainData(layer);
  const siblings = sortedSiblingIds(project, parentId);
  assignSiblingOrder(
    after,
    parentId,
    insertAtOrder(
      siblings,
      layer.layerDocumentId,
      layer.common.placement.order
    )
  );

  return complete({
    kind: "create-layer",
    before: project,
    after,
    selectionChange: {
      kind: "select",
      layerDocumentId: layer.layerDocumentId,
    },
    historyEntry: {
      label: `Create ${layer.name}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [layer.layerDocumentId],
    deletedLayerDocumentIds: [],
  });
}

export function buildDeleteLayerDocumentTransaction(
  project: LayerDocumentProject,
  command: DeleteLayerDocumentCommand
): LayerDocumentTransactionResult {
  const invalid = validateBefore(project);
  if (invalid) return invalid;
  const layer = layerById(project, command.layerDocumentId);
  if (!layer) {
    return fail(
      project,
      "layer-not-found",
      `Layer Document not found: ${command.layerDocumentId}`,
      []
    );
  }
  if (isProjectRoot(layer)) {
    return fail(
      project,
      "root-operation-forbidden",
      "The project-root Layer cannot be deleted",
      []
    );
  }
  const parentId = layer.common.placement.parentLayerDocumentId;
  const deletedIds = collectSubtreeIds(project, layer.layerDocumentId);
  const deletedIdSet = new Set(deletedIds);
  const after = clonePlainData(project);
  deletedIds.forEach((layerDocumentId) => {
    delete after.payload.layerDocumentsById[layerDocumentId];
  });
  assignSiblingOrder(
    after,
    parentId,
    sortedSiblingIds(project, parentId, deletedIdSet)
  );

  return complete({
    kind: "delete-layer",
    before: project,
    after,
    selectionChange: { kind: "clear" },
    historyEntry: {
      label: `Delete ${layer.name}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: deletedIds,
  });
}

export function buildDuplicateLayerDocumentTransaction(
  project: LayerDocumentProject,
  command: DuplicateLayerDocumentCommand
): LayerDocumentTransactionResult {
  const invalid = validateBefore(project);
  if (invalid) return invalid;
  const sourceLayer = layerById(project, command.layerDocumentId);
  if (!sourceLayer) {
    return fail(
      project,
      "layer-not-found",
      `Layer Document not found: ${command.layerDocumentId}`,
      []
    );
  }
  if (isProjectRoot(sourceLayer)) {
    return fail(
      project,
      "root-operation-forbidden",
      "The project-root Layer cannot be duplicated",
      []
    );
  }
  if (!command.newLayerDocumentId.trim()) {
    return fail(
      project,
      "invalid-command",
      "Duplicate Layer Document ID must be non-empty",
      []
    );
  }
  if (layerById(project, command.newLayerDocumentId)) {
    return fail(
      project,
      "layer-id-conflict",
      `Layer Document ID already exists: ${command.newLayerDocumentId}`,
      []
    );
  }

  const subtreeIds = collectSubtreeIds(
    project,
    sourceLayer.layerDocumentId
  );
  const reservedIds = new Set(
    Object.keys(project.payload.layerDocumentsById)
  );
  reservedIds.add(command.newLayerDocumentId);
  const duplicateIdByOriginalId: Record<string, string> = {
    [sourceLayer.layerDocumentId]: command.newLayerDocumentId,
  };
  const duplicateDisplayName =
    allocateDuplicateDisplayName(project, sourceLayer);
  for (const originalId of subtreeIds.slice(1)) {
    const duplicateId = allocateDescendantDuplicateId(
      reservedIds,
      command.newLayerDocumentId,
      originalId
    );
    if (!duplicateId) {
      return fail(
        project,
        "layer-id-conflict",
        `Could not allocate descendant duplicate ID for ${originalId}`,
        []
      );
    }
    duplicateIdByOriginalId[originalId] = duplicateId;
  }

  const after = clonePlainData(project);
  subtreeIds.forEach((originalId) => {
    const original = project.payload.layerDocumentsById[originalId];
    const duplicate = clonePlainData(original);
    const duplicateId = duplicateIdByOriginalId[originalId];
    const originalParentId =
      original.common.placement.parentLayerDocumentId;
    duplicate.layerDocumentId = duplicateId;
    duplicate.revision = 0;
    duplicate.common.placement.parentLayerDocumentId =
      originalId === sourceLayer.layerDocumentId
        ? originalParentId
        : duplicateIdByOriginalId[originalParentId ?? ""];
    if (originalId === sourceLayer.layerDocumentId) {
      if (sourceLayer.common.placement.alias) {
        duplicate.common.placement.alias =
          duplicateDisplayName;
      } else {
        duplicate.name = duplicateDisplayName;
      }
    }
    after.payload.layerDocumentsById[duplicateId] = duplicate;
  });

  const parentId =
    sourceLayer.common.placement.parentLayerDocumentId;
  const originalSiblings = sortedSiblingIds(project, parentId);
  const sourceIndex = originalSiblings.indexOf(
    sourceLayer.layerDocumentId
  );
  const nextSiblings = [...originalSiblings];
  nextSiblings.splice(sourceIndex, 0, command.newLayerDocumentId);
  assignSiblingOrder(after, parentId, nextSiblings);

  const createdIds = subtreeIds.map(
    (originalId) => duplicateIdByOriginalId[originalId]
  );
  return complete({
    kind: "duplicate-layer",
    before: project,
    after,
    selectionChange: {
      kind: "select",
      layerDocumentId: command.newLayerDocumentId,
    },
    historyEntry: {
      label: `Duplicate ${sourceLayer.name}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: createdIds,
    deletedLayerDocumentIds: [],
  });
}

export function buildReplaceLayerDocumentSourceTransaction(
  project: LayerDocumentProject,
  command: ReplaceLayerDocumentSourceCommand
): LayerDocumentTransactionResult {
  const invalid = validateBefore(project);
  if (invalid) return invalid;
  const layer = layerById(project, command.layerDocumentId);
  if (!layer) {
    return fail(
      project,
      "layer-not-found",
      `Layer Document not found: ${command.layerDocumentId}`,
      []
    );
  }
  if (
    command.sourceId !== null &&
    !project.payload.sourceRegistry.sourcesById[command.sourceId]
  ) {
    return fail(
      project,
      "source-not-found",
      `Source Registry record not found: ${command.sourceId}`,
      []
    );
  }
  const after = clonePlainData(project);
  const nextLayer =
    after.payload.layerDocumentsById[command.layerDocumentId];
  nextLayer.common.source =
    command.sourceId === null ? null : { sourceId: command.sourceId };

  return complete({
    kind: "replace-source",
    before: project,
    after,
    selectionChange: { kind: "preserve" },
    historyEntry: {
      label: `Replace Source for ${layer.name}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: [],
  });
}

export function buildMoveGroupLayerDocumentTransaction(
  project: LayerDocumentProject,
  command: MoveGroupLayerDocumentCommand
): LayerDocumentTransactionResult {
  const invalid = validateBefore(project);
  if (invalid) return invalid;
  const group = layerById(project, command.layerDocumentId);
  if (!group) {
    return fail(
      project,
      "layer-not-found",
      `Layer Document not found: ${command.layerDocumentId}`,
      []
    );
  }
  if (!isGroupLayer(group)) {
    return fail(
      project,
      "target-not-group",
      `Move target is not a Group: ${command.layerDocumentId}`,
      []
    );
  }
  if (isProjectRoot(group)) {
    return fail(
      project,
      "root-operation-forbidden",
      "The project-root Group cannot be moved",
      []
    );
  }
  const nextParent = layerById(
    project,
    command.newParentLayerDocumentId
  );
  if (!isGroupLayer(nextParent)) {
    return fail(
      project,
      "parent-group-not-found",
      `Target parent Group not found: ${command.newParentLayerDocumentId}`,
      []
    );
  }
  if (!Number.isInteger(command.newOrder) || command.newOrder < 0) {
    return fail(
      project,
      "invalid-command",
      "Move order must be a non-negative integer",
      []
    );
  }
  const subtreeIds = new Set(
    collectSubtreeIds(project, group.layerDocumentId)
  );
  if (subtreeIds.has(nextParent.layerDocumentId)) {
    return fail(
      project,
      "cycle-detected",
      "A Group cannot move below itself or one of its descendants",
      []
    );
  }

  const oldParentId =
    group.common.placement.parentLayerDocumentId;
  const nextParentId = nextParent.layerDocumentId;
  const after = clonePlainData(project);
  const moved =
    after.payload.layerDocumentsById[group.layerDocumentId];
  moved.common.placement.parentLayerDocumentId = nextParentId;

  if (oldParentId === nextParentId) {
    const siblings = sortedSiblingIds(
      project,
      oldParentId,
      new Set([group.layerDocumentId])
    );
    assignSiblingOrder(
      after,
      nextParentId,
      insertAtOrder(
        siblings,
        group.layerDocumentId,
        command.newOrder
      )
    );
  } else {
    assignSiblingOrder(
      after,
      oldParentId,
      sortedSiblingIds(
        project,
        oldParentId,
        new Set([group.layerDocumentId])
      )
    );
    const nextSiblings = sortedSiblingIds(project, nextParentId);
    assignSiblingOrder(
      after,
      nextParentId,
      insertAtOrder(
        nextSiblings,
        group.layerDocumentId,
        command.newOrder
      )
    );
  }

  return complete({
    kind: "move-group",
    before: project,
    after,
    selectionChange: {
      kind: "select",
      layerDocumentId: group.layerDocumentId,
    },
    historyEntry: {
      label: `Move ${group.name}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: [],
  });
}
