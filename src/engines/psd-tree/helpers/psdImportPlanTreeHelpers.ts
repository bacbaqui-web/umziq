import type { PsdImportPlanNode } from "@/engines/project";

export type PsdImportPlanDropPosition = "before" | "inside" | "after";

function normalizeNames(nodes: PsdImportPlanNode[]): PsdImportPlanNode[] {
  const counts = new Map<string, number>();
  nodes.forEach((node) => counts.set(node.originalName, (counts.get(node.originalName) ?? 0) + 1));
  const occurrences = new Map<string, number>();
  return nodes.map((node) => {
    const occurrence = (occurrences.get(node.originalName) ?? 0) + 1;
    occurrences.set(node.originalName, occurrence);
    const duplicate = (counts.get(node.originalName) ?? 0) > 1;
    return {
      ...node,
      displayName: duplicate ? `${node.originalName}_${occurrence}` : node.originalName,
      autoRenamed: duplicate,
      children: normalizeNames(node.children),
    };
  });
}

function containsNode(nodes: readonly PsdImportPlanNode[], nodeId: string): boolean {
  return nodes.some((node) => node.id === nodeId || containsNode(node.children, nodeId));
}

function removeNode(
  nodes: readonly PsdImportPlanNode[],
  nodeId: string
): { nodes: PsdImportPlanNode[]; removed: PsdImportPlanNode | null } {
  let removed: PsdImportPlanNode | null = null;
  const nextNodes: PsdImportPlanNode[] = [];
  nodes.forEach((node) => {
    if (node.id === nodeId) {
      removed = node;
      return;
    }
    const childResult = removeNode(node.children, nodeId);
    if (childResult.removed) removed = childResult.removed;
    nextNodes.push(childResult.removed ? { ...node, children: childResult.nodes } : node);
  });
  return { nodes: nextNodes, removed };
}

function insertNode(
  nodes: readonly PsdImportPlanNode[],
  targetId: string,
  position: PsdImportPlanDropPosition,
  dragged: PsdImportPlanNode
): { nodes: PsdImportPlanNode[]; inserted: boolean } {
  const nextNodes: PsdImportPlanNode[] = [];
  let inserted = false;

  nodes.forEach((node) => {
    if (node.id === targetId) {
      if (position === "before") nextNodes.push(dragged);
      if (position === "inside" && node.kind === "group") {
        nextNodes.push({ ...node, children: [...node.children, dragged] });
        inserted = true;
        return;
      }
      nextNodes.push(node);
      if (position === "after") nextNodes.push(dragged);
      inserted = position !== "inside" || node.kind === "group";
      return;
    }

    const childResult = insertNode(node.children, targetId, position, dragged);
    if (childResult.inserted) {
      nextNodes.push({ ...node, children: childResult.nodes });
      inserted = true;
    } else {
      nextNodes.push(node);
    }
  });

  return { nodes: nextNodes, inserted };
}

export function movePsdImportPlanNode(
  nodes: readonly PsdImportPlanNode[],
  draggedId: string,
  targetId: string | null,
  position: PsdImportPlanDropPosition
): PsdImportPlanNode[] {
  if (draggedId === targetId) return [...nodes];
  const dragged = findPsdImportPlanNode(nodes, draggedId);
  if (!dragged) return [...nodes];
  if (targetId && containsNode(dragged.children, targetId)) return [...nodes];

  const removed = removeNode(nodes, draggedId);
  if (!removed.removed) return [...nodes];
  const moved = targetId
    ? insertNode(removed.nodes, targetId, position, removed.removed)
    : { nodes: [...removed.nodes, removed.removed], inserted: true };
  return moved.inserted ? normalizeNames(moved.nodes) : [...nodes];
}

export function findPsdImportPlanNode(
  nodes: readonly PsdImportPlanNode[],
  nodeId: string
): PsdImportPlanNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findPsdImportPlanNode(node.children, nodeId);
    if (child) return child;
  }
  return null;
}
