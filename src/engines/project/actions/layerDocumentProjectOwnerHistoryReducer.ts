import type {
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  cloneOwnerHistoryEntry,
  normalizeOwnerSessionForHistory,
  ownerStateWithStacks,
  validateOwnerSnapshot,
} from "@/engines/project/helpers/layerDocumentProjectOwnerHelpers";
import {
  failOwnerTransition,
  ownerSourceRuntimePresenceDiff,
  projectTransitionEffect,
  successOwnerTransition,
} from "@/engines/project/actions/layerDocumentProjectOwnerTransitionHelpers";
import {
  normalizeOwnerRuntimeSession,
} from "@/engines/project/actions/layerDocumentProjectOwnerRuntimeSessionReducer";

export function restoreLayerDocumentOwnerHistory(
  state: LayerDocumentProjectOwnerState,
  direction: "undo" | "redo"
): LayerDocumentProjectOwnerTransitionResult {
  const sourceStack =
    direction === "undo" ? state.undoStack : state.redoStack;
  const entry = sourceStack[sourceStack.length - 1];
  if (!entry) {
    return failOwnerTransition(
      state,
      direction === "undo" ? "undo-empty" : "redo-empty",
      `Cannot ${direction}: History stack is empty`
    );
  }
  const target = direction === "undo" ? entry.before : entry.after;
  const validated = validateOwnerSnapshot(target);
  if (!validated.ok) {
    return failOwnerTransition(
      state,
      "invalid-after",
      `Cannot restore History snapshot: ${validated.message}`
    );
  }
  const remaining = sourceStack.slice(0, -1);
  const nextUndo = direction === "undo"
    ? remaining
    : [...state.undoStack, cloneOwnerHistoryEntry(entry)];
  const nextRedo = direction === "undo"
    ? [...state.redoStack, cloneOwnerHistoryEntry(entry)]
    : remaining;
  const session = normalizeOwnerSessionForHistory({
    project: validated.snapshot,
    current: state.session,
  });
  const sourceRuntimeDiff =
    ownerSourceRuntimePresenceDiff({
      from: state.currentProject,
      to: validated.snapshot,
    });
  return successOwnerTransition({
    previous: state,
    state: ownerStateWithStacks({
      project: validated.snapshot,
      session,
      runtimeSession: normalizeOwnerRuntimeSession({
        project: validated.snapshot,
        session,
        runtimeSession: state.runtimeSession,
      }),
      undoStack: nextUndo,
      redoStack: nextRedo,
    }),
    effect: projectTransitionEffect({
      preserveSourceRuntime:
        sourceRuntimeDiff.sourceInvalidationIds.length === 0 &&
        sourceRuntimeDiff.sourceRestorationIds.length === 0,
      ...sourceRuntimeDiff,
    }),
  });
}
