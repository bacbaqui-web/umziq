import type {
  LayerDocumentProject,
  SourceRegistryRecord,
} from "@/models";
import type {
  DiscoverPsdSourceNodesCommand,
  LayerDocumentSourceTransactionKind,
  LayerDocumentSourceTransactionResult,
  ReconnectSourceRegistryCommand,
  RefreshSourceRegistryCommand,
  SourceRegistryCacheInvalidationContext,
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

function prepareSourceReplacement(options: {
  project: LayerDocumentProject;
  kind: Extract<
    LayerDocumentSourceTransactionKind,
    "refresh-source" | "reconnect-source"
  >;
  source: SourceRegistryRecord;
  cacheContext: SourceRegistryCacheInvalidationContext;
}): LayerDocumentSourceTransactionResult {
  const invalid = validateSourceTransactionBefore(options.project) ??
    validateSourceCommandPlainData(options.project, {
      source: options.source,
      cacheContext: options.cacheContext,
    });
  if (invalid) return invalid;
  const current = options.project.payload.sourceRegistry.sourcesById[
    options.source.sourceId
  ];
  if (!current) {
    return failSourceTransaction(
      options.project,
      "source-not-found",
      `Source not found: ${options.source.sourceId}`
    );
  }
  const identityConflict = validateStableSourceIdentity({
    project: options.project,
    current,
    next: options.source,
  });
  if (identityConflict) return identityConflict;
  if (plainDataValuesEqual(current, options.source)) {
    return failSourceTransaction(
      options.project,
      "no-change",
      "Source replacement did not change registry data"
    );
  }
  if (options.source.version !== current.version + 1) {
    return failSourceTransaction(
      options.project,
      "version-not-monotonic",
      `Changed Source version must advance exactly from ` +
        `${current.version} to ${current.version + 1}`
    );
  }
  if (
    options.kind === "reconnect-source" &&
    options.source.refresh.status !== "normal"
  ) {
    return failSourceTransaction(
      options.project,
      "invalid-input",
      "Reconnect must produce normal Source reconciliation state"
    );
  }
  const after = cloneSourceTransactionData(options.project);
  after.payload.sourceRegistry.sourcesById[options.source.sourceId] =
    cloneSourceTransactionData(options.source);
  const invalidAfter = validateSourceTransactionAfter(
    options.project,
    after
  );
  if (invalidAfter) return invalidAfter;
  return completeSourceTransaction({
    kind: options.kind,
    before: options.project,
    after,
    sourceSelectionChange: { kind: "preserve" },
    historyPolicy: "clear-history",
    cacheInvalidations: buildCacheInvalidationsForSources({
      before: options.project,
      after,
      sourceIds: [options.source.sourceId],
      context: options.cacheContext,
    }),
  });
}

export function prepareSourceRegistryRefresh(
  project: LayerDocumentProject,
  command: RefreshSourceRegistryCommand
): LayerDocumentSourceTransactionResult {
  return prepareSourceReplacement({
    project,
    kind: "refresh-source",
    source: command.source,
    cacheContext: command.cacheContext,
  });
}

export function prepareSourceRegistryReconnect(
  project: LayerDocumentProject,
  command: ReconnectSourceRegistryCommand
): LayerDocumentSourceTransactionResult {
  return prepareSourceReplacement({
    project,
    kind: "reconnect-source",
    source: command.source,
    cacheContext: command.cacheContext,
  });
}

export function preparePsdSourceNodeDiscovery(
  project: LayerDocumentProject,
  command: DiscoverPsdSourceNodesCommand
): LayerDocumentSourceTransactionResult {
  const invalid = validateSourceTransactionBefore(project) ??
    validateSourceCommandPlainData(project, command);
  if (invalid) return invalid;
  if (command.sources.length === 0) {
    return failSourceTransaction(
      project,
      "no-change",
      "No PSD nodes were discovered"
    );
  }
  const after = cloneSourceTransactionData(project);
  const createdSourceIds = new Set<string>();
  for (const source of command.sources) {
    if (source.kind !== "psd-node") {
      return failSourceTransaction(
        project,
        "source-kind-conflict",
        "PSD discovery accepts psd-node records only"
      );
    }
    if (
      createdSourceIds.has(source.sourceId) ||
      after.payload.sourceRegistry.sourcesById[source.sourceId]
    ) {
      return failSourceTransaction(
        project,
        "source-id-conflict",
        `Source ID already exists: ${source.sourceId}`
      );
    }
    createdSourceIds.add(source.sourceId);
    after.payload.sourceRegistry.sourcesById[source.sourceId] =
      cloneSourceTransactionData(source);
  }
  const invalidAfter = validateSourceTransactionAfter(project, after);
  if (invalidAfter) return invalidAfter;
  return completeSourceTransaction({
    kind: "discover-psd-nodes",
    before: project,
    after,
    sourceSelectionChange: { kind: "preserve" },
    historyPolicy: "clear-history",
    createdSourceIds: [...createdSourceIds],
  });
}
