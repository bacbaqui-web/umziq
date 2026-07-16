import type { PsdTreeDropPosition } from "@/engines/psd-tree/models/psdTreeModel";

export function getPsdTreeDropPosition(
  pointerY: number,
  nodeTop: number,
  nodeHeight: number
): PsdTreeDropPosition | null {
  if (
    !Number.isFinite(pointerY) ||
    !Number.isFinite(nodeTop) ||
    !Number.isFinite(nodeHeight) ||
    nodeHeight <= 0
  ) {
    return null;
  }

  return pointerY - nodeTop < nodeHeight / 2 ? "before" : "after";
}

export function isValidPsdTreeDrop(
  sourceId: string | null,
  targetId: string | null
) {
  return !!sourceId && !!targetId && sourceId !== targetId;
}

export function reorderPsdTreeIds(
  ids: readonly string[],
  sourceId: string,
  targetId: string,
  position: PsdTreeDropPosition
) {
  if (!isValidPsdTreeDrop(sourceId, targetId)) {
    return ids;
  }

  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return ids;
  }

  const nextIds = [...ids];
  nextIds.splice(sourceIndex, 1);
  const nextTargetIndex = nextIds.indexOf(targetId);
  nextIds.splice(position === "before" ? nextTargetIndex : nextTargetIndex + 1, 0, sourceId);
  return nextIds.every((id, index) => id === ids[index]) ? ids : nextIds;
}
