import type { LayerDocumentProject } from "@/models";
import type {
  LayerDocumentSourceTransactionResult,
  RefreshPsdSourceRegistryCommand,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";
import {
  buildCacheInvalidationsForSources,
  cloneSourceTransactionData,
  completeSourceTransaction,
  failSourceTransaction,
  plainDataValuesEqual,
  validateSourceCommandPlainData,
  validateSourceTransactionAfter,
  validateSourceTransactionBefore,
  validateStableSourceIdentity,
} from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";

function validateChangedVersion(options: {
  project: LayerDocumentProject;
  currentVersion: number;
  nextVersion: number;
  sourceId: string;
}): LayerDocumentSourceTransactionResult | null {
  if (options.nextVersion === options.currentVersion + 1) return null;
  return failSourceTransaction(
    options.project,
    "version-not-monotonic",
    `Changed Source ${options.sourceId} version must advance exactly ` +
      `from ${options.currentVersion} to ${options.currentVersion + 1}`
  );
}

export function preparePsdSourceRegistryRefresh(
  project: LayerDocumentProject,
  command: RefreshPsdSourceRegistryCommand
): LayerDocumentSourceTransactionResult {
  const invalid = validateSourceTransactionBefore(project) ??
    validateSourceCommandPlainData(project, command);
  if (invalid) return invalid;

  const currentDocument =
    project.payload.sourceRegistry.sourcesById[
      command.documentSource.sourceId
    ];
  if (!currentDocument) {
    return failSourceTransaction(
      project,
      "source-not-found",
      `PSD document Source not found: ${command.documentSource.sourceId}`
    );
  }
  if (currentDocument.kind !== "psd-document") {
    return failSourceTransaction(
      project,
      "source-kind-conflict",
      `PSD refresh document ID resolves to ${currentDocument.kind}`
    );
  }
  const documentIdentityConflict = validateStableSourceIdentity({
    project,
    current: currentDocument,
    next: command.documentSource,
  });
  if (documentIdentityConflict) return documentIdentityConflict;
  if (plainDataValuesEqual(currentDocument, command.documentSource)) {
    return failSourceTransaction(
      project,
      "no-change",
      "PSD refresh document record did not change"
    );
  }
  const documentVersionConflict = validateChangedVersion({
    project,
    currentVersion: currentDocument.version,
    nextVersion: command.documentSource.version,
    sourceId: currentDocument.sourceId,
  });
  if (documentVersionConflict) return documentVersionConflict;

  const after = cloneSourceTransactionData(project);
  after.payload.sourceRegistry.sourcesById[currentDocument.sourceId] =
    cloneSourceTransactionData(command.documentSource);
  const suppliedNodeIds = new Set<string>();
  const createdSourceIds: string[] = [];
  const changedExistingSourceIds = [currentDocument.sourceId];

  for (const node of command.nodeSources) {
    if (suppliedNodeIds.has(node.sourceId)) {
      return failSourceTransaction(
        project,
        "source-id-conflict",
        `PSD refresh contains duplicate node ID: ${node.sourceId}`
      );
    }
    suppliedNodeIds.add(node.sourceId);
    if (
      node.data.documentSourceId !== command.documentSource.sourceId
    ) {
      return failSourceTransaction(
        project,
        "source-reference-conflict",
        `PSD node ${node.sourceId} belongs to a different document`
      );
    }

    const current =
      project.payload.sourceRegistry.sourcesById[node.sourceId];
    if (!current) {
      createdSourceIds.push(node.sourceId);
      after.payload.sourceRegistry.sourcesById[node.sourceId] =
        cloneSourceTransactionData(node);
      continue;
    }
    if (current.kind !== "psd-node") {
      return failSourceTransaction(
        project,
        "source-id-conflict",
        `PSD node ID already belongs to ${current.kind}: ${node.sourceId}`
      );
    }
    const identityConflict = validateStableSourceIdentity({
      project,
      current,
      next: node,
    });
    if (identityConflict) return identityConflict;
    if (plainDataValuesEqual(current, node)) {
      return failSourceTransaction(
        project,
        "no-change",
        `Supplied PSD node did not change: ${node.sourceId}`
      );
    }
    const versionConflict = validateChangedVersion({
      project,
      currentVersion: current.version,
      nextVersion: node.version,
      sourceId: node.sourceId,
    });
    if (versionConflict) return versionConflict;
    changedExistingSourceIds.push(node.sourceId);
    after.payload.sourceRegistry.sourcesById[node.sourceId] =
      cloneSourceTransactionData(node);
  }

  const invalidAfter = validateSourceTransactionAfter(project, after);
  if (invalidAfter) return invalidAfter;
  return completeSourceTransaction({
    kind: "refresh-psd-document",
    before: project,
    after,
    sourceSelectionChange: { kind: "preserve" },
    historyPolicy: "clear-history",
    createdSourceIds,
    cacheInvalidations: buildCacheInvalidationsForSources({
      before: project,
      after,
      sourceIds: changedExistingSourceIds,
      context: command.cacheContext,
    }),
  });
}
