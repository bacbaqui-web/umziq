import {
  type GroupLayerDocument,
  type LayerDocument,
  type LayerDocumentProject,
} from "@/models/layerDocumentModel";
import {
  type LayerDocumentTransaction,
  type LayerDocumentTransactionErrorCode,
  type LayerDocumentTransactionResult,
} from "@/models/layerDocumentTransactionModel";
import { validateLayerDocumentProject } from "@/models/layerDocumentValidation";

export function cloneTransactionData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function duplicateNameBase(label: string): {
  readonly base: string;
  readonly nextSuffix: number;
} {
  const normalized = label.trim();
  const match = /^(.*)_([0-9]+)$/.exec(normalized);
  const parsedSuffix = Number(match?.[2]);
  if (
    match?.[1]?.trim() &&
    Number.isSafeInteger(parsedSuffix) &&
    parsedSuffix >= 2
  ) {
    return {
      base: match[1],
      nextSuffix: parsedSuffix + 1,
    };
  }
  return {
    base: normalized,
    nextSuffix: 2,
  };
}

/**
 * Allocates the persisted duplicate label within the source Layer's sibling
 * scope. Layer names, placement aliases, and Source Registry display names
 * all reserve labels because any of them can be surfaced by a consumer.
 */
export function allocateDuplicateLayerDocumentDisplayName(
  project: LayerDocumentProject,
  sourceLayer: LayerDocument
): string {
  const parentId =
    sourceLayer.common.placement.parentLayerDocumentId;
  const reserved = new Set<string>();
  Object.values(project.payload.layerDocumentsById)
    .filter(
      (layer) =>
        layer.common.placement.parentLayerDocumentId === parentId
    )
    .forEach((layer) => {
      reserved.add(layer.name.trim());
      const alias = layer.common.placement.alias?.trim();
      if (alias) reserved.add(alias);
      const sourceId = layer.common.source?.sourceId;
      const sourceDisplayName = sourceId
        ? project.payload.sourceRegistry.sourcesById[
            sourceId
          ]?.displayName.trim()
        : null;
      if (sourceDisplayName) {
        reserved.add(sourceDisplayName);
      }
    });
  const displayedSourceName =
    sourceLayer.common.placement.alias?.trim() ||
    sourceLayer.name.trim();
  const { base, nextSuffix } =
    duplicateNameBase(displayedSourceName);
  for (
    let suffix = nextSuffix;
    suffix <= nextSuffix + reserved.size;
    suffix += 1
  ) {
    const candidate = `${base}_${suffix}`;
    if (!reserved.has(candidate)) return candidate;
  }
  return `${base}_${nextSuffix + reserved.size + 1}`;
}

export function failLayerDocumentTransaction(
  project: LayerDocumentProject,
  code: LayerDocumentTransactionErrorCode,
  message: string,
  validationIssues = validateLayerDocumentProject(project)
): LayerDocumentTransactionResult {
  return {
    ok: false,
    project,
    error: {
      code,
      message,
      validationIssues,
    },
  };
}

export function validateLayerDocumentTransactionInput(
  project: LayerDocumentProject
): LayerDocumentTransactionResult | null {
  const issues = validateLayerDocumentProject(project);
  return issues.length === 0
    ? null
    : failLayerDocumentTransaction(
        project,
        "invalid-before",
        `Input Layer Document project is invalid: ${issues[0].message}`,
        issues
      );
}

/**
 * Reconciles cache-invalidating revisions and History impact from the actual
 * semantic Layer diff. Existing changed Layers advance exactly once; created
 * Layers begin at revision zero. An empty semantic diff is a no-change error.
 */
export function completeLayerDocumentTransaction(
  transaction: LayerDocumentTransaction
): LayerDocumentTransactionResult {
  const beforeLayers = transaction.before.payload.layerDocumentsById;
  const afterLayers = transaction.after.payload.layerDocumentsById;
  const beforeIds = Object.keys(beforeLayers);
  const afterIds = Object.keys(afterLayers);
  const createdIds = afterIds.filter(
    (layerDocumentId) => !beforeLayers[layerDocumentId]
  );
  const deletedIds = beforeIds.filter(
    (layerDocumentId) => !afterLayers[layerDocumentId]
  );
  const changedExistingIds = beforeIds.filter((layerDocumentId) => {
    const afterLayer = afterLayers[layerDocumentId];
    if (!afterLayer) return false;
    const changed = !layerDocumentStoredValuesEqual(
      beforeLayers[layerDocumentId],
      afterLayer
    );
    afterLayer.revision = changed
      ? beforeLayers[layerDocumentId].revision + 1
      : beforeLayers[layerDocumentId].revision;
    return changed;
  });
  createdIds.forEach((layerDocumentId) => {
    afterLayers[layerDocumentId].revision = 0;
  });

  const affectedLayerDocumentIds = [
    ...createdIds,
    ...deletedIds,
    ...changedExistingIds,
  ].sort();
  if (affectedLayerDocumentIds.length === 0) {
    return failLayerDocumentTransaction(
      transaction.before,
      "no-change",
      "Semantic transaction did not change stored Layer Document data",
      []
    );
  }

  transaction.historyEntry.affectedLayerDocumentIds =
    affectedLayerDocumentIds;
  const issues = validateLayerDocumentProject(transaction.after);
  return issues.length === 0
    ? { ok: true, transaction }
    : failLayerDocumentTransaction(
        transaction.before,
        "invalid-after",
        `Transaction output is invalid: ${issues[0].message}`,
      issues
    );
}

function plainDataValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return (
      left.length === right.length &&
      left.every((value, index) =>
        plainDataValuesEqual(value, right[index])
      )
    );
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        plainDataValuesEqual(leftRecord[key], rightRecord[key])
    )
  );
}

/**
 * Revision is derived cache invalidation metadata. Semantic equality compares
 * every other stored Layer field and lets the completion boundary assign the
 * exact next revision.
 */
export function layerDocumentStoredValuesEqual(
  left: LayerDocument,
  right: LayerDocument
): boolean {
  const { revision: leftRevision, ...leftStoredValues } = left;
  const { revision: rightRevision, ...rightStoredValues } = right;
  void leftRevision;
  void rightRevision;
  return plainDataValuesEqual(leftStoredValues, rightStoredValues);
}

export function findLayerDocument(
  project: LayerDocumentProject,
  layerDocumentId: string
): LayerDocument | null {
  return project.payload.layerDocumentsById[layerDocumentId] ?? null;
}

export function isProjectRootLayer(layer: LayerDocument): boolean {
  return layer.type === "group" && layer.data.role === "project-root";
}

export function isGroupLayerDocument(
  layer: LayerDocument | null
): layer is GroupLayerDocument {
  return layer?.type === "group";
}

export function sortedSiblingLayerDocumentIds(
  project: LayerDocumentProject,
  parentLayerDocumentId: string | null,
  excludedIds: ReadonlySet<string> = new Set<string>()
): string[] {
  return Object.values(project.payload.layerDocumentsById)
    .filter(
      (layer) =>
        layer.common.placement.parentLayerDocumentId ===
          parentLayerDocumentId &&
        !excludedIds.has(layer.layerDocumentId)
    )
    .sort(
      (left, right) =>
        left.common.placement.order - right.common.placement.order ||
        left.layerDocumentId.localeCompare(right.layerDocumentId)
    )
    .map((layer) => layer.layerDocumentId);
}

export function assignSiblingLayerDocumentOrder(
  project: LayerDocumentProject,
  parentLayerDocumentId: string | null,
  orderedLayerDocumentIds: readonly string[]
) {
  orderedLayerDocumentIds.forEach((layerDocumentId, order) => {
    const layer = project.payload.layerDocumentsById[layerDocumentId];
    if (!layer) return;
    layer.common.placement.parentLayerDocumentId =
      parentLayerDocumentId;
    layer.common.placement.order = order;
  });
}

export function insertLayerDocumentAtOrder(
  siblingIds: readonly string[],
  layerDocumentId: string,
  requestedOrder: number
): string[] {
  const order = Math.min(
    Math.max(0, requestedOrder),
    siblingIds.length
  );
  const next = [...siblingIds];
  next.splice(order, 0, layerDocumentId);
  return next;
}

export function collectLayerDocumentSubtreeIds(
  project: LayerDocumentProject,
  rootLayerDocumentId: string
): string[] {
  const collected: string[] = [];
  const visit = (layerDocumentId: string) => {
    collected.push(layerDocumentId);
    sortedSiblingLayerDocumentIds(project, layerDocumentId).forEach(visit);
  };
  visit(rootLayerDocumentId);
  return collected;
}

export function allocateDescendantDuplicateLayerDocumentId(
  reservedIds: Set<string>,
  newRootLayerDocumentId: string,
  originalLayerDocumentId: string
): string | null {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const candidate =
      `${newRootLayerDocumentId}:${originalLayerDocumentId}${suffix}`;
    if (reservedIds.has(candidate)) continue;
    reservedIds.add(candidate);
    return candidate;
  }
  return null;
}
