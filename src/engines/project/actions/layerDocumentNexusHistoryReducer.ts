import type {
  LayerDocumentNexusState,
  LayerDocumentNexusTransitionResult,
} from "@/engines/project/models/layerDocumentNexusModel";
import {
  cloneNexusHistoryEntry,
  normalizeNexusSessionForHistory,
  nexusStateWithStacks,
  validateNexusSnapshot,
} from "@/engines/project/helpers/layerDocumentNexusHelpers";
import {
  failNexusTransition,
  nexusSourceRuntimePresenceDiff,
  projectTransitionEffect,
  successNexusTransition,
} from "@/engines/project/actions/layerDocumentNexusTransitionHelpers";
import {
  normalizeNexusRuntimeSession,
} from "@/engines/project/actions/layerDocumentNexusRuntimeSessionReducer";

export function restoreLayerDocumentNexusHistory(
  state: LayerDocumentNexusState,
  direction: "undo" | "redo"
): LayerDocumentNexusTransitionResult {
  const sourceStack =
    direction === "undo" ? state.undoStack : state.redoStack;
  const entry = sourceStack[sourceStack.length - 1];
  if (!entry) {
    return failNexusTransition(
      state,
      direction === "undo" ? "undo-empty" : "redo-empty",
      `Cannot ${direction}: History stack is empty`
    );
  }
  const target = direction === "undo" ? entry.before : entry.after;
  const validated = validateNexusSnapshot(target);
  if (!validated.ok) {
    return failNexusTransition(
      state,
      "invalid-after",
      `Cannot restore History snapshot: ${validated.message}`
    );
  }
  const remaining = sourceStack.slice(0, -1);
  const nextUndo = direction === "undo"
    ? remaining
    : [...state.undoStack, cloneNexusHistoryEntry(entry)];
  const nextRedo = direction === "undo"
    ? [...state.redoStack, cloneNexusHistoryEntry(entry)]
    : remaining;
  const session = normalizeNexusSessionForHistory({
    project: validated.snapshot,
    current: state.session,
  });
  const sourceRuntimeDiff =
    nexusSourceRuntimePresenceDiff({
      from: state.currentProject,
      to: validated.snapshot,
    });
  return successNexusTransition({
    previous: state,
    state: nexusStateWithStacks({
      project: validated.snapshot,
      session,
      runtimeSession: normalizeNexusRuntimeSession({
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
