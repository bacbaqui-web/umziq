import { useCallback, useEffect, useRef, useState } from "react";
import type { LayerDocumentLibraryController } from "@/engines/project";
import type { LibraryAudioCommandPort } from "@/engines/library/models/libraryEngineModel";
import type {
  LibraryDropPosition,
  LibraryDropTarget,
  LibraryNodeViewModel,
} from "@/engines/library/models/libraryModel";
import {
  calculateLibraryDropPosition,
  canDropLibraryNode,
} from "@/engines/library/helpers/libraryDropTargetHelpers";
import {
  findLibraryKeyboardMoveTarget,
  findLibraryNode,
} from "@/engines/library/helpers/libraryTreeProjectionHelpers";

export function useLibraryDragController(options: {
  controller: LayerDocumentLibraryController;
  audio: LibraryAudioCommandPort;
  nodes: readonly LibraryNodeViewModel[];
  projectIdentity: string;
}) {
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LibraryDropTarget>(null);
  const dropTargetRef = useRef<LibraryDropTarget>(null);
  const candidateRef = useRef<{
    targetId: string;
    position: LibraryDropPosition;
    since: number;
  } | null>(null);

  const replaceDropTarget = useCallback((next: LibraryDropTarget) => {
    const current = dropTargetRef.current;
    if (
      current?.targetId === next?.targetId &&
      current?.position === next?.position
    ) {
      return;
    }
    dropTargetRef.current = next;
    setDropTarget(next);
  }, []);

  const end = useCallback(() => {
    setDraggedNodeId(null);
    candidateRef.current = null;
    replaceDropTarget(null);
  }, [replaceDropTarget]);

  useEffect(() => {
    const resetTimer = window.setTimeout(end, 0);
    return () => {
      window.clearTimeout(resetTimer);
      candidateRef.current = null;
      dropTargetRef.current = null;
    };
  }, [end, options.projectIdentity]);

  const begin = useCallback(
    (nodeId: string) => {
      setDraggedNodeId(nodeId);
      candidateRef.current = null;
      replaceDropTarget(null);
    },
    [replaceDropTarget]
  );

  const dragOver = useCallback(
    (
      targetId: string,
      pointerY: number,
      nodeTop: number,
      nodeHeight: number
    ) => {
      if (
        !draggedNodeId ||
        !canDropLibraryNode({
          nodes: options.nodes,
          draggedNodeId,
          targetNodeId: targetId,
        })
      ) {
        return false;
      }
      const target = findLibraryNode(options.nodes, targetId);
      if (!target) return false;
      const position = calculateLibraryDropPosition({
        target,
        pointerY,
        nodeTop,
        nodeHeight,
        current: dropTargetRef.current,
      });
      const current = dropTargetRef.current;
      if (current?.targetId === targetId && current.position === position) {
        candidateRef.current = null;
        return true;
      }
      const now = performance.now();
      const candidate = candidateRef.current;
      if (
        candidate?.targetId !== targetId ||
        candidate.position !== position
      ) {
        candidateRef.current = { targetId, position, since: now };
        return true;
      }
      if (now - candidate.since >= 120) {
        replaceDropTarget({ targetId, position });
        candidateRef.current = null;
      }
      return true;
    },
    [draggedNodeId, options.nodes, replaceDropTarget]
  );

  const drop = useCallback(
    (targetId: string) => {
      if (!draggedNodeId || dropTarget?.targetId !== targetId) return;
      const dragged = findLibraryNode(options.nodes, draggedNodeId);
      const target = findLibraryNode(options.nodes, targetId);
      if (dragged?.layerDocumentId && target?.layerDocumentId) {
        options.audio.move({
          layerDocumentId: dragged.layerDocumentId,
          targetLayerDocumentId: target.layerDocumentId,
          position: dropTarget.position,
        });
      }
      end();
    },
    [draggedNodeId, dropTarget, end, options.audio, options.nodes]
  );

  const moveKeyboard = useCallback(
    (nodeId: string, direction: -1 | 1) => {
      const project = options.controller.readProject();
      const node = findLibraryNode(options.nodes, nodeId);
      if (!node?.layerDocumentId) return;
      const target = findLibraryKeyboardMoveTarget({
        nodes: options.nodes,
        nodeId,
        direction,
        readParentId: (layerDocumentId) =>
          project.payload.layerDocumentsById[layerDocumentId]?.common.placement
            .parentLayerDocumentId ?? null,
        readOrder: (layerDocumentId) =>
          project.payload.layerDocumentsById[layerDocumentId]?.common.placement
            .order ?? 0,
      });
      if (!target?.layerDocumentId) return;
      options.audio.move({
        layerDocumentId: node.layerDocumentId,
        targetLayerDocumentId: target.layerDocumentId,
        position: direction < 0 ? "before" : "after",
      });
    },
    [options.audio, options.controller, options.nodes]
  );

  return {
    draggedNodeId,
    dropTarget,
    begin,
    dragOver,
    drop,
    end,
    moveKeyboard,
  };
}
