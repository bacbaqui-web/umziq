import {
  applyLayerDocumentSelectionChange,
  findNonPlainDataPath,
  normalizeActiveGroupLayerDocumentId,
  validateLayerDocumentProject,
} from "@/models";
import type {
  CreateLayerDocumentProjectOwnerOptions,
  LayerDocumentOwnerSession,
  LayerDocumentProjectOwnerAction,
  LayerDocumentProjectOwnerInitializationResult,
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  cloneOwnerPlainData,
  normalizeOwnerSession,
  normalizeOwnerSourceSelection,
  ownerStateWithStacks,
} from "@/engines/project/helpers/layerDocumentProjectOwnerHelpers";
import {
  failOwnerTransition,
  successOwnerTransition,
} from "@/engines/project/actions/layerDocumentProjectOwnerTransitionHelpers";
import { commitLayerDocumentOwnerTransaction } from "@/engines/project/actions/layerDocumentProjectOwnerLayerCommitReducer";
import { commitLayerDocumentOwnerSourceTransaction } from "@/engines/project/actions/layerDocumentProjectOwnerSourceCommitReducer";
import { restoreLayerDocumentOwnerHistory } from "@/engines/project/actions/layerDocumentProjectOwnerHistoryReducer";
import { plainDataValuesEqual } from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";
import {
  normalizeOwnerRuntimeSession,
  reduceOwnerRuntimeKeyframeSelection,
  reduceOwnerRuntimeSourceStatusAcknowledgment,
} from "@/engines/project/actions/layerDocumentProjectOwnerRuntimeSessionReducer";
import { replaceLayerDocumentOwnerProject } from "@/engines/project/actions/layerDocumentProjectOwnerReplaceReducer";
function updateSession(
  state: LayerDocumentProjectOwnerState,
  action: Extract<
    LayerDocumentProjectOwnerAction,
    {
      kind:
        | "set-layer-selection"
        | "set-source-selection"
        | "set-active-group";
    }
  >
): LayerDocumentProjectOwnerTransitionResult {
  let nextSession: LayerDocumentOwnerSession;
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
        sourceSelection: normalizeOwnerSourceSelection(
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
        return failOwnerTransition(
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
    return successOwnerTransition({ previous: state, state });
  }
  const renderScopeChanged =
    action.kind === "set-active-group";
  return successOwnerTransition({
    previous: state,
    state: ownerStateWithStacks({
      project: state.currentProject,
      session: nextSession,
      runtimeSession:
        normalizeOwnerRuntimeSession({
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
export function createLayerDocumentProjectOwnerState(
  options: CreateLayerDocumentProjectOwnerOptions
): LayerDocumentProjectOwnerInitializationResult {
  const nonPlainPath = findNonPlainDataPath(options);
  if (nonPlainPath) {
    return {
      ok: false,
      error: {
        code: "non-plain-data",
        message: `Owner initialization contains non-Plain Data: ` +
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
        message: `Initial owner Project is invalid: ${issues[0].message}`,
      },
    };
  }
  const currentProject = cloneOwnerPlainData(options.project);
  const session = normalizeOwnerSession({
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
        message: "Initial owner session is invalid",
      },
    };
  }
  return {
    ok: true,
    state: ownerStateWithStacks({
      project: currentProject,
      session,
      undoStack: [],
      redoStack: [],
    }),
  };
}
export function reduceLayerDocumentProjectOwner(
  state: LayerDocumentProjectOwnerState,
  action: LayerDocumentProjectOwnerAction
): LayerDocumentProjectOwnerTransitionResult {
  const nonPlainActionPath = findNonPlainDataPath(action);
  if (nonPlainActionPath) {
    return failOwnerTransition(
      state,
      "non-plain-data",
      `Owner action contains non-Plain Data: ${nonPlainActionPath}`
    );
  }
  switch (action.kind) {
    case "commit-layer-transaction":
      return commitLayerDocumentOwnerTransaction(state, action);
    case "commit-source-transaction":
      return commitLayerDocumentOwnerSourceTransaction(state, action);
    case "replace-project":
      return replaceLayerDocumentOwnerProject(state, action.project);
    case "undo":
      return restoreLayerDocumentOwnerHistory(state, "undo");
    case "redo":
      return restoreLayerDocumentOwnerHistory(state, "redo");
    case "set-layer-selection":
    case "set-source-selection":
    case "set-active-group":
      return updateSession(state, action);
    case "set-transform-keyframe-selection":
      return reduceOwnerRuntimeKeyframeSelection(
        state, action.selection
      );
    case "acknowledge-source-status": return (
      reduceOwnerRuntimeSourceStatusAcknowledgment(state, action.sourceId)
    );
  }
}
