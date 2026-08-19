import {
  findNonPlainDataPath,
  validateLayerDocumentProject,
  type LayerDocumentProject,
} from "@/models";
import {
  cloneNexusPlainData,
  normalizeNexusSession,
  nexusStateWithStacks,
} from "@/engines/project/helpers/layerDocumentNexusHelpers";
import {
  failNexusTransition,
  projectTransitionEffect,
  successNexusTransition,
} from "@/engines/project/actions/layerDocumentNexusTransitionHelpers";
import type {
  LayerDocumentNexusState,
  LayerDocumentNexusTransitionResult,
} from "@/engines/project/models/layerDocumentNexusModel";

export function replaceLayerDocumentNexusProject(
  state: LayerDocumentNexusState,
  candidate: LayerDocumentProject
): LayerDocumentNexusTransitionResult {
  const nonPlainPath = findNonPlainDataPath(candidate);
  if (nonPlainPath) {
    return failNexusTransition(
      state,
      "non-plain-data",
      `Replacement Project contains non-Plain Data: ${nonPlainPath}`
    );
  }
  const issues = validateLayerDocumentProject(candidate);
  if (issues.length > 0) {
    return failNexusTransition(
      state,
      "invalid-replacement",
      `Replacement Project is invalid: ${issues[0].message}`
    );
  }
  const currentProject = cloneNexusPlainData(candidate);
  const session = normalizeNexusSession({
    project: currentProject,
    layerSelection: null,
    sourceSelection: null,
    activeGroupLayerDocumentId: null,
  });
  if (!session) {
    return failNexusTransition(
      state,
      "invalid-replacement",
      "Replacement Project has no valid root Group session"
    );
  }
  return successNexusTransition({
    previous: state,
    state: nexusStateWithStacks({
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
