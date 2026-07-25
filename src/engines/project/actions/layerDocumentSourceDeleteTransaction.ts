import type { LayerDocumentProject } from "@/models";
import type {
  DeleteSourceRegistryCommand,
  LayerDocumentSourceTransactionResult,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";
import {
  cloneSourceTransactionData,
  completeSourceTransaction,
  failSourceTransaction,
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
