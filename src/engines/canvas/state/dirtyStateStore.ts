import {
  createCleanDirtyStateSnapshot,
  updateDirtyStateSnapshot,
} from "@/engines/canvas/helpers/dirtyStateHelpers";
import type {
  DirtySceneSnapshot,
  DirtyStateResource,
  DirtyStateSnapshot,
} from "@/engines/canvas/models/dirtyStateModel";

export function createDirtyState(
  initial: DirtySceneSnapshot | null = null
): DirtyStateResource {
  let snapshot: DirtyStateSnapshot = createCleanDirtyStateSnapshot(initial);

  return {
    updateDirtyState: (next) => {
      snapshot = updateDirtyStateSnapshot(snapshot, next);
      return snapshot;
    },
    clearDirtyState: () => {
      snapshot = createCleanDirtyStateSnapshot(snapshot.current);
      return snapshot;
    },
    resetDirtyState: () => {
      snapshot = createCleanDirtyStateSnapshot(null);
      return snapshot;
    },
    isDirty: () => snapshot.dirtyNodes.length > 0,
    getDirtyNodes: () => snapshot.dirtyNodes,
    getDirtySummary: () => snapshot.summary,
    getSnapshot: () => snapshot,
  };
}
