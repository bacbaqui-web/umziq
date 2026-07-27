import {
  findNonPlainDataPath,
  layerDocumentSourceVisualFingerprint,
  validateLayerDocumentProject,
  type LayerDocumentProject,
  type SourceRegistryRecord,
} from "@/models";
import {
  buildLayerDocumentResultCacheKey,
  buildLayerDocumentSourceResourceCacheKey,
  layerDocumentSourceVisualKeyPolicy,
} from "@/render";
import {
  cloneTransactionData,
} from "@/models/layerDocumentTransactionHelpers";
import type {
  LayerDocumentSourceTransaction,
  LayerDocumentSourceTransactionErrorCode,
  LayerDocumentSourceTransactionKind,
  LayerDocumentSourceTransactionResult,
  SourceRegistryCacheInvalidationContext,
  SourceRegistryCacheInvalidationDescriptor,
  SourceRegistryHistoryEntry,
} from "@/engines/project/models/layerDocumentSourcePreparationModel";

export const cloneSourceTransactionData = cloneTransactionData;

export function failSourceTransaction(
  project: LayerDocumentProject,
  code: LayerDocumentSourceTransactionErrorCode,
  message: string
): LayerDocumentSourceTransactionResult {
  return {
    ok: false,
    project,
    error: { code, message },
  };
}

export function plainDataValuesEqual(
  left: unknown,
  right: unknown
): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) =>
        plainDataValuesEqual(value, right[index])
      );
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        plainDataValuesEqual(leftRecord[key], rightRecord[key])
    );
}

export function validateSourceTransactionBefore(
  project: LayerDocumentProject
): LayerDocumentSourceTransactionResult | null {
  const issues = validateLayerDocumentProject(project);
  return issues.length > 0
    ? failSourceTransaction(
        project,
        "invalid-before",
        `Input project is invalid: ${issues[0].message}`
      )
    : null;
}

export function validateSourceCommandPlainData(
  project: LayerDocumentProject,
  command: unknown
): LayerDocumentSourceTransactionResult | null {
  const path = findNonPlainDataPath(command);
  return path
    ? failSourceTransaction(
        project,
        "invalid-input",
        `Source command accepts Plain Data only: ${path}`
      )
    : null;
}

export function validateSourceTransactionAfter(
  project: LayerDocumentProject,
  after: LayerDocumentProject
): LayerDocumentSourceTransactionResult | null {
  const issues = validateLayerDocumentProject(after);
  if (issues.length === 0) return null;
  const sourceReferenceIssue = issues.find(
    (issue) =>
      issue.code === "invalid-source-reference" ||
      issue.code === "invalid-source-kind"
  );
  return failSourceTransaction(
    project,
    sourceReferenceIssue
      ? "source-reference-conflict"
      : "invalid-output",
    `Prepared project is invalid: ${issues[0].message}`
  );
}

export function sourceReferences(
  project: LayerDocumentProject,
  sourceId: string
): {
  layerDocumentIds: string[];
  sourceIds: string[];
} {
  const layerDocumentIds = Object.values(
    project.payload.layerDocumentsById
  )
    .filter((layer) => layer.common.source?.sourceId === sourceId)
    .map((layer) => layer.layerDocumentId)
    .sort();
  const sourceIds = Object.values(
    project.payload.sourceRegistry.sourcesById
  )
    .filter(
      (source) =>
        source.kind === "psd-node" &&
        source.data.documentSourceId === sourceId
    )
    .map((source) => source.sourceId)
    .sort();
  return { layerDocumentIds, sourceIds };
}

export function validateStableSourceIdentity(options: {
  project: LayerDocumentProject;
  current: SourceRegistryRecord;
  next: SourceRegistryRecord;
}): LayerDocumentSourceTransactionResult | null {
  if (options.current.sourceId !== options.next.sourceId) {
    return failSourceTransaction(
      options.project,
      "source-identity-conflict",
      "Source ID cannot change during replacement"
    );
  }
  if (options.current.kind !== options.next.kind) {
    return failSourceTransaction(
      options.project,
      "source-kind-conflict",
      `Source kind cannot change from ${options.current.kind} to ` +
        options.next.kind
    );
  }
  if (
    options.current.kind === "psd-node" &&
    options.next.kind === "psd-node" &&
    (
      options.current.data.documentSourceId !==
        options.next.data.documentSourceId ||
      options.current.data.sourceKey !== options.next.data.sourceKey
    )
  ) {
    return failSourceTransaction(
      options.project,
      "source-identity-conflict",
      "PSD node documentSourceId and sourceKey are immutable"
    );
  }
  return null;
}

function buildCacheInvalidations(options: {
  before: LayerDocumentProject;
  after: LayerDocumentProject;
  sourceId: string;
  context: SourceRegistryCacheInvalidationContext;
}): SourceRegistryCacheInvalidationDescriptor[] {
  const sourceBefore =
    options.before.payload.sourceRegistry.sourcesById[options.sourceId];
  const sourceAfter =
    options.after.payload.sourceRegistry.sourcesById[options.sourceId];
  if (!sourceBefore || !sourceAfter) return [];
  return Object.values(options.before.payload.layerDocumentsById)
    .filter(
      (layer) => layer.common.source?.sourceId === options.sourceId
    )
    .sort((left, right) =>
      left.layerDocumentId.localeCompare(right.layerDocumentId)
    )
    .map((layer) => {
      const nextLayer =
        options.after.payload.layerDocumentsById[layer.layerDocumentId];
      const localFrame =
        options.context.localFrameByLayerDocumentId[
          layer.layerDocumentId
        ] ?? options.context.globalFrame;
      const sourceResourceCacheKeyBefore =
        buildLayerDocumentSourceResourceCacheKey({
          sourceId: sourceBefore.sourceId,
          sourceKind: sourceBefore.kind,
          visualKeyPolicy: layerDocumentSourceVisualKeyPolicy(
            sourceBefore.kind
          ),
          sourceVersion: sourceBefore.version,
          sourceFingerprint:
            layerDocumentSourceVisualFingerprint(sourceBefore),
          localFrame,
          sourceSamplingQuality:
            options.context.quality,
        });
      const sourceResourceCacheKeyAfter =
        buildLayerDocumentSourceResourceCacheKey({
          sourceId: sourceAfter.sourceId,
          sourceKind: sourceAfter.kind,
          visualKeyPolicy: layerDocumentSourceVisualKeyPolicy(
            sourceAfter.kind
          ),
          sourceVersion: sourceAfter.version,
          sourceFingerprint:
            layerDocumentSourceVisualFingerprint(sourceAfter),
          localFrame,
          sourceSamplingQuality:
            options.context.quality,
        });
      const draftIdentity =
        options.context.draftIdentityByLayerDocumentId?.[
          layer.layerDocumentId
        ] ?? null;
      return {
        sourceId: options.sourceId,
        layerDocumentId: layer.layerDocumentId,
        layerRevisionBefore: layer.revision,
        layerRevisionAfter: nextLayer.revision,
        sourceResourceCacheKeyBefore,
        sourceResourceCacheKeyAfter,
        layerResultCacheKeyBefore: buildLayerDocumentResultCacheKey({
          layerDocumentId: layer.layerDocumentId,
          revision: layer.revision,
          globalFrame: options.context.globalFrame,
          localFrame,
          sourceSamplingQuality:
            options.context.quality,
          sourceResourceCacheKey: sourceResourceCacheKeyBefore,
          draftIdentity,
        }),
        layerResultCacheKeyAfter: buildLayerDocumentResultCacheKey({
          layerDocumentId: nextLayer.layerDocumentId,
          revision: nextLayer.revision,
          globalFrame: options.context.globalFrame,
          localFrame,
          sourceSamplingQuality:
            options.context.quality,
          sourceResourceCacheKey: sourceResourceCacheKeyAfter,
          draftIdentity,
        }),
      };
    });
}

export function buildCacheInvalidationsForSources(options: {
  before: LayerDocumentProject;
  after: LayerDocumentProject;
  sourceIds: readonly string[];
  context: SourceRegistryCacheInvalidationContext;
}): SourceRegistryCacheInvalidationDescriptor[] {
  const descriptors = [...new Set(options.sourceIds)]
    .sort()
    .flatMap((sourceId) =>
      buildCacheInvalidations({
        before: options.before,
        after: options.after,
        sourceId,
        context: options.context,
      })
    );
  const seen = new Set<string>();
  return descriptors.filter((descriptor) => {
    const key = JSON.stringify([
      descriptor.sourceId,
      descriptor.layerDocumentId,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function changedRecordIds<T>(
  beforeById: Readonly<Record<string, T>>,
  afterById: Readonly<Record<string, T>>
): string[] {
  return [...new Set([
    ...Object.keys(beforeById),
    ...Object.keys(afterById),
  ])]
    .filter((id) =>
      !plainDataValuesEqual(beforeById[id], afterById[id])
    )
    .sort();
}

function createdRecordIds<T>(
  beforeById: Readonly<Record<string, T>>,
  afterById: Readonly<Record<string, T>>
): string[] {
  return Object.keys(afterById)
    .filter((id) => beforeById[id] === undefined)
    .sort();
}

function deletedRecordIds<T>(
  beforeById: Readonly<Record<string, T>>,
  afterById: Readonly<Record<string, T>>
): string[] {
  return Object.keys(beforeById)
    .filter((id) => afterById[id] === undefined)
    .sort();
}

function sameSortedIds(
  declared: readonly string[],
  actual: readonly string[]
): boolean {
  const sorted = [...declared].sort();
  return sorted.length === actual.length &&
    sorted.every((id, index) => id === actual[index]);
}

export function completeSourceTransaction(options: {
  kind: LayerDocumentSourceTransactionKind;
  before: LayerDocumentProject;
  after: LayerDocumentProject;
  sourceSelectionChange: LayerDocumentSourceTransaction[
    "sourceSelectionChange"
  ];
  layerSelectionChange?: LayerDocumentSourceTransaction[
    "layerSelectionChange"
  ];
  historyPolicy: LayerDocumentSourceTransaction["historyPolicy"];
  historyEntry?: SourceRegistryHistoryEntry | null;
  createdSourceIds?: readonly string[];
  deletedSourceIds?: readonly string[];
  createdLayerDocumentIds?: readonly string[];
  cacheInvalidations?:
    readonly SourceRegistryCacheInvalidationDescriptor[];
}): LayerDocumentSourceTransactionResult {
  const sourceBefore = options.before.payload.sourceRegistry.sourcesById;
  const sourceAfter = options.after.payload.sourceRegistry.sourcesById;
  const layersBefore = options.before.payload.layerDocumentsById;
  const layersAfter = options.after.payload.layerDocumentsById;
  const changedSourceIds = changedRecordIds(sourceBefore, sourceAfter);
  const changedLayerDocumentIds = changedRecordIds(
    layersBefore,
    layersAfter
  );
  const actualCreatedSourceIds = createdRecordIds(
    sourceBefore,
    sourceAfter
  );
  const actualDeletedSourceIds = deletedRecordIds(
    sourceBefore,
    sourceAfter
  );
  const actualCreatedLayerDocumentIds = createdRecordIds(
    layersBefore,
    layersAfter
  );
  const declaredCreatedSourceIds = options.createdSourceIds ?? [];
  const declaredDeletedSourceIds = options.deletedSourceIds ?? [];
  const declaredCreatedLayerDocumentIds =
    options.createdLayerDocumentIds ?? [];

  if (
    !sameSortedIds(declaredCreatedSourceIds, actualCreatedSourceIds) ||
    !sameSortedIds(declaredDeletedSourceIds, actualDeletedSourceIds) ||
    !sameSortedIds(
      declaredCreatedLayerDocumentIds,
      actualCreatedLayerDocumentIds
    )
  ) {
    return failSourceTransaction(
      options.before,
      "internal-invalid-transaction",
      "Declared created/deleted IDs do not match the prepared diff"
    );
  }
  const recordsHistory = options.historyPolicy === "record-entry";
  if (recordsHistory && !options.historyEntry) {
    return failSourceTransaction(
      options.before,
      "internal-invalid-transaction",
      "record-entry Source transaction requires a history entry"
    );
  }
  if (
    recordsHistory &&
    options.historyEntry &&
    (
      !sameSortedIds(
        options.historyEntry.affectedSourceIds,
        changedSourceIds
      ) ||
      !sameSortedIds(
        options.historyEntry.affectedLayerDocumentIds,
        changedLayerDocumentIds
      )
    )
  ) {
    return failSourceTransaction(
      options.before,
      "internal-invalid-transaction",
      "History affected IDs do not match the prepared Source/Layer diff"
    );
  }
  return {
    ok: true,
    transaction: {
      kind: options.kind,
      before: options.before,
      after: options.after,
      sourceSelectionChange: options.sourceSelectionChange,
      layerSelectionChange:
        options.layerSelectionChange ?? { kind: "preserve" },
      historyPolicy: options.historyPolicy,
      historyEntry: recordsHistory ? options.historyEntry ?? null : null,
      historyEntryCount: recordsHistory ? 1 : 0,
      clearHistory: options.historyPolicy === "clear-history",
      createdSourceIds: [...declaredCreatedSourceIds].sort(),
      deletedSourceIds: [...declaredDeletedSourceIds].sort(),
      createdLayerDocumentIds:
        [...declaredCreatedLayerDocumentIds].sort(),
      cacheInvalidations: options.cacheInvalidations ?? [],
    },
  };
}
