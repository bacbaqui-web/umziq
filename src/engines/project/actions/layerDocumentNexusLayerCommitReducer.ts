import type {
  LayerDocumentNexusHistoryEntry,
  LayerDocumentNexusAction,
  LayerDocumentNexusState,
  LayerDocumentNexusTransitionResult,
} from "@/engines/project/models/layerDocumentNexusModel";
import {
  applyLayerTransactionNexusSession,
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
  plainDataValuesEqual,
} from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";
import {
  normalizeNexusRuntimeSession,
} from "@/engines/project/actions/layerDocumentNexusRuntimeSessionReducer";

export function commitLayerDocumentNexusTransaction(
  state: LayerDocumentNexusState,
  action: Extract<
    LayerDocumentNexusAction,
    { kind: "commit-layer-transaction" }
  >
): LayerDocumentNexusTransitionResult {
  const transaction = action.transaction;
  const invalid = validateNexusTransactionAfter({
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
    return failNexusTransition(
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
    !nexusIdsMatch(
      transaction.historyEntry.affectedLayerDocumentIds,
      changedNexusRecordIds(beforeLayers, afterLayers)
    ) ||
    !nexusIdsMatch(
      transaction.createdLayerDocumentIds,
      createdNexusRecordIds(beforeLayers, afterLayers)
    ) ||
    !nexusIdsMatch(
      transaction.deletedLayerDocumentIds,
      deletedNexusRecordIds(beforeLayers, afterLayers)
    )
  ) {
    return failNexusTransition(
      state,
      "invalid-transaction",
      "Layer transaction declared diff does not match its Project diff"
    );
  }

  const nextProject = cloneNexusPlainData(transaction.after);
  const nextSession = applyLayerTransactionNexusSession({
    project: nextProject,
    current: state.session,
    selectionChange: transaction.selectionChange,
  });
  const historyEntry: LayerDocumentNexusHistoryEntry = {
    origin: "layer-transaction",
    label: transaction.historyEntry.label,
    affectedLayerDocumentIds: [
      ...transaction.historyEntry.affectedLayerDocumentIds,
    ],
    affectedSourceIds: [],
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
  const nextState = nexusStateWithStacks({
    project: nextProject,
    session: nextSession,
    runtimeSession: normalizeNexusRuntimeSession({
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
  return successNexusTransition({
    previous: state,
    state: nextState,
    effect: projectTransitionEffect({
      preserveSourceRuntime: true,
    }),
  });
}
