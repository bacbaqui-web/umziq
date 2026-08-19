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
  LayerDocumentNexusHistoryEntry,
  LayerDocumentNexusHistorySnapshot,
  LayerDocumentNexusRuntimeSession,
  LayerDocumentNexusSession,
  LayerDocumentNexusState,
} from "@/engines/project/models/layerDocumentNexusModel";
import type {
  LibrarySourceSelectionChange,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

export const cloneNexusPlainData = cloneTransactionData;

export function normalizeNexusSourceSelection(
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

export function applyNexusSourceSelectionChange(
  project: LayerDocumentProject,
  current: LibrarySourceSelection | null,
  change: LibrarySourceSelectionChange
): LibrarySourceSelection | null {
  switch (change.kind) {
    case "select":
      return normalizeNexusSourceSelection(project, change.selection);
    case "clear-if-selected":
      return current?.sourceId === change.sourceId
        ? null
        : normalizeNexusSourceSelection(project, current);
    case "clear":
      return null;
    case "preserve":
      return normalizeNexusSourceSelection(project, current);
  }
}

export function normalizeNexusSession(options: {
  project: LayerDocumentProject;
  layerSelection: LayerDocumentSelection | null;
  sourceSelection: LibrarySourceSelection | null;
  activeGroupLayerDocumentId?: string | null;
}): LayerDocumentNexusSession | null {
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
    sourceSelection: normalizeNexusSourceSelection(
      options.project,
      options.sourceSelection
    ),
    activeGroupLayerDocumentId,
  };
}

export function applyLayerTransactionNexusSession(options: {
  project: LayerDocumentProject;
  current: LayerDocumentNexusSession;
  selectionChange: Parameters<
    typeof applyLayerDocumentSelectionChange
  >[2];
}): LayerDocumentNexusSession {
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
    sourceSelection: normalizeNexusSourceSelection(
      options.project,
      options.current.sourceSelection
    ),
    activeGroupLayerDocumentId,
  };
}

export function cloneNexusSnapshot(options: {
  project: LayerDocumentProject;
}): LayerDocumentNexusHistorySnapshot {
  return cloneNexusPlainData(options.project);
}

export function cloneNexusHistoryEntry(
  entry: LayerDocumentNexusHistoryEntry
): LayerDocumentNexusHistoryEntry {
  return {
    origin: entry.origin,
    label: entry.label,
    affectedLayerDocumentIds: [...entry.affectedLayerDocumentIds],
    affectedSourceIds: [...entry.affectedSourceIds],
    before: cloneNexusSnapshot({
      project: entry.before,
    }),
    after: cloneNexusSnapshot({
      project: entry.after,
    }),
  };
}

export function validateNexusSnapshot(
  snapshot: LayerDocumentNexusHistorySnapshot
): {
  ok: true;
  snapshot: LayerDocumentNexusHistorySnapshot;
} | {
  ok: false;
  message: string;
} {
  const nonPlainPath = findNonPlainDataPath(snapshot);
  if (nonPlainPath) {
    return {
      ok: false,
      message: `Nexus snapshot contains non-Plain Data: ${nonPlainPath}`,
    };
  }
  const issues = validateLayerDocumentProject(snapshot);
  if (issues.length > 0) {
    return {
      ok: false,
      message: `Nexus snapshot Project is invalid: ${issues[0].message}`,
    };
  }
  return {
    ok: true,
    snapshot: cloneNexusSnapshot({ project: snapshot }),
  };
}

export function normalizeNexusSessionForHistory(options: {
  project: LayerDocumentProject;
  current: LayerDocumentNexusSession;
}): LayerDocumentNexusSession {
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
    sourceSelection: normalizeNexusSourceSelection(
      options.project,
      options.current.sourceSelection
    ),
    activeGroupLayerDocumentId,
  };
}

export function nexusStateWithStacks(options: {
  project: LayerDocumentProject;
  session: LayerDocumentNexusSession;
  runtimeSession?: LayerDocumentNexusRuntimeSession;
  undoStack: readonly LayerDocumentNexusHistoryEntry[];
  redoStack: readonly LayerDocumentNexusHistoryEntry[];
}): LayerDocumentNexusState {
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
