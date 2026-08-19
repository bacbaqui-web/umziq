import {
  applyLayerDocumentSelectionChange,
  findNonPlainDataPath,
  normalizeActiveGroupLayerDocumentId,
  validateLayerDocumentProject,
} from "@/models";
import type {
  CreateLayerDocumentNexusOptions,
  LayerDocumentNexusSession,
  LayerDocumentNexusAction,
  LayerDocumentNexusInitializationResult,
  LayerDocumentNexusState,
  LayerDocumentNexusTransitionResult,
} from "@/engines/project/models/layerDocumentNexusModel";
import {
  cloneNexusPlainData,
  normalizeNexusSession,
  normalizeNexusSourceSelection,
  nexusStateWithStacks,
} from "@/engines/project/helpers/layerDocumentNexusHelpers";
import {
  failNexusTransition,
  successNexusTransition,
} from "@/engines/project/actions/layerDocumentNexusTransitionHelpers";
import { commitLayerDocumentNexusTransaction } from "@/engines/project/actions/layerDocumentNexusLayerCommitReducer";
import { commitLayerDocumentNexusSourceTransaction } from "@/engines/project/actions/layerDocumentNexusSourceCommitReducer";
import { restoreLayerDocumentNexusHistory } from "@/engines/project/actions/layerDocumentNexusHistoryReducer";
import { plainDataValuesEqual } from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";
import {
  normalizeNexusRuntimeSession,
  reduceNexusRuntimeKeyframeSelection,
  reduceNexusRuntimeSourceStatusAcknowledgment,
} from "@/engines/project/actions/layerDocumentNexusRuntimeSessionReducer";
import { replaceLayerDocumentNexusProject } from "@/engines/project/actions/layerDocumentNexusReplaceReducer";
import { commitLayerDocumentNexusCanvasSettings } from "@/engines/project/actions/layerDocumentNexusCanvasSettingsReducer";
function updateSession(
  state: LayerDocumentNexusState,
  action: Extract<
    LayerDocumentNexusAction,
    {
      kind:
        | "set-layer-selection"
        | "set-source-selection"
        | "set-active-group";
    }
  >
): LayerDocumentNexusTransitionResult {
  let nextSession: LayerDocumentNexusSession;
  switch (action.kind) {
    case "set-layer-selection":
      nextSession = {
        ...state.session,
        layerSelection: action.selection
          ? applyLayerDocumentSelectionChange(
              state.currentProject,
              state.session.layerSelection,
              {
                kind: "select",
                layerDocumentId: action.selection.layerDocumentId,
              }
            ).selection
          : null,
      };
      break;
    case "set-source-selection":
      nextSession = {
        ...state.session,
        sourceSelection: normalizeNexusSourceSelection(
          state.currentProject,
          action.selection
        ),
      };
      break;
    case "set-active-group": {
      const requested =
        state.currentProject.payload.layerDocumentsById[
          action.layerDocumentId
        ];
      const activeGroupLayerDocumentId =
        normalizeActiveGroupLayerDocumentId(
          state.currentProject,
          action.layerDocumentId
        );
      if (
        requested?.type !== "group" ||
        !activeGroupLayerDocumentId
      ) {
        return failNexusTransition(
          state,
          "invalid-session",
          "Active group must reference an existing Group Layer Document"
        );
      }
      nextSession = {
        ...state.session,
        activeGroupLayerDocumentId,
      };
      break;
    }
  }
  if (plainDataValuesEqual(state.session, nextSession)) {
    return successNexusTransition({ previous: state, state });
  }
  const renderScopeChanged =
    action.kind === "set-active-group";
  return successNexusTransition({
    previous: state,
    state: nexusStateWithStacks({
      project: state.currentProject,
      session: nextSession,
      runtimeSession:
        normalizeNexusRuntimeSession({
          project: state.currentProject,
          session: nextSession,
          runtimeSession:
            action.kind === "set-active-group"
              ? {
                  ...state.runtimeSession,
                  selectedTransformKeyframe: null,
                }
              : state.runtimeSession,
        }),
      undoStack: state.undoStack,
      redoStack: state.redoStack,
    }),
    effect: {
      clearDraft: renderScopeChanged || action.kind === "set-layer-selection",
      resetLocalUi: action.kind === "set-layer-selection" || action.kind === "set-active-group",
      stopPlayback: false,
      recomputeRender: renderScopeChanged,
      runtimeCachePolicy: "preserve",
      cacheInvalidations: [],
      sourceInvalidationIds: [], sourceRestorationIds: [], sourceDisposalIds: [],
    },
  });
}
export function createLayerDocumentNexusState(
  options: CreateLayerDocumentNexusOptions
): LayerDocumentNexusInitializationResult {
  const nonPlainPath = findNonPlainDataPath(options);
  if (nonPlainPath) {
    return {
      ok: false,
      error: {
        code: "non-plain-data",
        message: `Nexus initialization contains non-Plain Data: ` +
          nonPlainPath,
      },
    };
  }
  const issues = validateLayerDocumentProject(options.project);
  if (issues.length > 0) {
    return {
      ok: false,
      error: {
        code: "invalid-initial-state",
        message: `Initial nexus Project is invalid: ${issues[0].message}`,
      },
    };
  }
  const currentProject = cloneNexusPlainData(options.project);
  const session = normalizeNexusSession({
    project: currentProject,
    layerSelection: options.layerSelection ?? null,
    sourceSelection: options.sourceSelection ?? null,
    activeGroupLayerDocumentId:
      options.activeGroupLayerDocumentId,
  });
  if (!session) {
    return {
      ok: false,
      error: {
        code: "invalid-session",
        message: "Initial nexus session is invalid",
      },
    };
  }
  return {
    ok: true,
    state: nexusStateWithStacks({
      project: currentProject,
      session,
      undoStack: [],
      redoStack: [],
    }),
  };
}
export function reduceLayerDocumentNexus(
  state: LayerDocumentNexusState,
  action: LayerDocumentNexusAction
): LayerDocumentNexusTransitionResult {
  const nonPlainActionPath = findNonPlainDataPath(action);
  if (nonPlainActionPath) {
    return failNexusTransition(
      state,
      "non-plain-data",
      `Nexus action contains non-Plain Data: ${nonPlainActionPath}`
    );
  }
  switch (action.kind) {
    case "commit-layer-transaction":
      return commitLayerDocumentNexusTransaction(state, action);
    case "commit-source-transaction":
      return commitLayerDocumentNexusSourceTransaction(state, action);
    case "commit-canvas-settings":
      return commitLayerDocumentNexusCanvasSettings(state, action);
    case "replace-project":
      return replaceLayerDocumentNexusProject(state, action.project);
    case "undo":
      return restoreLayerDocumentNexusHistory(state, "undo");
    case "redo":
      return restoreLayerDocumentNexusHistory(state, "redo");
    case "set-layer-selection":
    case "set-source-selection":
    case "set-active-group":
      return updateSession(state, action);
    case "set-transform-keyframe-selection":
      return reduceNexusRuntimeKeyframeSelection(
        state, action.selection
      );
    case "acknowledge-source-status": return (
      reduceNexusRuntimeSourceStatusAcknowledgment(state, action.sourceId)
    );
  }
}
