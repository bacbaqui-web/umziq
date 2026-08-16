import {
  buildSetLayerDocumentNameTransaction,
  buildUpdateLayerDocumentCommonTransaction,
  validateLayerDocumentProject,
  type LayerDocument,
  type LayerDocumentProject,
  type LayerDocumentTransactionResult,
} from "@/models";
import {
  prepareLayerDocumentDrawingUpdate,
} from "@/layer-types";
import {
  prepareLayerDocumentTextUpdate,
} from "@/layer-types";
import type {
  LayerDocumentPropertiesCommand,
  LayerDocumentPropertiesCommandPreparation,
  LayerDocumentPropertiesCommandRejectReason,
} from "@/engines/properties/models/layerDocumentPropertiesModel";

function commandLayerDocumentId(
  command: LayerDocumentPropertiesCommand
): string {
  return command.kind === "commit-transform"
    ? command.intent.layerDocumentId
    : command.layerDocumentId;
}

function rejected(options: {
  project: LayerDocumentProject;
  selectedLayerDocumentId: string | null;
  layerDocumentId: string | null;
  reason: LayerDocumentPropertiesCommandRejectReason;
  message: string;
}): LayerDocumentPropertiesCommandPreparation {
  return {
    ok: false,
    status: "rejected",
    selectedLayerDocumentId: options.selectedLayerDocumentId,
    layerDocumentId: options.layerDocumentId,
    reason: options.reason,
    errorCode: null,
    message: options.message,
    project: options.project,
    projectUpdateCount: 0,
    transactionCount: 0,
    historyEntryCount: 0,
  };
}

function fromTransactionResult(
  result: LayerDocumentTransactionResult,
  selectedLayerDocumentId: string
): LayerDocumentPropertiesCommandPreparation {
  if (result.ok) {
    return {
      ok: true,
      status: "prepared",
      selectedLayerDocumentId,
      layerDocumentId: selectedLayerDocumentId,
      transaction: result.transaction,
      projectUpdateCount: 0,
      transactionCount: 1,
      historyEntryCount: 1,
    };
  }
  return {
    ok: false,
    status: "rejected",
    selectedLayerDocumentId,
    layerDocumentId: selectedLayerDocumentId,
    reason: result.error.code === "no-change"
      ? "no-change"
      : result.error.code === "domain-type-mismatch"
        ? "type-mismatch"
        : "transaction-error",
    errorCode: result.error.code,
    message: result.error.message,
    project: result.project,
    projectUpdateCount: 0,
    transactionCount: 0,
    historyEntryCount: 0,
  };
}

function isProjectRoot(layer: LayerDocument): boolean {
  return layer.type === "group" && layer.data.role === "project-root";
}

function rootRestricted(
  command: LayerDocumentPropertiesCommand,
  layer: LayerDocument
): boolean {
  if (command.kind === "commit-transform") {
    const patch = command.intent.patch;
    return (
      patch.position !== undefined ||
      patch.anchor !== undefined ||
      patch.transformOffset !== undefined
    );
  }
  if (command.kind === "set-animation") {
    return (
      command.animation.enabledProperties.position !==
        layer.common.animation.enabledProperties.position ||
      JSON.stringify(command.animation.positionKeyframes) !==
        JSON.stringify(layer.common.animation.positionKeyframes)
    );
  }
  return command.kind !== "set-name" &&
    command.kind !== "set-scale-linked" &&
    command.kind !== "request-future-domain-update";
}

function futureDomainPreparation(options: {
  project: LayerDocumentProject;
  selectedLayerDocumentId: string;
  layer: LayerDocument;
  command: Extract<
    LayerDocumentPropertiesCommand,
    { kind: "request-future-domain-update" }
  >;
}): LayerDocumentPropertiesCommandPreparation {
  if (options.layer.type !== options.command.domain) {
    return rejected({
      project: options.project,
      selectedLayerDocumentId: options.selectedLayerDocumentId,
      layerDocumentId: options.command.layerDocumentId,
      reason: "type-mismatch",
      message:
        `${options.command.domain} command cannot target ` +
        `${options.layer.type} Layer Document.`,
    });
  }
  if (options.command.domain === "audio") {
    return rejected({
      project: options.project,
      selectedLayerDocumentId: options.selectedLayerDocumentId,
      layerDocumentId: options.command.layerDocumentId,
      reason: "unsupported-capability",
      message: "Audio Properties controls are not connected yet.",
    });
  }
  return rejected({
    project: options.project,
    selectedLayerDocumentId: options.selectedLayerDocumentId,
    layerDocumentId: options.command.layerDocumentId,
    reason: "unsupported-capability",
    message:
      `${options.command.domain} domain editing is not implemented.`,
  });
}

function prepareAudioProperties(options: {
  project: LayerDocumentProject;
  selectedLayerDocumentId: string;
  layer: LayerDocument;
  command: Extract<LayerDocumentPropertiesCommand, { kind: "set-audio-properties" }>;
}): LayerDocumentPropertiesCommandPreparation {
  if (options.layer.type !== "audio") {
    return rejected({ project: options.project, selectedLayerDocumentId: options.selectedLayerDocumentId, layerDocumentId: options.command.layerDocumentId, reason: "type-mismatch", message: "Audio Properties require an Audio Layer." });
  }
  const parentId = options.layer.common.placement.parentLayerDocumentId;
  const parent = parentId ? options.project.payload.layerDocumentsById[parentId] : null;
  const sourceId = options.layer.common.source?.sourceId;
  const source = sourceId ? options.project.payload.sourceRegistry.sourcesById[sourceId] : null;
  if (!parent || parent.type !== "group" || !source || source.kind !== "audio") {
    return rejected({ project: options.project, selectedLayerDocumentId: options.selectedLayerDocumentId, layerDocumentId: options.command.layerDocumentId, reason: "transaction-error", message: "Audio parent or Source is unavailable." });
  }
  const sourceDurationFrames = source.data.durationFrames ??
    (options.layer.common.placement.sourceOffsetFrames + options.layer.common.placement.durationFrames);
  const integer = (value: number) => Math.round(Number.isFinite(value) ? value : 0);
  const gain = Math.min(4, Math.max(0, Number.isFinite(options.command.gain) ? options.command.gain : options.layer.data.gain));
  const startFrame = Math.min(Math.max(0, integer(options.command.startFrame)), Math.max(0, parent.data.durationFrames - 1));
  const sourceOffsetFrames = Math.min(Math.max(0, integer(options.command.sourceOffsetFrames)), Math.max(0, sourceDurationFrames - 1));
  const durationFrames = Math.min(
    Math.max(1, integer(options.command.durationFrames)),
    Math.max(1, parent.data.durationFrames - startFrame),
    Math.max(1, sourceDurationFrames - sourceOffsetFrames)
  );
  const fadeInFrames = Math.min(Math.max(0, integer(options.command.fadeInFrames)), durationFrames);
  const fadeOutFrames = Math.min(Math.max(0, integer(options.command.fadeOutFrames)), durationFrames - fadeInFrames);
  const name = options.command.name.trim() || options.layer.name;
  const before = options.layer;
  const changed = name !== before.name || gain !== before.data.gain || options.command.muted !== before.data.muted ||
    startFrame !== before.common.placement.startFrame || durationFrames !== before.common.placement.durationFrames ||
    sourceOffsetFrames !== before.common.placement.sourceOffsetFrames || fadeInFrames !== before.data.fadeInFrames ||
    fadeOutFrames !== before.data.fadeOutFrames;
  if (!changed) {
    return rejected({ project: options.project, selectedLayerDocumentId: options.selectedLayerDocumentId, layerDocumentId: options.command.layerDocumentId, reason: "no-change", message: "Audio Properties did not change." });
  }
  const after = structuredClone(options.project);
  const next = after.payload.layerDocumentsById[options.layer.layerDocumentId];
  if (next.type !== "audio") {
    return rejected({ project: options.project, selectedLayerDocumentId: options.selectedLayerDocumentId, layerDocumentId: options.command.layerDocumentId, reason: "type-mismatch", message: "Audio Layer changed during preparation." });
  }
  next.name = name;
  next.revision += 1;
  next.common.placement = { ...next.common.placement, startFrame, durationFrames, sourceOffsetFrames };
  next.data = { ...next.data, gain, muted: options.command.muted, fadeInFrames, fadeOutFrames };
  const issues = validateLayerDocumentProject(after);
  if (issues.length) {
    return rejected({ project: options.project, selectedLayerDocumentId: options.selectedLayerDocumentId, layerDocumentId: options.command.layerDocumentId, reason: "transaction-error", message: issues[0].message });
  }
  return {
    ok: true,
    status: "prepared",
    selectedLayerDocumentId: options.selectedLayerDocumentId,
    layerDocumentId: options.layer.layerDocumentId,
    transaction: {
      kind: "update-domain",
      before: options.project,
      after,
      selectionChange: { kind: "preserve" },
      historyEntry: { label: `Update ${options.layer.name} Audio Properties`, affectedLayerDocumentIds: [options.layer.layerDocumentId] },
      createdLayerDocumentIds: [],
      deletedLayerDocumentIds: [],
    },
    projectUpdateCount: 0,
    transactionCount: 1,
    historyEntryCount: 1,
  };
}

export function prepareLayerDocumentPropertiesCommand(options: {
  project: LayerDocumentProject;
  selectedLayerDocumentId: string | null;
  command: LayerDocumentPropertiesCommand;
}): LayerDocumentPropertiesCommandPreparation {
  const layerDocumentId = commandLayerDocumentId(options.command);
  if (!options.selectedLayerDocumentId) {
    return rejected({
      project: options.project,
      selectedLayerDocumentId: null,
      layerDocumentId,
      reason: "no-selection",
      message: "No Layer Document is selected.",
    });
  }
  const layer = options.project.payload.layerDocumentsById[
    options.selectedLayerDocumentId
  ];
  if (!layer) {
    return rejected({
      project: options.project,
      selectedLayerDocumentId: options.selectedLayerDocumentId,
      layerDocumentId,
      reason: "layer-not-found",
      message:
        `Selected Layer Document not found: ` +
        options.selectedLayerDocumentId,
    });
  }
  if (layerDocumentId !== options.selectedLayerDocumentId) {
    return rejected({
      project: options.project,
      selectedLayerDocumentId: options.selectedLayerDocumentId,
      layerDocumentId,
      reason: "selection-mismatch",
      message: "Panel command target does not match the selected Layer.",
    });
  }
  if (
    isProjectRoot(layer) &&
    rootRestricted(options.command, layer)
  ) {
    return rejected({
      project: options.project,
      selectedLayerDocumentId: options.selectedLayerDocumentId,
      layerDocumentId,
      reason: "root-operation-forbidden",
      message: "Project root editing is reserved for project settings.",
    });
  }

  switch (options.command.kind) {
    case "commit-transform": {
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(options.project, {
          layerDocumentId,
          update: {
            kind: "commit-transform",
            localFrame: options.command.intent.localFrame,
            patch: options.command.intent.patch,
          },
        }),
        layerDocumentId
      );
    }
    case "upsert-position-keyframe":
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(
          options.project,
          {
            layerDocumentId,
            update: {
              kind: "upsert-position-keyframe",
              localFrame:
                options.command.localFrame,
              value: options.command.value,
            },
          }
        ),
        layerDocumentId
      );
    case "set-scale-linked":
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(options.project, {
          layerDocumentId,
          update: {
            kind: "set-transform",
            transform: {
              ...layer.common.transform,
              scaleLinked: options.command.scaleLinked,
            },
          },
        }),
        layerDocumentId
      );
    case "set-name":
      return fromTransactionResult(
        buildSetLayerDocumentNameTransaction(options.project, {
          layerDocumentId,
          name: options.command.name,
        }),
        layerDocumentId
      );
    case "set-alias":
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(options.project, {
          layerDocumentId,
          update: {
            kind: "set-alias",
            alias: options.command.alias?.trim() || null,
          },
        }),
        layerDocumentId
      );
    case "set-placement-timing":
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(options.project, {
          layerDocumentId,
          update: {
            kind: "set-placement-timing",
            startFrame: options.command.startFrame,
            durationFrames: options.command.durationFrames,
            sourceOffsetFrames: options.command.sourceOffsetFrames,
          },
        }),
        layerDocumentId
      );
    case "set-audio-properties":
      return prepareAudioProperties({
        project: options.project,
        selectedLayerDocumentId: options.selectedLayerDocumentId,
        layer,
        command: options.command,
      });
    case "set-visibility":
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(options.project, {
          layerDocumentId,
          update: {
            kind: "set-visibility",
            visible: options.command.visible,
          },
        }),
        layerDocumentId
      );
    case "set-animation":
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(options.project, {
          layerDocumentId,
          update: {
            kind: "set-animation",
            animation: options.command.animation,
          },
        }),
        layerDocumentId
      );
    case "set-effects":
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(options.project, {
          layerDocumentId,
          update: {
            kind: "set-effects",
            effects: options.command.effects,
          },
        }),
        layerDocumentId
      );
    case "set-modifiers":
      return fromTransactionResult(
        buildUpdateLayerDocumentCommonTransaction(options.project, {
          layerDocumentId,
          update: {
            kind: "set-modifiers",
            modifiers: options.command.modifiers,
          },
        }),
        layerDocumentId
      );
    case "replace-drawing-document":
      return fromTransactionResult(
        prepareLayerDocumentDrawingUpdate(options.project, {
          layerDocumentId,
          data: options.command.data,
        }),
        layerDocumentId
      );
    case "replace-text-document":
      return fromTransactionResult(
        prepareLayerDocumentTextUpdate(options.project, {
          layerDocumentId,
          data: options.command.data,
        }),
        layerDocumentId
      );
    case "request-future-domain-update":
      return futureDomainPreparation({
        project: options.project,
        selectedLayerDocumentId: layerDocumentId,
        layer,
        command: options.command,
      });
  }
}
