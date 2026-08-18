import type {
  LibraryDropPosition,
  LibraryDropTarget,
  LibraryNodeViewModel,
} from "@/engines/library/models/libraryModel";
import { flattenLibraryNodes } from "@/engines/library/helpers/libraryTreeProjectionHelpers";

export function canDropLibraryNode(options: {
  nodes: readonly LibraryNodeViewModel[];
  draggedNodeId: string;
  targetNodeId: string;
}) {
  if (options.draggedNodeId === options.targetNodeId) return false;
  const flat = flattenLibraryNodes(options.nodes);
  const dragged = flat.find((node) => node.id === options.draggedNodeId);
  const target = flat.find((node) => node.id === options.targetNodeId);
  if (!dragged?.canReorder || !target) return false;
  return dragged.type === "main"
    ? target.type === "main"
    : target.type !== "project";
}

export function calculateLibraryDropPosition(options: {
  target: LibraryNodeViewModel;
  pointerY: number;
  nodeTop: number;
  nodeHeight: number;
  current: LibraryDropTarget;
}): LibraryDropPosition {
  const relativeY =
    (options.pointerY - options.nodeTop) / Math.max(1, options.nodeHeight);
  const canContain =
    options.target.type === "main" ||
    options.target.entityKind === "composition";
  if (options.current?.targetId === options.target.id) {
    if (options.current.position === "before" && relativeY < 0.42) {
      return "before";
    }
    if (options.current.position === "after" && relativeY > 0.58) {
      return "after";
    }
    if (
      options.current.position === "inside" &&
      canContain &&
      relativeY >= 0.2 &&
      relativeY <= 0.8
    ) {
      return "inside";
    }
  }
  return canContain && relativeY >= 0.3 && relativeY <= 0.7
    ? "inside"
    : relativeY < 0.5
      ? "before"
      : "after";
}
