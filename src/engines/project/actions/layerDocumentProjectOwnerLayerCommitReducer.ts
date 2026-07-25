import type {
  LayerDocumentOwnerHistoryEntry,
  LayerDocumentProjectOwnerAction,
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  applyLayerTransactionOwnerSession,
  cloneOwnerHistoryEntry,
  cloneOwnerPlainData,
  cloneOwnerSnapshot,
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
  plainDataValuesEqual,
} from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";
import {
  normalizeOwnerRuntimeSession,
} from "@/engines/project/actions/layerDocumentProjectOwnerRuntimeSessionReducer";

export function commitLayerDocumentOwnerTransaction(
  state: LayerDocumentProjectOwnerState,
  action: Extract<
    LayerDocumentProjectOwnerAction,
    { kind: "commit-layer-transaction" }
  >
): LayerDocumentProjectOwnerTransitionResult {
  const transaction = action.transaction;
  const invalid = validateOwnerTransactionAfter({
    state,
    transaction,
    plainValue: transaction,
  });
  if (invalid) return invalid;
  if (
    !transaction.historyEntry ||
    transaction.historyEntry.label.trim().length === 0 ||
    transaction.historyEntry.affectedLayerDocumentIds.length === 0
  ) {
    return failOwnerTransition(
      state,
      "invalid-transaction",
      "Layer transaction requires one non-empty History entry"
    );
  }
  const beforeLayers =
    state.currentProject.payload.layerDocumentsById;
  const afterLayers = transaction.after.payload.layerDocumentsById;
  if (
    !plainDataValuesEqual(
      state.currentProject.payload.sourceRegistry,
      transaction.after.payload.sourceRegistry
    ) ||
    !ownerIdsMatch(
      transaction.historyEntry.affectedLayerDocumentIds,
      changedOwnerRecordIds(beforeLayers, afterLayers)
    ) ||
    !ownerIdsMatch(
      transaction.createdLayerDocumentIds,
      createdOwnerRecordIds(beforeLayers, afterLayers)
    ) ||
    !ownerIdsMatch(
      transaction.deletedLayerDocumentIds,
      deletedOwnerRecordIds(beforeLayers, afterLayers)
    )
  ) {
    return failOwnerTransition(
      state,
      "invalid-transaction",
      "Layer transaction declared diff does not match its Project diff"
    );
  }

  const nextProject = cloneOwnerPlainData(transaction.after);
  const nextSession = applyLayerTransactionOwnerSession({
    project: nextProject,
    current: state.session,
    selectionChange: transaction.selectionChange,
  });
  const historyEntry: LayerDocumentOwnerHistoryEntry = {
    origin: "layer-transaction",
    runtimeCachePolicy: "preserve",
    sourceInvalidationIds: [],
    label: transaction.historyEntry.label,
    affectedLayerDocumentIds: [
      ...transaction.historyEntry.affectedLayerDocumentIds,
    ],
    affectedSourceIds: [],
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
  const nextState = ownerStateWithStacks({
    project: nextProject,
    session: nextSession,
    runtimeSession: normalizeOwnerRuntimeSession({
      project: nextProject,
      session: nextSession,
      runtimeSession:
        action.selectTransformKeyframe
          ? {
              selectedTransformKeyframe:
                action.selectTransformKeyframe,
              acknowledgedSourceStatuses:
                state.runtimeSession
                  .acknowledgedSourceStatuses,
            }
          : state.runtimeSession,
    }),
    undoStack: nextUndo,
    redoStack: [],
  });
  return successOwnerTransition({
    previous: state,
    state: nextState,
    effect: projectTransitionEffect({
      preserveSourceRuntime: true,
      suspendedSourceDisposalIds:
        abandonedSourceRuntimeIds({
          previous: state,
          nextUndo,
          nextRedo: [],
        }),
    }),
  });
}
