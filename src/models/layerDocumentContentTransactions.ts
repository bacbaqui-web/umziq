import type {
  LayerDocument,
  LayerDocumentProject,
} from "@/models/layerDocumentModel";
import {
  type LayerDocumentDomainUpdate,
  type LayerDocumentTransactionResult,
  type SetLayerDocumentNameCommand,
  type UpdateLayerDocumentCommonCommand,
  type UpdateLayerDocumentDomainCommand,
} from "@/models/layerDocumentTransactionModel";
import {
  cloneTransactionData as clonePlainData,
  completeLayerDocumentTransaction as complete,
  failLayerDocumentTransaction as fail,
  findLayerDocument as layerById,
  validateLayerDocumentTransactionInput as validateBefore,
} from "@/models/layerDocumentTransactionHelpers";
import {
  upsertKeyframeValue,
} from "@/models/keyframeTrackMutation";

export function buildSetLayerDocumentNameTransaction(
  project: LayerDocumentProject,
  command: SetLayerDocumentNameCommand
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
  const name = command.name.trim();
  if (!name) {
    return fail(
      project,
      "invalid-command",
      "Layer Document name must be non-empty after trimming",
      []
    );
  }

  const after = clonePlainData(project);
  const next =
    after.payload.layerDocumentsById[command.layerDocumentId];
  next.name = name;

  return complete({
    kind: "set-name",
    before: project,
    after,
    selectionChange: { kind: "preserve" },
    historyEntry: {
      label: `Rename ${layer.name} to ${name}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: [],
  });
}

export function buildUpdateLayerDocumentCommonTransaction(
  project: LayerDocumentProject,
  command: UpdateLayerDocumentCommonCommand
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
    (
      command.update.kind === "commit-transform" ||
      command.update.kind === "upsert-position-keyframe"
    ) &&
    (
      !Number.isInteger(command.update.localFrame) ||
      command.update.localFrame < 0
    )
  ) {
    return fail(
      project,
      "invalid-command",
      "Transform keyframe localFrame must be a non-negative integer",
      []
    );
  }

  const after = clonePlainData(project);
  const next =
    after.payload.layerDocumentsById[command.layerDocumentId];
  switch (command.update.kind) {
    case "set-transform":
      next.common.transform = clonePlainData(command.update.transform);
      break;
    case "commit-transform": {
      const { localFrame, patch } = command.update;
      if (patch.position) {
        if (next.common.animation.enabledProperties.position) {
          next.common.animation.positionKeyframes =
            upsertKeyframeValue(
              next.common.animation.positionKeyframes,
              localFrame,
              clonePlainData(patch.position)
            );
        } else {
          next.common.transform.position =
            clonePlainData(patch.position);
        }
      }
      if (patch.scale) {
        if (next.common.animation.enabledProperties.scale) {
          next.common.animation.scaleKeyframes =
            upsertKeyframeValue(
              next.common.animation.scaleKeyframes,
              localFrame,
              clonePlainData(patch.scale)
            );
        } else {
          next.common.transform.scale =
            clonePlainData(patch.scale);
        }
      }
      if (patch.rotation !== undefined) {
        if (next.common.animation.enabledProperties.rotation) {
          next.common.animation.rotationKeyframes =
            upsertKeyframeValue(
              next.common.animation.rotationKeyframes,
              localFrame,
              patch.rotation
            );
        } else {
          next.common.transform.rotation = patch.rotation;
        }
      }
      if (patch.opacity !== undefined) {
        if (next.common.animation.enabledProperties.opacity) {
          next.common.animation.opacityKeyframes =
            upsertKeyframeValue(
              next.common.animation.opacityKeyframes,
              localFrame,
              patch.opacity
            );
        } else {
          next.common.transform.opacity = patch.opacity;
        }
      }
      if (patch.anchor) {
        next.common.transform.anchor =
          clonePlainData(patch.anchor);
      }
      if (patch.transformOffset) {
        next.common.transform.transformOffset =
          clonePlainData(patch.transformOffset);
      }
      break;
    }
    case "upsert-position-keyframe":
      next.common.animation.enabledProperties.position =
        true;
      next.common.animation.positionKeyframes =
        upsertKeyframeValue(
          next.common.animation.positionKeyframes,
          command.update.localFrame,
          clonePlainData(command.update.value)
        );
      break;
    case "set-placement-timing":
      next.common.placement.startFrame = command.update.startFrame;
      next.common.placement.durationFrames =
        command.update.durationFrames;
      next.common.placement.sourceOffsetFrames =
        command.update.sourceOffsetFrames;
      break;
    case "set-visibility":
      next.common.placement.visible = command.update.visible;
      break;
    case "set-alias":
      next.common.placement.alias = command.update.alias;
      break;
    case "set-animation":
      next.common.animation = clonePlainData(command.update.animation);
      break;
    case "set-effects":
      next.common.effects = clonePlainData(command.update.effects);
      break;
    case "set-modifiers":
      next.common.modifiers = clonePlainData(command.update.modifiers);
      break;
  }
  return complete({
    kind: "update-common",
    before: project,
    after,
    selectionChange: { kind: "preserve" },
    historyEntry: {
      label: `Update ${layer.name} ${command.update.kind}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: [],
  });
}

function expectedDomainType(
  update: LayerDocumentDomainUpdate
): LayerDocument["type"] {
  switch (update.kind) {
    case "replace-drawing-document":
      return "drawing";
    case "replace-text-document":
      return "text";
    case "replace-shape-document":
      return "shape";
    case "set-group-composition-metadata":
      return "group";
    case "replace-unknown-payload":
      return "unknown";
  }
}

export function buildUpdateLayerDocumentDomainTransaction(
  project: LayerDocumentProject,
  command: UpdateLayerDocumentDomainCommand
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
  const expectedType = expectedDomainType(command.update);
  if (layer.type !== expectedType) {
    return fail(
      project,
      "domain-type-mismatch",
      `Domain update ${command.update.kind} requires ${expectedType}, ` +
        `received ${layer.type}`,
      []
    );
  }

  const after = clonePlainData(project);
  const next =
    after.payload.layerDocumentsById[command.layerDocumentId];
  switch (command.update.kind) {
    case "replace-drawing-document":
      if (next.type === "drawing") {
        next.data = clonePlainData(command.update.data);
      }
      break;
    case "replace-text-document":
      if (next.type === "text") {
        next.data = clonePlainData(command.update.data);
      }
      break;
    case "replace-shape-document":
      if (next.type === "shape") {
        next.data = clonePlainData(command.update.data);
      }
      break;
    case "set-group-composition-metadata":
      if (next.type === "group") {
        next.data = {
          role: next.data.role,
          ...clonePlainData(command.update.data),
        };
      }
      break;
    case "replace-unknown-payload":
      if (next.type === "unknown") {
        next.data = clonePlainData(command.update.data);
      }
      break;
  }
  return complete({
    kind: "update-domain",
    before: project,
    after,
    selectionChange: { kind: "preserve" },
    historyEntry: {
      label: `Update ${layer.name} ${command.update.kind}`,
      affectedLayerDocumentIds: [],
    },
    createdLayerDocumentIds: [],
    deletedLayerDocumentIds: [],
  });
}
