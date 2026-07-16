import { useCallback } from "react";
import {
  getPsdTreeDropPosition,
  isValidPsdTreeDrop,
  reorderPsdTreeIds,
} from "@/engines/psd-tree/helpers/psdTreeDropHelpers";
import type { PsdTreeProjectCommandPort } from "@/engines/psd-tree/models/psdTreeModel";
import type { PsdTreeState } from "@/engines/psd-tree/state/usePsdTreeState";

type UseTreeReorderControllerOptions = {
  mainCompositionIds: readonly string[];
  reorderMainCompositions: PsdTreeProjectCommandPort["reorderMainCompositions"];
  state: Pick<
    PsdTreeState,
    | "draggedMainCompId"
    | "setDraggedMainCompId"
    | "dropTarget"
    | "setDropTarget"
  >;
};

export function useTreeReorderController({
  mainCompositionIds,
  reorderMainCompositions,
  state,
}: UseTreeReorderControllerOptions) {
  const clearDrag = useCallback(() => {
    state.setDraggedMainCompId(null);
    state.setDropTarget(null);
  }, [state]);

  const beginDrag = useCallback(
    (compId: string) => {
      if (!mainCompositionIds.includes(compId)) return;
      state.setDraggedMainCompId(compId);
      state.setDropTarget(null);
    },
    [mainCompositionIds, state]
  );

  const dragOver = useCallback(
    (targetId: string, pointerY: number, nodeTop: number, nodeHeight: number) => {
      if (
        !mainCompositionIds.includes(targetId) ||
        !isValidPsdTreeDrop(state.draggedMainCompId, targetId)
      ) {
        return false;
      }

      const position = getPsdTreeDropPosition(pointerY, nodeTop, nodeHeight);
      if (!position) return false;

      state.setDropTarget({ targetId, position });
      return true;
    },
    [mainCompositionIds, state]
  );

  const drop = useCallback(
    (targetId: string) => {
      const sourceId = state.draggedMainCompId;
      const target = state.dropTarget;
      if (
        !sourceId ||
        !target ||
        target.targetId !== targetId ||
        !isValidPsdTreeDrop(sourceId, targetId)
      ) {
        return;
      }

      const reorderedIds = reorderPsdTreeIds(
        mainCompositionIds,
        sourceId,
        targetId,
        target.position
      );
      if (reorderedIds !== mainCompositionIds) {
        reorderMainCompositions(sourceId, targetId, target.position);
      }
      clearDrag();
    },
    [clearDrag, mainCompositionIds, reorderMainCompositions, state]
  );

  return { beginDrag, dragOver, drop, endDrag: clearDrag };
}
