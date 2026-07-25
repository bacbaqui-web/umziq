import {
  findNonPlainDataPath,
  validateLayerDocumentProject,
  type LayerDocumentProject,
} from "@/models";
import {
  cloneOwnerPlainData,
  normalizeOwnerSession,
  ownerStateWithStacks,
} from "@/engines/project/helpers/layerDocumentProjectOwnerHelpers";
import {
  failOwnerTransition,
  projectTransitionEffect,
  successOwnerTransition,
} from "@/engines/project/actions/layerDocumentProjectOwnerTransitionHelpers";
import type {
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";

export function replaceLayerDocumentOwnerProject(
  state: LayerDocumentProjectOwnerState,
  candidate: LayerDocumentProject
): LayerDocumentProjectOwnerTransitionResult {
  const nonPlainPath = findNonPlainDataPath(candidate);
  if (nonPlainPath) {
    return failOwnerTransition(
      state,
      "non-plain-data",
      `Replacement Project contains non-Plain Data: ${nonPlainPath}`
    );
  }
  const issues = validateLayerDocumentProject(candidate);
  if (issues.length > 0) {
    return failOwnerTransition(
      state,
      "invalid-replacement",
      `Replacement Project is invalid: ${issues[0].message}`
    );
  }
  const currentProject = cloneOwnerPlainData(candidate);
  const session = normalizeOwnerSession({
    project: currentProject,
    layerSelection: null,
    sourceSelection: null,
    activeGroupLayerDocumentId: null,
  });
  if (!session) {
    return failOwnerTransition(
      state,
      "invalid-replacement",
      "Replacement Project has no valid root Group session"
    );
  }
  return successOwnerTransition({
    previous: state,
    state: ownerStateWithStacks({
      project: currentProject,
      session,
      undoStack: [],
      redoStack: [],
    }),
    effect: projectTransitionEffect({
      stopPlayback: true,
    }),
  });
}
