import type { LayerDocumentProject } from "@/models/layerDocumentModel";
import {
  type LayerDocumentTransactionResult,
  type MoveLayerDocumentCommand,
  type MoveLayerDocumentKeyframeCommand,
  type RemoveLayerDocumentKeyframeCommand,
  type SplitLayerDocumentCommand,
} from "@/models/layerDocumentTransactionModel";
import {
  assignSiblingLayerDocumentOrder,
  cloneTransactionData,
  collectLayerDocumentSubtreeIds,
  completeLayerDocumentTransaction,
  failLayerDocumentTransaction,
  findLayerDocument,
  insertLayerDocumentAtOrder,
  isGroupLayerDocument,
  isProjectRootLayer,
  sortedSiblingLayerDocumentIds,
  validateLayerDocumentTransactionInput,
} from "@/models/layerDocumentTransactionHelpers";
import {
  buildDuplicateLayerDocumentTransaction,
} from "@/models/layerDocumentStructuralTransactions";
import {
  layerDocumentPlacementEndFrame,
} from "@/models/layerDocumentPlacementFrameHelpers";
import {
  moveFrameValueKeyframe,
  removeFrameValueKeyframe,
} from "@/models/keyframeTrackMutation";

export function buildMoveLayerDocumentTransaction(
  project: LayerDocumentProject,
  command: MoveLayerDocumentCommand
): LayerDocumentTransactionResult {
  const invalid = validateLayerDocumentTransactionInput(project);
  if (invalid) return invalid;
  const layer = findLayerDocument(project, command.layerDocumentId);
  if (!layer) {
    return failLayerDocumentTransaction(
      project,
      "layer-not-found",
      `Layer Document not found: ${command.layerDocumentId}`,
      []
    );
  }
  if (isProjectRootLayer(layer)) {
    return failLayerDocumentTransaction(
      project,
      "root-operation-forbidden",
      "The project-root Layer cannot be moved",
      []
    );
  }
  const nextParent = findLayerDocument(
    project,
    command.newParentLayerDocumentId
  );
  if (!isGroupLayerDocument(nextParent)) {
    return failLayerDocumentTransaction(
      project,
      "parent-group-not-found",
      `Target parent Group not found: ${command.newParentLayerDocumentId}`,
      []
    );
  }
  if (!Number.isInteger(command.newOrder) || command.newOrder < 0) {
    return failLayerDocumentTransaction(
      project,
      "invalid-command",
      "Move order must be a non-negative integer",
      []
    );
  }
  if (
    isGroupLayerDocument(layer) &&
    new Set(
      collectLayerDocumentSubtreeIds(project, layer.layerDocumentId)
    ).has(nextParent.layerDocumentId)
  ) {
    return failLayerDocumentTransaction(
      project,
      "cycle-detected",
      "A Group cannot move below itself or one of its descendants",
      []
    );
  }

  const oldParentId =
    layer.common.placement.parentLayerDocumentId;
  const nextParentId = nextParent.layerDocumentId;
  const after = cloneTransactionData(project);
  const moved =
    after.payload.layerDocumentsById[layer.layerDocumentId];
  moved.common.placement.parentLayerDocumentId = nextParentId;

  if (oldParentId === nextParentId) {
    const siblings = sortedSiblingLayerDocumentIds(
      project,
      oldParentId,
      new Set([layer.layerDocumentId])
    );
    assignSiblingLayerDocumentOrder(
      after,
      nextParentId,
      insertLayerDocumentAtOrder(
        siblings,
        layer.layerDocumentId,
        command.newOrder
      )
    );
  } else {
    assignSiblingLayerDocumentOrder(
      after,
      oldParentId,
      sortedSiblingLayerDocumentIds(
        project,
        oldParentId,
        new Set([layer.layerDocumentId])
      )
    );
    assignSiblingLayerDocumentOrder(
      after,
      nextParentId,
      insertLayerDocumentAtOrder(
        sortedSiblingLayerDocumentIds(project, nextParentId),
        layer.layerDocumentId,
        command.newOrder
      )
    );
  }

  return completeLayerDocumentTransaction({
    kind: "move-layer",
    before: project,
    after,
    selectionChange: {
      kind: "select",
      layerDocumentId: layer.layerDocumentId,
    },
    historyEntry: {
      label: `Move ${layer.name}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: [],
  });
}

export function buildSplitLayerDocumentTransaction(
  project: LayerDocumentProject,
  command: SplitLayerDocumentCommand
): LayerDocumentTransactionResult {
  const invalid = validateLayerDocumentTransactionInput(project);
  if (invalid) return invalid;
  const layer = findLayerDocument(project, command.layerDocumentId);
  if (!layer) {
    return failLayerDocumentTransaction(
      project,
      "layer-not-found",
      `Layer Document not found: ${command.layerDocumentId}`,
      []
    );
  }
  if (isProjectRootLayer(layer)) {
    return failLayerDocumentTransaction(
      project,
      "root-operation-forbidden",
      "The project-root Layer cannot be split",
      []
    );
  }
  const placement = layer.common.placement;
  const endFrame =
    layerDocumentPlacementEndFrame(placement);
  if (
    !Number.isInteger(command.splitGlobalFrame) ||
    command.splitGlobalFrame <= placement.startFrame ||
    command.splitGlobalFrame >= endFrame
  ) {
    return failLayerDocumentTransaction(
      project,
      "invalid-command",
      "Split frame must be an integer strictly inside the Placement",
      []
    );
  }

  const duplicated = buildDuplicateLayerDocumentTransaction(project, {
    layerDocumentId: layer.layerDocumentId,
    newLayerDocumentId: command.newLayerDocumentId,
  });
  if (!duplicated.ok) return duplicated;

  const after = cloneTransactionData(duplicated.transaction.after);
  const left =
    after.payload.layerDocumentsById[layer.layerDocumentId];
  const right =
    after.payload.layerDocumentsById[command.newLayerDocumentId];
  right.name = layer.name;
  right.common.placement.alias =
    layer.common.placement.alias;
  const leftDuration =
    command.splitGlobalFrame - placement.startFrame;
  left.common.placement.durationFrames = leftDuration;
  right.common.placement.startFrame = command.splitGlobalFrame;
  right.common.placement.durationFrames =
    endFrame - command.splitGlobalFrame;
  right.common.placement.sourceOffsetFrames =
    placement.sourceOffsetFrames + leftDuration;

  const parentId = placement.parentLayerDocumentId;
  const originalSiblings = sortedSiblingLayerDocumentIds(
    project,
    parentId
  );
  const sourceIndex = originalSiblings.indexOf(layer.layerDocumentId);
  const splitSiblings = [...originalSiblings];
  splitSiblings.splice(
    sourceIndex + 1,
    0,
    command.newLayerDocumentId
  );
  assignSiblingLayerDocumentOrder(after, parentId, splitSiblings);

  return completeLayerDocumentTransaction({
    kind: "split-layer",
    before: project,
    after,
    selectionChange: {
      kind: "select",
      layerDocumentId: command.newLayerDocumentId,
    },
    historyEntry: {
      label: `Split ${layer.name}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds:
      duplicated.transaction.createdLayerDocumentIds,
    deletedLayerDocumentIds: [],
  });
}

function keyframeFramesAreValid(
  ...frames: readonly number[]
): boolean {
  return frames.every(
    (frame) => Number.isInteger(frame) && frame >= 0
  );
}

export function buildMoveLayerDocumentKeyframeTransaction(
  project: LayerDocumentProject,
  command: MoveLayerDocumentKeyframeCommand
): LayerDocumentTransactionResult {
  const invalid =
    validateLayerDocumentTransactionInput(project);
  if (invalid) return invalid;
  const layer = findLayerDocument(
    project,
    command.layerDocumentId
  );
  if (!layer) {
    return failLayerDocumentTransaction(
      project,
      "layer-not-found",
      `Layer Document not found: ${command.layerDocumentId}`,
      []
    );
  }
  if (
    !keyframeFramesAreValid(
      command.fromLocalFrame,
      command.toLocalFrame
    )
  ) {
    return failLayerDocumentTransaction(
      project,
      "invalid-command",
      "Keyframe frames must be non-negative integers",
      []
    );
  }
  const after = cloneTransactionData(project);
  const animation =
    after.payload.layerDocumentsById[
      command.layerDocumentId
    ].common.animation;
  switch (command.property) {
    case "position":
      animation.positionKeyframes =
        moveFrameValueKeyframe(
          animation.positionKeyframes,
          command.fromLocalFrame,
          command.toLocalFrame
        );
      break;
    case "scale":
      animation.scaleKeyframes =
        moveFrameValueKeyframe(
          animation.scaleKeyframes,
          command.fromLocalFrame,
          command.toLocalFrame
        );
      break;
    case "rotation":
      animation.rotationKeyframes =
        moveFrameValueKeyframe(
          animation.rotationKeyframes,
          command.fromLocalFrame,
          command.toLocalFrame
        );
      break;
    case "opacity":
      animation.opacityKeyframes =
        moveFrameValueKeyframe(
          animation.opacityKeyframes,
          command.fromLocalFrame,
          command.toLocalFrame
        );
      break;
  }
  return completeLayerDocumentTransaction({
    kind: "update-common",
    before: project,
    after,
    selectionChange: { kind: "preserve" },
    historyEntry: {
      label: `Move ${layer.name} ${command.property} keyframe`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: [],
  });
}

export function buildRemoveLayerDocumentKeyframeTransaction(
  project: LayerDocumentProject,
  command: RemoveLayerDocumentKeyframeCommand
): LayerDocumentTransactionResult {
  const invalid =
    validateLayerDocumentTransactionInput(project);
  if (invalid) return invalid;
  const layer = findLayerDocument(
    project,
    command.layerDocumentId
  );
  if (!layer) {
    return failLayerDocumentTransaction(
      project,
      "layer-not-found",
      `Layer Document not found: ${command.layerDocumentId}`,
      []
    );
  }
  if (!keyframeFramesAreValid(command.localFrame)) {
    return failLayerDocumentTransaction(
      project,
      "invalid-command",
      "Keyframe frame must be a non-negative integer",
      []
    );
  }
  const after = cloneTransactionData(project);
  const animation =
    after.payload.layerDocumentsById[
      command.layerDocumentId
    ].common.animation;
  switch (command.property) {
    case "position":
      animation.positionKeyframes =
        removeFrameValueKeyframe(
          animation.positionKeyframes,
          command.localFrame
        );
      break;
    case "scale":
      animation.scaleKeyframes =
        removeFrameValueKeyframe(
          animation.scaleKeyframes,
          command.localFrame
        );
      break;
    case "rotation":
      animation.rotationKeyframes =
        removeFrameValueKeyframe(
          animation.rotationKeyframes,
          command.localFrame
        );
      break;
    case "opacity":
      animation.opacityKeyframes =
        removeFrameValueKeyframe(
          animation.opacityKeyframes,
          command.localFrame
        );
      break;
  }
  return completeLayerDocumentTransaction({
    kind: "update-common",
    before: project,
    after,
    selectionChange: { kind: "preserve" },
    historyEntry: {
      label: `Remove ${layer.name} ${command.property} keyframe`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: [],
  });
}
