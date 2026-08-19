import { validateLayerDocumentProject } from "@/models";
import type {
  LayerDocumentNexusAction,
  LayerDocumentNexusState,
  LayerDocumentNexusTransitionResult,
} from "@/engines/project/models/layerDocumentNexusModel";
import {
  cloneNexusHistoryEntry,
  cloneNexusPlainData,
  cloneNexusSnapshot,
  nexusStateWithStacks,
} from "@/engines/project/helpers/layerDocumentNexusHelpers";
import {
  failNexusTransition,
  successNexusTransition,
} from "@/engines/project/actions/layerDocumentNexusTransitionHelpers";
import { plainDataValuesEqual } from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";

export function commitLayerDocumentNexusCanvasSettings(
  state: LayerDocumentNexusState,
  action: Extract<LayerDocumentNexusAction, { kind: "commit-canvas-settings" }>
): LayerDocumentNexusTransitionResult {
  const nextProject = cloneNexusPlainData(state.currentProject);
  nextProject.payload.canvasSettings = cloneNexusPlainData(action.settings);
  const issues = validateLayerDocumentProject(nextProject);
  if (issues.length > 0) {
    return failNexusTransition(state, "invalid-after", issues[0].message);
  }
  if (plainDataValuesEqual(
    state.currentProject.payload.canvasSettings,
    nextProject.payload.canvasSettings
  )) {
    return successNexusTransition({ previous: state, state });
  }
  const historyEntry = {
    origin: "canvas-settings" as const,
    label: action.label,
    affectedLayerDocumentIds: [],
    affectedSourceIds: [],
    before: cloneNexusSnapshot({ project: state.currentProject }),
    after: cloneNexusSnapshot({ project: nextProject }),
  };
  const nextState = nexusStateWithStacks({
    project: nextProject,
    session: state.session,
    runtimeSession: state.runtimeSession,
    undoStack: [...state.undoStack, cloneNexusHistoryEntry(historyEntry)],
    redoStack: [],
  });
  return successNexusTransition({
    previous: state,
    state: nextState,
    effect: {
      clearDraft: false,
      resetLocalUi: false,
      stopPlayback: false,
      recomputeRender: true,
      runtimeCachePolicy: "preserve",
      cacheInvalidations: [],
      sourceInvalidationIds: [],
      sourceRestorationIds: [],
      sourceDisposalIds: [],
    },
  });
}
