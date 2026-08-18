import {
  applyLayerDocumentSelectionChange,
  findNonPlainDataPath,
  normalizeActiveGroupLayerDocumentId,
  normalizeLayerDocumentSelection,
  validateLayerDocumentProject,
  type LayerDocumentProject,
  type LayerDocumentSelection,
  type LibrarySourceSelection,
} from "@/models";
import {
  cloneTransactionData,
} from "@/models/layerDocumentTransactionHelpers";
import type {
  LayerDocumentOwnerHistoryEntry,
  LayerDocumentOwnerHistorySnapshot,
  LayerDocumentOwnerRuntimeSession,
  LayerDocumentOwnerSession,
  LayerDocumentProjectOwnerState,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import type {
  LibrarySourceSelectionChange,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

export const cloneOwnerPlainData = cloneTransactionData;

export function normalizeOwnerSourceSelection(
  project: LayerDocumentProject,
  selection: LibrarySourceSelection | null
): LibrarySourceSelection | null {
  if (
    selection?.kind !== "library-source" ||
    typeof selection.sourceId !== "string" ||
    !project.payload.sourceRegistry.sourcesById[selection.sourceId]
  ) return null;
  return {
    kind: "library-source",
    sourceId: selection.sourceId,
  };
}

export function applyOwnerSourceSelectionChange(
  project: LayerDocumentProject,
  current: LibrarySourceSelection | null,
  change: LibrarySourceSelectionChange
): LibrarySourceSelection | null {
  switch (change.kind) {
    case "select":
      return normalizeOwnerSourceSelection(project, change.selection);
    case "clear-if-selected":
      return current?.sourceId === change.sourceId
        ? null
        : normalizeOwnerSourceSelection(project, current);
    case "clear":
      return null;
    case "preserve":
      return normalizeOwnerSourceSelection(project, current);
  }
}

export function normalizeOwnerSession(options: {
  project: LayerDocumentProject;
  layerSelection: LayerDocumentSelection | null;
  sourceSelection: LibrarySourceSelection | null;
  activeGroupLayerDocumentId?: string | null;
}): LayerDocumentOwnerSession | null {
  const activeGroupLayerDocumentId =
    normalizeActiveGroupLayerDocumentId(
      options.project,
      options.activeGroupLayerDocumentId
    );
  if (!activeGroupLayerDocumentId) return null;
  return {
    layerSelection: normalizeLayerDocumentSelection(
      options.project,
      options.layerSelection
    ).selection,
    sourceSelection: normalizeOwnerSourceSelection(
      options.project,
      options.sourceSelection
    ),
    activeGroupLayerDocumentId,
  };
}

export function applyLayerTransactionOwnerSession(options: {
  project: LayerDocumentProject;
  current: LayerDocumentOwnerSession;
  selectionChange: Parameters<
    typeof applyLayerDocumentSelectionChange
  >[2];
}): LayerDocumentOwnerSession {
  const activeGroupLayerDocumentId =
    normalizeActiveGroupLayerDocumentId(
      options.project,
      options.current.activeGroupLayerDocumentId
    )!;
  return {
    layerSelection: applyLayerDocumentSelectionChange(
      options.project,
      options.current.layerSelection,
      options.selectionChange
    ).selection,
    sourceSelection: normalizeOwnerSourceSelection(
      options.project,
      options.current.sourceSelection
    ),
    activeGroupLayerDocumentId,
  };
}

export function cloneOwnerSnapshot(options: {
  project: LayerDocumentProject;
}): LayerDocumentOwnerHistorySnapshot {
  return cloneOwnerPlainData(options.project);
}

export function cloneOwnerHistoryEntry(
  entry: LayerDocumentOwnerHistoryEntry
): LayerDocumentOwnerHistoryEntry {
  return {
    origin: entry.origin,
    label: entry.label,
    affectedLayerDocumentIds: [...entry.affectedLayerDocumentIds],
    affectedSourceIds: [...entry.affectedSourceIds],
    before: cloneOwnerSnapshot({
      project: entry.before,
    }),
    after: cloneOwnerSnapshot({
      project: entry.after,
    }),
  };
}

export function validateOwnerSnapshot(
  snapshot: LayerDocumentOwnerHistorySnapshot
): {
  ok: true;
  snapshot: LayerDocumentOwnerHistorySnapshot;
} | {
  ok: false;
  message: string;
} {
  const nonPlainPath = findNonPlainDataPath(snapshot);
  if (nonPlainPath) {
    return {
      ok: false,
      message: `Owner snapshot contains non-Plain Data: ${nonPlainPath}`,
    };
  }
  const issues = validateLayerDocumentProject(snapshot);
  if (issues.length > 0) {
    return {
      ok: false,
      message: `Owner snapshot Project is invalid: ${issues[0].message}`,
    };
  }
  return {
    ok: true,
    snapshot: cloneOwnerSnapshot({ project: snapshot }),
  };
}

export function normalizeOwnerSessionForHistory(options: {
  project: LayerDocumentProject;
  current: LayerDocumentOwnerSession;
}): LayerDocumentOwnerSession {
  const activeGroupLayerDocumentId =
    normalizeActiveGroupLayerDocumentId(
      options.project,
      options.current.activeGroupLayerDocumentId
    )!;
  const normalizedLayerSelection =
    normalizeLayerDocumentSelection(
      options.project,
      options.current.layerSelection
    ).selection;
  return {
    layerSelection:
      options.current.layerSelection &&
      !normalizedLayerSelection
        ? {
            kind: "layer-document",
            layerDocumentId:
              activeGroupLayerDocumentId,
          }
        : normalizedLayerSelection,
    sourceSelection: normalizeOwnerSourceSelection(
      options.project,
      options.current.sourceSelection
    ),
    activeGroupLayerDocumentId,
  };
}

export function ownerStateWithStacks(options: {
  project: LayerDocumentProject;
  session: LayerDocumentOwnerSession;
  runtimeSession?: LayerDocumentOwnerRuntimeSession;
  undoStack: readonly LayerDocumentOwnerHistoryEntry[];
  redoStack: readonly LayerDocumentOwnerHistoryEntry[];
}): LayerDocumentProjectOwnerState {
  return {
    currentProject: options.project,
    session: options.session,
    runtimeSession: options.runtimeSession ?? {
      selectedTransformKeyframe: null,
    },
    undoStack: options.undoStack,
    redoStack: options.redoStack,
    canUndo: options.undoStack.length > 0,
    canRedo: options.redoStack.length > 0,
  };
}
