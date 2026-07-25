import {
  applyLayerDocumentSelectionChange,
  normalizeActiveGroupLayerDocumentId,
} from "@/models";
import type {
  LayerDocumentOwnerHistoryEntry,
  LayerDocumentOwnerSession,
  LayerDocumentProjectOwnerAction,
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  applyOwnerSourceSelectionChange,
  cloneOwnerHistoryEntry,
  cloneOwnerPlainData,
  cloneOwnerSnapshot,
  normalizeOwnerPlaybackSession,
  ownerStateWithStacks,
} from "@/engines/project/helpers/layerDocumentProjectOwnerHelpers";
import {
  abandonedSourceRuntimeIds,
  changedOwnerRecordIds,
  createdOwnerRecordIds,
  deletedOwnerRecordIds,
  failOwnerTransition,
  ownerIdsMatch,
  projectTransitionEffect,
  successOwnerTransition,
  validateOwnerTransactionAfter,
} from "@/engines/project/actions/layerDocumentProjectOwnerTransitionHelpers";
import {
  normalizeOwnerRuntimeSession,
} from "@/engines/project/actions/layerDocumentProjectOwnerRuntimeSessionReducer";

function validSourceHistoryContract(
  action: Extract<
    LayerDocumentProjectOwnerAction,
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

export function commitLayerDocumentOwnerSourceTransaction(
  state: LayerDocumentProjectOwnerState,
  action: Extract<
    LayerDocumentProjectOwnerAction,
    { kind: "commit-source-transaction" }
  >
): LayerDocumentProjectOwnerTransitionResult {
  const transaction = action.transaction;
  const invalid = validateOwnerTransactionAfter({
    state,
    transaction,
    plainValue: transaction,
  });
  if (invalid) return invalid;
  if (!validSourceHistoryContract(action)) {
    return failOwnerTransition(
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
  const changedSourceIds = changedOwnerRecordIds(
    beforeSources,
    afterSources
  );
  const changedLayerDocumentIds = changedOwnerRecordIds(
    beforeLayers,
    afterLayers
  );
  if (
    !ownerIdsMatch(
      transaction.createdSourceIds,
      createdOwnerRecordIds(beforeSources, afterSources)
    ) ||
    !ownerIdsMatch(
      transaction.deletedSourceIds,
      deletedOwnerRecordIds(beforeSources, afterSources)
    ) ||
    !ownerIdsMatch(
      transaction.createdLayerDocumentIds,
      createdOwnerRecordIds(beforeLayers, afterLayers)
    ) ||
    deletedOwnerRecordIds(beforeLayers, afterLayers).length > 0 ||
    (
      transaction.historyPolicy === "record-entry" &&
      transaction.historyEntry !== null &&
      (
        !ownerIdsMatch(
          transaction.historyEntry.affectedSourceIds,
          changedSourceIds
        ) ||
        !ownerIdsMatch(
          transaction.historyEntry.affectedLayerDocumentIds,
          changedLayerDocumentIds
        )
      )
    )
  ) {
    return failOwnerTransition(
      state,
      "invalid-transaction",
      "Source transaction declared diff does not match its Project diff"
    );
  }

  const nextProject = cloneOwnerPlainData(transaction.after);
  const activeGroupLayerDocumentId =
    normalizeActiveGroupLayerDocumentId(
      nextProject,
      state.session.activeGroupLayerDocumentId
    )!;
  const nextSession: LayerDocumentOwnerSession = {
    layerSelection: applyLayerDocumentSelectionChange(
      nextProject,
      state.session.layerSelection,
      transaction.layerSelectionChange
    ).selection,
    sourceSelection: applyOwnerSourceSelectionChange(
      nextProject,
      state.session.sourceSelection,
      transaction.sourceSelectionChange
    ),
    activeGroupLayerDocumentId,
    playback: normalizeOwnerPlaybackSession({
      project: nextProject,
      activeGroupLayerDocumentId,
      playback: state.session.playback,
    })!,
  };
  const effect = projectTransitionEffect({
    cacheInvalidations: transaction.cacheInvalidations,
    sourceInvalidationsAreComplete:
      transaction.cacheInvalidations.length > 0,
    preserveSourceRuntime:
      transaction.kind === "import-sources-and-layers" ||
      transaction.kind === "discover-psd-nodes",
    sourceInvalidationIds:
      transaction.kind === "delete-source"
        ? transaction.deletedSourceIds
        : [],
    sourceDisposalIds:
      transaction.cacheInvalidations.length === 0 &&
      (
        transaction.kind === "refresh-source" ||
        transaction.kind === "refresh-psd-document" ||
        transaction.kind === "mark-source-missing" ||
        transaction.kind === "reconnect-source"
      )
        ? changedSourceIds
        : [],
  });

  if (transaction.historyPolicy === "clear-history") {
    return successOwnerTransition({
      previous: state,
      state: ownerStateWithStacks({
        project: nextProject,
        session: nextSession,
        runtimeSession: normalizeOwnerRuntimeSession({
          project: nextProject,
          session: nextSession,
          runtimeSession: state.runtimeSession,
        }),
        undoStack: [],
        redoStack: [],
      }),
      effect: {
        ...effect,
        suspendedSourceDisposalIds:
          abandonedSourceRuntimeIds({
            previous: state,
            nextUndo: [],
            nextRedo: [],
          }),
      },
    });
  }
  const sourceHistory = transaction.historyEntry!;
  if (sourceHistory.label.trim().length === 0) {
    return failOwnerTransition(
      state,
      "invalid-transaction",
      "Source record-entry transaction requires a non-empty label"
    );
  }
  const historyEntry: LayerDocumentOwnerHistoryEntry = {
    origin: "source-transaction",
    runtimeCachePolicy:
      transaction.kind === "delete-source"
        ? "apply-source-invalidations"
        : "preserve",
    sourceInvalidationIds:
      transaction.kind === "delete-source"
        ? [...transaction.deletedSourceIds]
        : [],
    label: sourceHistory.label,
    affectedLayerDocumentIds: [
      ...sourceHistory.affectedLayerDocumentIds,
    ],
    affectedSourceIds: [...sourceHistory.affectedSourceIds],
    before: cloneOwnerSnapshot({
      project: state.currentProject,
      session: state.session,
    }),
    after: cloneOwnerSnapshot({
      project: nextProject,
      session: nextSession,
    }),
  };
  const nextUndo = [
    ...state.undoStack,
    cloneOwnerHistoryEntry(historyEntry),
  ];
  return successOwnerTransition({
    previous: state,
    state: ownerStateWithStacks({
      project: nextProject,
      session: nextSession,
      runtimeSession: normalizeOwnerRuntimeSession({
        project: nextProject,
        session: nextSession,
        runtimeSession: state.runtimeSession,
      }),
      undoStack: nextUndo,
      redoStack: [],
    }),
    effect: {
      ...effect,
      suspendedSourceDisposalIds:
        abandonedSourceRuntimeIds({
          previous: state,
          nextUndo,
          nextRedo: [],
        }),
    },
  });
}
