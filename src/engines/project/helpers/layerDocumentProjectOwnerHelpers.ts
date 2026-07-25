import {
  applyLayerDocumentSelectionChange,
  findNonPlainDataPath,
  normalizeActiveGroupLayerDocumentId,
  normalizeLayerDocumentSelection,
  validateLayerDocumentProject,
  type LayerDocumentProject,
  type LayerDocumentSelection,
  type PsdTreeSourceSelection,
} from "@/models";
import {
  clampPlaybackFrame,
  createDefaultPlaybackRange,
  normalizePlaybackRange,
} from "@/engines/playback-render";
import {
  cloneTransactionData,
} from "@/models/layerDocumentTransactionHelpers";
import type {
  LayerDocumentOwnerHistoryEntry,
  LayerDocumentOwnerHistorySnapshot,
  LayerDocumentOwnerPlaybackSession,
  LayerDocumentOwnerRuntimeSession,
  LayerDocumentOwnerSession,
  LayerDocumentProjectOwnerState,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import type {
  PsdTreeSourceSelectionChange,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

export const cloneOwnerPlainData = cloneTransactionData;

export function activeGroupPlaybackMetadata(
  project: LayerDocumentProject,
  activeGroupLayerDocumentId?: string | null
): {
  durationFrames: number;
  frameRate: number;
} {
  const activeGroupId = normalizeActiveGroupLayerDocumentId(
    project,
    activeGroupLayerDocumentId
  );
  const root = activeGroupId
    ? project.payload.layerDocumentsById[activeGroupId]
    : null;
  return root?.type === "group"
    ? {
        durationFrames: Math.max(1, root.data.durationFrames),
        frameRate: Math.max(1, root.data.frameRate),
      }
    : { durationFrames: 1, frameRate: 1 };
}

function defaultPlaybackSession(
  project: LayerDocumentProject,
  activeGroupLayerDocumentId?: string | null
): LayerDocumentOwnerPlaybackSession {
  const metadata = activeGroupPlaybackMetadata(
    project,
    activeGroupLayerDocumentId
  );
  return {
    currentFrame: 0,
    range: createDefaultPlaybackRange(
      metadata.durationFrames,
      metadata.frameRate
    ),
  };
}

export function normalizeOwnerPlaybackSession(options: {
  project: LayerDocumentProject;
  activeGroupLayerDocumentId?: string | null;
  playback?: LayerDocumentOwnerPlaybackSession;
}): LayerDocumentOwnerPlaybackSession | null {
  const playback =
    options.playback ??
    defaultPlaybackSession(
      options.project,
      options.activeGroupLayerDocumentId
    );
  if (
    !Number.isFinite(playback.currentFrame) ||
    !Number.isFinite(playback.range.startFrame) ||
    !Number.isFinite(playback.range.endFrame)
  ) return null;
  const { durationFrames } = activeGroupPlaybackMetadata(
    options.project,
    options.activeGroupLayerDocumentId
  );
  return {
    currentFrame: clampPlaybackFrame(
      Math.floor(playback.currentFrame),
      durationFrames
    ),
    range: normalizePlaybackRange(playback.range, durationFrames),
  };
}

export function normalizeOwnerSourceSelection(
  project: LayerDocumentProject,
  selection: PsdTreeSourceSelection | null
): PsdTreeSourceSelection | null {
  if (
    selection?.kind !== "psd-tree-source" ||
    typeof selection.sourceId !== "string" ||
    !project.payload.sourceRegistry.sourcesById[selection.sourceId]
  ) return null;
  return {
    kind: "psd-tree-source",
    sourceId: selection.sourceId,
  };
}

export function applyOwnerSourceSelectionChange(
  project: LayerDocumentProject,
  current: PsdTreeSourceSelection | null,
  change: PsdTreeSourceSelectionChange
): PsdTreeSourceSelection | null {
  switch (change.kind) {
    case "select":
      return normalizeOwnerSourceSelection(project, change.selection);
    case "clear-if-selected":
      return current?.sourceId === change.sourceId
        ? null
        : normalizeOwnerSourceSelection(project, current);
    case "preserve":
      return normalizeOwnerSourceSelection(project, current);
  }
}

export function normalizeOwnerSession(options: {
  project: LayerDocumentProject;
  layerSelection: LayerDocumentSelection | null;
  sourceSelection: PsdTreeSourceSelection | null;
  activeGroupLayerDocumentId?: string | null;
  playback?: LayerDocumentOwnerPlaybackSession;
}): LayerDocumentOwnerSession | null {
  const activeGroupLayerDocumentId =
    normalizeActiveGroupLayerDocumentId(
      options.project,
      options.activeGroupLayerDocumentId
    );
  if (!activeGroupLayerDocumentId) return null;
  const playback = normalizeOwnerPlaybackSession({
    project: options.project,
    activeGroupLayerDocumentId,
    playback: options.playback,
  });
  if (!playback) return null;
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
    playback,
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
    playback: normalizeOwnerPlaybackSession({
      project: options.project,
      activeGroupLayerDocumentId,
      playback: options.current.playback,
    })!,
  };
}

export function cloneOwnerSnapshot(options: {
  project: LayerDocumentProject;
  session: LayerDocumentOwnerSession;
}): LayerDocumentOwnerHistorySnapshot {
  return {
    project: cloneOwnerPlainData(options.project),
    session: {
      layerSelection: options.session.layerSelection
        ? {
            kind: "layer-document",
            layerDocumentId:
              options.session.layerSelection.layerDocumentId,
          }
        : null,
      sourceSelection: options.session.sourceSelection
        ? {
            kind: "psd-tree-source",
            sourceId: options.session.sourceSelection.sourceId,
          }
        : null,
      activeGroupLayerDocumentId:
        options.session.activeGroupLayerDocumentId,
      playback: {
        currentFrame: options.session.playback.currentFrame,
        range: {
          startFrame: options.session.playback.range.startFrame,
          endFrame: options.session.playback.range.endFrame,
        },
      },
    },
  };
}

export function cloneOwnerHistoryEntry(
  entry: LayerDocumentOwnerHistoryEntry
): LayerDocumentOwnerHistoryEntry {
  return {
    origin: entry.origin,
    runtimeCachePolicy:
      entry.runtimeCachePolicy,
    sourceInvalidationIds: [
      ...entry.sourceInvalidationIds,
    ],
    label: entry.label,
    affectedLayerDocumentIds: [...entry.affectedLayerDocumentIds],
    affectedSourceIds: [...entry.affectedSourceIds],
    before: cloneOwnerSnapshot(entry.before),
    after: cloneOwnerSnapshot(entry.after),
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
  const issues = validateLayerDocumentProject(snapshot.project);
  if (issues.length > 0) {
    return {
      ok: false,
      message: `Owner snapshot Project is invalid: ${issues[0].message}`,
    };
  }
  const session = normalizeOwnerSession({
    project: snapshot.project,
    layerSelection: snapshot.session.layerSelection,
    sourceSelection: snapshot.session.sourceSelection,
    activeGroupLayerDocumentId:
      snapshot.session.activeGroupLayerDocumentId,
    playback: snapshot.session.playback,
  });
  if (!session) {
    return { ok: false, message: "Owner snapshot session is invalid" };
  }
  return {
    ok: true,
    snapshot: cloneOwnerSnapshot({
      project: snapshot.project,
      session,
    }),
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
