import type {
  LayerDocumentProject,
} from "@/models";
import {
  createInitialLayerDocumentNexusOptions,
} from "@/editor/layerDocumentEditorBootstrap";

let fallbackProjectIdSequence = 0;

function createDefaultProjectId() {
  const randomUuid =
    globalThis.crypto?.randomUUID;
  if (randomUuid) {
    return `umziq-project:${randomUuid.call(globalThis.crypto)}`;
  }
  fallbackProjectIdSequence += 1;
  return [
    "umziq-project",
    Date.now().toString(36),
    fallbackProjectIdSequence.toString(36),
    Math.random().toString(36).slice(2),
  ].join(":");
}

export function createNewLayerDocumentEditorProject(
  createProjectId: () => string =
    createDefaultProjectId
): LayerDocumentProject {
  const projectId = createProjectId().trim();
  if (!projectId) {
    throw new Error(
      "New Project identity must not be empty"
    );
  }
  const initial =
    createInitialLayerDocumentNexusOptions()
      .project;
  return {
    ...initial,
    metadata: {
      ...initial.metadata,
      projectId,
    },
  };
}

export function buildLayerDocumentLocalHandleKey(
  projectId: string,
  locatorId: string
) {
  return JSON.stringify([projectId, locatorId]);
}
