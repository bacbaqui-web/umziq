import type { Position, Scale } from "@/models";
import type { PreviewNode, PreviewScene } from "@/engines/playback-render";
import {
  DIRTY_KINDS,
  type DirtyKind,
  type DirtyNodeRecord,
  type DirtyNodeSnapshot,
  type DirtySceneSnapshot,
  type DirtyStateSnapshot,
  type DirtySummary,
  type PreviewSceneDirtySnapshotOptions,
} from "@/engines/canvas/models/dirtyStateModel";

function createEmptyDirtySummary(): DirtySummary {
  return {
    dirtyNodeCount: 0,
    transform: 0,
    opacity: 0,
    visibility: 0,
    hierarchy: 0,
    order: 0,
    source: 0,
    frame: 0,
    logicalSize: 0,
    composition: 0,
  };
}

export function createCleanDirtyStateSnapshot(
  current: DirtySceneSnapshot | null
): DirtyStateSnapshot {
  return {
    current,
    dirtyNodes: [],
    summary: createEmptyDirtySummary(),
  };
}

function isSamePosition(left: Position, right: Position): boolean {
  return left.x === right.x && left.y === right.y;
}

function isSameScale(left: Scale, right: Scale): boolean {
  return left.x === right.x && left.y === right.y;
}

function isSameLogicalSize(
  left: { width: number; height: number },
  right: { width: number; height: number }
): boolean {
  return left.width === right.width && left.height === right.height;
}

function isSameChildrenIds(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

function isSameChildrenSet(
  left: readonly string[],
  right: readonly string[]
): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

function hasTransformDirty(
  previous: DirtyNodeSnapshot,
  next: DirtyNodeSnapshot
): boolean {
  return (
    !isSamePosition(previous.transform.position, next.transform.position) ||
    !isSamePosition(previous.transform.anchor, next.transform.anchor) ||
    !isSamePosition(
      previous.transform.transformOffset,
      next.transform.transformOffset
    ) ||
    !isSameScale(previous.transform.scale, next.transform.scale) ||
    previous.transform.rotation !== next.transform.rotation
  );
}

function addDirtyKind(kinds: Set<DirtyKind>, kind: DirtyKind): void {
  kinds.add(kind);
}

function compareDirtyNode(
  previous: DirtyNodeSnapshot | undefined,
  next: DirtyNodeSnapshot
): { record: DirtyNodeRecord | null; childRecords: DirtyNodeRecord[] } {
  const dirtyKinds = new Set<DirtyKind>();
  const previousChildById = new Map(
    previous?.children.map((child) => [child.id, child]) ?? []
  );
  const childRecords = next.children.flatMap((child) => {
    const result = compareDirtyNode(previousChildById.get(child.id), child);
    return [
      ...(result.record ? [result.record] : []),
      ...result.childRecords,
    ];
  });

  if (!previous) {
    DIRTY_KINDS.forEach((kind) => addDirtyKind(dirtyKinds, kind));
  } else {
    if (previous.parentId !== next.parentId) {
      addDirtyKind(dirtyKinds, "hierarchy");
    }
    if (!isSameChildrenSet(previous.childrenIds, next.childrenIds)) {
      addDirtyKind(dirtyKinds, "hierarchy");
    }
    if (
      isSameChildrenSet(previous.childrenIds, next.childrenIds) &&
      !isSameChildrenIds(previous.childrenIds, next.childrenIds)
    ) {
      addDirtyKind(dirtyKinds, "order");
    }
    if (previous.order !== next.order) {
      addDirtyKind(dirtyKinds, "order");
    }
    if (
      previous.sourceId !== next.sourceId ||
      previous.sourceFingerprint !== next.sourceFingerprint
    ) {
      addDirtyKind(dirtyKinds, "source");
    }
    if (previous.localFrame !== next.localFrame || previous.globalFrame !== next.globalFrame) {
      addDirtyKind(dirtyKinds, "frame");
    }
    if (!isSameLogicalSize(previous.logicalSize, next.logicalSize)) {
      addDirtyKind(dirtyKinds, "logicalSize");
    }
    if (previous.visible !== next.visible) {
      addDirtyKind(dirtyKinds, "visibility");
    }
    if (previous.opacity !== next.opacity) {
      addDirtyKind(dirtyKinds, "opacity");
    }
    if (hasTransformDirty(previous, next)) {
      addDirtyKind(dirtyKinds, "transform");
    }
  }

  if (
    next.kind === "composition" &&
    (dirtyKinds.size > 0 || childRecords.length > 0)
  ) {
    addDirtyKind(dirtyKinds, "composition");
  }

  return {
    record:
      dirtyKinds.size > 0
        ? {
            id: next.id,
            kind: next.kind,
            dirtyKinds: Array.from(dirtyKinds),
          }
        : null,
    childRecords,
  };
}

function compareSceneDirty(
  previous: DirtySceneSnapshot | null,
  next: DirtySceneSnapshot | null
): DirtyNodeRecord[] {
  if (!next) return [];
  if (!previous) return [];
  const records: DirtyNodeRecord[] = [];
  const sceneKinds = new Set<DirtyKind>();

  if (previous.globalFrame !== next.globalFrame) addDirtyKind(sceneKinds, "frame");
  if (!isSameLogicalSize(previous.logicalSize, next.logicalSize)) {
    addDirtyKind(sceneKinds, "logicalSize");
  }
  if (!isSameChildrenSet(previous.childrenIds, next.childrenIds)) {
    addDirtyKind(sceneKinds, "hierarchy");
  }
  if (
    isSameChildrenSet(previous.childrenIds, next.childrenIds) &&
    !isSameChildrenIds(previous.childrenIds, next.childrenIds)
  ) {
    addDirtyKind(sceneKinds, "order");
  }
  if (sceneKinds.size > 0) {
    records.push({
      id: next.id,
      kind: "scene",
      dirtyKinds: Array.from(sceneKinds),
    });
  }

  const previousNodeById = new Map(previous.nodes.map((node) => [node.id, node]));
  next.nodes.forEach((node) => {
    const result = compareDirtyNode(previousNodeById.get(node.id), node);
    if (result.record) records.push(result.record);
    records.push(...result.childRecords);
  });

  return records;
}

export function buildDirtySummary(
  dirtyNodes: readonly DirtyNodeRecord[]
): DirtySummary {
  const summary = { ...createEmptyDirtySummary(), dirtyNodeCount: dirtyNodes.length };
  dirtyNodes.forEach((record) => {
    record.dirtyKinds.forEach((kind) => {
      summary[kind] += 1;
    });
  });
  return summary;
}

export function updateDirtyStateSnapshot(
  previous: DirtyStateSnapshot,
  next: DirtySceneSnapshot | null
): DirtyStateSnapshot {
  const dirtyNodes = compareSceneDirty(previous.current, next);
  return {
    current: next,
    dirtyNodes,
    summary: buildDirtySummary(dirtyNodes),
  };
}

function toDirtyNodeSnapshot(
  node: PreviewNode,
  options?: PreviewSceneDirtySnapshotOptions
): DirtyNodeSnapshot {
  const children = node.children.map((child) =>
    toDirtyNodeSnapshot(child, options)
  );
  return {
    id: node.id,
    kind: node.kind,
    parentId: node.parentId,
    childrenIds: children.map((child) => child.id),
    sourceId: node.sourceId,
    sourceFingerprint:
      node.sourceId
        ? options?.sourceFingerprintBySourceId?.get(node.sourceId) ?? null
        : null,
    transform: node.transform,
    opacity: node.opacity,
    visible: node.visible,
    order: node.order,
    localFrame: node.localFrame,
    globalFrame: node.globalFrame,
    logicalSize: node.logicalSize,
    children,
  };
}

export function createDirtySceneSnapshotFromPreviewScene(
  previewScene: PreviewScene | null,
  options?: PreviewSceneDirtySnapshotOptions
): DirtySceneSnapshot | null {
  if (!previewScene) return null;
  const nodes = previewScene.nodes.map((node) =>
    toDirtyNodeSnapshot(node, options)
  );
  return {
    id: previewScene.compositionId,
    kind: "scene",
    globalFrame: previewScene.globalFrame,
    logicalSize: previewScene.logicalSize,
    childrenIds: nodes.map((node) => node.id),
    nodes,
  };
}
