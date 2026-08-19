import {
  applyLayerDocumentSelectionChange,
  normalizeActiveGroupLayerDocumentId,
} from "@/models";
import type {
  LayerDocumentNexusHistoryEntry,
  LayerDocumentNexusSession,
  LayerDocumentNexusAction,
  LayerDocumentNexusState,
  LayerDocumentNexusTransitionResult,
} from "@/engines/project/models/layerDocumentNexusModel";
import {
  applyNexusSourceSelectionChange,
  cloneNexusHistoryEntry,
  cloneNexusPlainData,
  cloneNexusSnapshot,
  nexusStateWithStacks,
} from "@/engines/project/helpers/layerDocumentNexusHelpers";
import {
  changedNexusRecordIds,
  createdNexusRecordIds,
  deletedNexusRecordIds,
  failNexusTransition,
  nexusIdsMatch,
  projectTransitionEffect,
  successNexusTransition,
  validateNexusTransactionAfter,
} from "@/engines/project/actions/layerDocumentNexusTransitionHelpers";
import {
  normalizeNexusRuntimeSession,
} from "@/engines/project/actions/layerDocumentNexusRuntimeSessionReducer";

function validSourceHistoryContract(
  action: Extract<
    LayerDocumentNexusAction,
    { kind: "commit-source-transaction" }
  >
): boolean {
  const transaction = action.transaction;
  return transaction.historyPolicy === "record-entry"
    ? (
        transaction.historyEntry !== null &&
        transaction.historyEntryCount === 1 &&
        transaction.clearHistory === false
      )
    : (
        transaction.historyEntry === null &&
        transaction.historyEntryCount === 0 &&
        transaction.clearHistory === true
      );
}

export function commitLayerDocumentNexusSourceTransaction(
  state: LayerDocumentNexusState,
  action: Extract<
    LayerDocumentNexusAction,
    { kind: "commit-source-transaction" }
  >
): LayerDocumentNexusTransitionResult {
  const transaction = action.transaction;
  const invalid = validateNexusTransactionAfter({
    state,
    transaction,
    plainValue: transaction,
  });
  if (invalid) return invalid;
  if (!validSourceHistoryContract(action)) {
    return failNexusTransition(
      state,
      "invalid-transaction",
      "Source transaction History policy/count/entry is inconsistent"
    );
  }
  const beforeSources =
    state.currentProject.payload.sourceRegistry.sourcesById;
  const afterSources =
    transaction.after.payload.sourceRegistry.sourcesById;
  const beforeLayers =
    state.currentProject.payload.layerDocumentsById;
  const afterLayers = transaction.after.payload.layerDocumentsById;
  const changedSourceIds = changedNexusRecordIds(
    beforeSources,
    afterSources
  );
  const changedLayerDocumentIds = changedNexusRecordIds(
    beforeLayers,
    afterLayers
  );
  if (
    !nexusIdsMatch(
      transaction.createdSourceIds,
      createdNexusRecordIds(beforeSources, afterSources)
    ) ||
    !nexusIdsMatch(
      transaction.deletedSourceIds,
      deletedNexusRecordIds(beforeSources, afterSources)
    ) ||
    !nexusIdsMatch(
      transaction.createdLayerDocumentIds,
      createdNexusRecordIds(beforeLayers, afterLayers)
    ) ||
    !nexusIdsMatch(
      transaction.deletedLayerDocumentIds,
      deletedNexusRecordIds(beforeLayers, afterLayers)
    ) ||
    (
      transaction.historyPolicy === "record-entry" &&
      transaction.historyEntry !== null &&
      (
        !nexusIdsMatch(
          transaction.historyEntry.affectedSourceIds,
          changedSourceIds
        ) ||
        !nexusIdsMatch(
          transaction.historyEntry.affectedLayerDocumentIds,
          changedLayerDocumentIds
        )
      )
    )
  ) {
    return failNexusTransition(
      state,
      "invalid-transaction",
      "Source transaction declared diff does not match its Project diff"
    );
  }

  const nextProject = cloneNexusPlainData(transaction.after);
  const activeGroupLayerDocumentId =
    normalizeActiveGroupLayerDocumentId(
      nextProject,
      state.session.activeGroupLayerDocumentId
    )!;
  const nextSession: LayerDocumentNexusSession = {
    layerSelection: applyLayerDocumentSelectionChange(
      nextProject,
      state.session.layerSelection,
      transaction.layerSelectionChange
    ).selection,
    sourceSelection: applyNexusSourceSelectionChange(
      nextProject,
      state.session.sourceSelection,
      transaction.sourceSelectionChange
    ),
    activeGroupLayerDocumentId,
  };
  const effect = projectTransitionEffect({
    cacheInvalidations: transaction.cacheInvalidations,
    sourceInvalidationsAreComplete:
      transaction.cacheInvalidations.length > 0,
    preserveSourceRuntime:
      transaction.kind === "import-sources-and-layers" ||
      transaction.kind === "discover-psd-nodes" ||
      (
        transaction.kind === "delete-source" &&
        transaction.deletedSourceIds.length === 0
      ),
    sourceInvalidationIds:
      transaction.kind === "delete-source"
        ? transaction.deletedSourceIds
        : [],
    sourceDisposalIds:
      transaction.cacheInvalidations.length === 0 &&
      (
        transaction.kind === "refresh-source" ||
        transaction.kind === "refresh-psd-document" ||
        transaction.kind === "reconnect-source"
      )
        ? changedSourceIds
        : [],
  });

  if (transaction.historyPolicy === "clear-history") {
    return successNexusTransition({
      previous: state,
      state: nexusStateWithStacks({
        project: nextProject,
        session: nextSession,
        runtimeSession: normalizeNexusRuntimeSession({
          project: nextProject,
          session: nextSession,
          runtimeSession: state.runtimeSession,
        }),
        undoStack: [],
        redoStack: [],
      }),
      effect,
    });
  }
  const sourceHistory = transaction.historyEntry!;
  if (sourceHistory.label.trim().length === 0) {
    return failNexusTransition(
      state,
      "invalid-transaction",
      "Source record-entry transaction requires a non-empty label"
    );
  }
  const historyEntry: LayerDocumentNexusHistoryEntry = {
    origin: "source-transaction",
    label: sourceHistory.label,
    affectedLayerDocumentIds: [
      ...sourceHistory.affectedLayerDocumentIds,
    ],
    affectedSourceIds: [...sourceHistory.affectedSourceIds],
    before: cloneNexusSnapshot({
      project: state.currentProject,
    }),
    after: cloneNexusSnapshot({
      project: nextProject,
    }),
  };
  const nextUndo = [
    ...state.undoStack,
    cloneNexusHistoryEntry(historyEntry),
  ];
  return successNexusTransition({
    previous: state,
    state: nexusStateWithStacks({
      project: nextProject,
      session: nextSession,
      runtimeSession: normalizeNexusRuntimeSession({
        project: nextProject,
        session: nextSession,
        runtimeSession: state.runtimeSession,
      }),
      undoStack: nextUndo,
      redoStack: [],
    }),
    effect,
  });
}
