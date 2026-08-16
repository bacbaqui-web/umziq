import {
  buildDeleteLayerDocumentTransaction,
  type LayerDocumentProject,
} from "@/models";
import type {
  DeleteSourceRegistryCommand,
  LayerDocumentSourceTransactionResult,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";
import {
  cloneSourceTransactionData,
  completeSourceTransaction,
  failSourceTransaction,
  plainDataValuesEqual,
  sourceReferences,
  validateSourceCommandPlainData,
  validateSourceTransactionAfter,
  validateSourceTransactionBefore,
} from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";

export function prepareSourceRegistryDelete(
  project: LayerDocumentProject,
  command: DeleteSourceRegistryCommand
): LayerDocumentSourceTransactionResult {
  const invalid = validateSourceTransactionBefore(project) ??
    validateSourceCommandPlainData(project, command);
  if (invalid) return invalid;
  const source =
    project.payload.sourceRegistry.sourcesById[command.sourceId];
  if (!source) {
    return failSourceTransaction(
      project,
      "source-not-found",
      `Source not found: ${command.sourceId}`
    );
  }
  if (source.kind === "psd-document") {
    const psdSourceIds = Object.values(
      project.payload.sourceRegistry.sourcesById
    )
      .filter(
        (candidate) =>
          candidate.sourceId === source.sourceId ||
          (
            candidate.kind === "psd-node" &&
            candidate.data.documentSourceId === source.sourceId
          )
      )
      .map((candidate) => candidate.sourceId);
    const psdSourceIdSet = new Set(psdSourceIds);
    const depthOf = (layerDocumentId: string) => {
      let depth = 0;
      let current = project.payload.layerDocumentsById[layerDocumentId];
      const seen = new Set<string>();
      while (
        current?.common.placement.parentLayerDocumentId &&
        !seen.has(current.layerDocumentId)
      ) {
        seen.add(current.layerDocumentId);
        depth += 1;
        current = project.payload.layerDocumentsById[
          current.common.placement.parentLayerDocumentId
        ];
      }
      return depth;
    };
    const referencedLayerIds = Object.values(
      project.payload.layerDocumentsById
    )
      .filter((layer) =>
        psdSourceIdSet.has(layer.common.source?.sourceId ?? "")
      )
      .map((layer) => layer.layerDocumentId)
      .sort((left, right) => depthOf(left) - depthOf(right));

    let after = cloneSourceTransactionData(project);
    for (const layerDocumentId of referencedLayerIds) {
      if (!after.payload.layerDocumentsById[layerDocumentId]) continue;
      const deletion = buildDeleteLayerDocumentTransaction(after, {
        layerDocumentId,
      });
      if (!deletion.ok) {
        return failSourceTransaction(
          project,
          "layer-transaction-error",
          deletion.error.message
        );
      }
      after = deletion.transaction.after;
    }
    psdSourceIds.forEach((sourceId) => {
      delete after.payload.sourceRegistry.sourcesById[sourceId];
    });
    const invalidAfter = validateSourceTransactionAfter(project, after);
    if (invalidAfter) return invalidAfter;
    const affectedLayerDocumentIds = [
      ...new Set([
        ...Object.keys(project.payload.layerDocumentsById),
        ...Object.keys(after.payload.layerDocumentsById),
      ]),
    ]
      .filter((layerDocumentId) =>
        !plainDataValuesEqual(
          project.payload.layerDocumentsById[layerDocumentId],
          after.payload.layerDocumentsById[layerDocumentId]
        )
      )
      .sort();
    return completeSourceTransaction({
      kind: "delete-source",
      before: project,
      after,
      sourceSelectionChange: {
        kind: "clear-if-selected",
        sourceId: command.sourceId,
      },
      layerSelectionChange: { kind: "clear" },
      historyPolicy: "record-entry",
      historyEntry: {
        label: `Delete PSD ${source.displayName}`,
        affectedSourceIds: [...psdSourceIds].sort(),
        affectedLayerDocumentIds,
      },
      deletedSourceIds: psdSourceIds,
      deletedLayerDocumentIds: Object.keys(
        project.payload.layerDocumentsById
      ).filter((layerDocumentId) =>
        !after.payload.layerDocumentsById[layerDocumentId]
      ),
    });
  }

  const references = sourceReferences(project, command.sourceId);
  if (
    references.layerDocumentIds.length > 0 ||
    references.sourceIds.length > 0
  ) {
    return failSourceTransaction(
      project,
      "source-is-referenced",
      `Source ${command.sourceId} is referenced by ` +
        [
          ...references.layerDocumentIds,
          ...references.sourceIds,
        ].join(", ")
    );
  }
  const after = cloneSourceTransactionData(project);
  delete after.payload.sourceRegistry.sourcesById[command.sourceId];
  const invalidAfter = validateSourceTransactionAfter(project, after);
  if (invalidAfter) return invalidAfter;
  return completeSourceTransaction({
    kind: "delete-source",
    before: project,
    after,
    sourceSelectionChange: {
      kind: "clear-if-selected",
      sourceId: command.sourceId,
    },
    historyPolicy: "record-entry",
    historyEntry: {
      label: `Delete Source ${source.displayName}`,
      affectedSourceIds: [command.sourceId],
      affectedLayerDocumentIds: [],
    },
    deletedSourceIds: [command.sourceId],
  });
}
