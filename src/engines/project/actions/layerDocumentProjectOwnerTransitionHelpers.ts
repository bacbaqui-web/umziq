import {
  findNonPlainDataPath,
  validateLayerDocumentProject,
} from "@/models";
import type {
  LayerDocumentOwnerHistoryEntry,
  LayerDocumentProjectOwnerEffect,
  LayerDocumentProjectOwnerErrorCode,
  LayerDocumentProjectOwnerState,
  LayerDocumentProjectOwnerTransitionResult,
} from "@/engines/project/models/layerDocumentProjectOwnerModel";
import {
  cloneOwnerPlainData,
} from "@/engines/project/helpers/layerDocumentProjectOwnerHelpers";
import {
  plainDataValuesEqual,
} from "@/engines/project/actions/layerDocumentSourceTransactionHelpers";

function noRuntimeEffect(): LayerDocumentProjectOwnerEffect {
  return {
    clearDraft: false,
    resetLocalUi: false,
    stopPlayback: false,
    recomputeRender: false,
    runtimeCachePolicy: "preserve",
    cacheInvalidations: [],
    sourceInvalidationIds: [],
    sourceRestorationIds: [],
    sourceDisposalIds: [],
    suspendedSourceDisposalIds: [],
  };
}

export function projectTransitionEffect(options?: {
  cacheInvalidations?: LayerDocumentProjectOwnerEffect[
    "cacheInvalidations"
  ];
  sourceInvalidationsAreComplete?: boolean;
  preserveSourceRuntime?: boolean;
  sourceInvalidationIds?: readonly string[];
  sourceRestorationIds?: readonly string[];
  sourceDisposalIds?: readonly string[];
  suspendedSourceDisposalIds?: readonly string[];
  stopPlayback?: boolean;
}): LayerDocumentProjectOwnerEffect {
  const cacheInvalidations = cloneOwnerPlainData(
    options?.cacheInvalidations ?? []
  );
  const sourceInvalidationIds =
    cloneOwnerPlainData(
      options?.sourceInvalidationIds ?? []
    );
  const sourceRestorationIds =
    cloneOwnerPlainData(
      options?.sourceRestorationIds ?? []
    );
  const sourceDisposalIds =
    cloneOwnerPlainData(
      options?.sourceDisposalIds ?? []
    );
  const suspendedSourceDisposalIds =
    cloneOwnerPlainData(
      options?.suspendedSourceDisposalIds ?? []
    );
  return {
    clearDraft: true,
    resetLocalUi: true,
    stopPlayback: options?.stopPlayback ?? false,
    recomputeRender: true,
    runtimeCachePolicy:
      options?.preserveSourceRuntime
        ? "preserve"
        : (
          sourceInvalidationIds.length > 0 ||
          sourceRestorationIds.length > 0 ||
          sourceDisposalIds.length > 0 ||
          suspendedSourceDisposalIds.length > 0
        )
          ? "apply-source-invalidations"
          : options?.sourceInvalidationsAreComplete &&
            cacheInvalidations.length > 0
            ? "apply-source-invalidations"
            : "invalidate-all",
    cacheInvalidations,
    sourceInvalidationIds,
    sourceRestorationIds,
    sourceDisposalIds,
    suspendedSourceDisposalIds,
  };
}

export function abandonedSourceRuntimeIds(options: {
  previous: LayerDocumentProjectOwnerState;
  nextUndo: readonly LayerDocumentOwnerHistoryEntry[];
  nextRedo: readonly LayerDocumentOwnerHistoryEntry[];
}): string[] {
  const collect = (
    entries: readonly LayerDocumentOwnerHistoryEntry[]
  ) => entries.flatMap((entry) => {
    const beforeIds = new Set(
      Object.keys(
        entry.before.payload.sourceRegistry.sourcesById
      )
    );
    const afterIds = new Set(
      Object.keys(
        entry.after.payload.sourceRegistry.sourcesById
      )
    );
    return [
      ...[...beforeIds].filter(
        (sourceId) => !afterIds.has(sourceId)
      ),
      ...[...afterIds].filter(
        (sourceId) => !beforeIds.has(sourceId)
      ),
    ];
  });
  const previousIds = new Set([
    ...collect(options.previous.undoStack),
    ...collect(options.previous.redoStack),
  ]);
  const retainedIds = new Set([
    ...collect(options.nextUndo),
    ...collect(options.nextRedo),
  ]);
  return [...previousIds]
    .filter((sourceId) => !retainedIds.has(sourceId))
    .sort();
}

export function ownerSourceRuntimePresenceDiff(options: {
  from: LayerDocumentProjectOwnerState["currentProject"];
  to: LayerDocumentProjectOwnerState["currentProject"];
}): {
  sourceInvalidationIds: string[];
  sourceRestorationIds: string[];
} {
  const fromIds = new Set(
    Object.keys(
      options.from.payload.sourceRegistry.sourcesById
    )
  );
  const toIds = new Set(
    Object.keys(
      options.to.payload.sourceRegistry.sourcesById
    )
  );
  return {
    sourceInvalidationIds: [...fromIds]
      .filter((sourceId) => !toIds.has(sourceId))
      .sort(),
    sourceRestorationIds: [...toIds]
      .filter((sourceId) => !fromIds.has(sourceId))
      .sort(),
  };
}

export function failOwnerTransition(
  state: LayerDocumentProjectOwnerState,
  code: LayerDocumentProjectOwnerErrorCode,
  message: string
): LayerDocumentProjectOwnerTransitionResult {
  return {
    ok: false,
    state,
    error: { code, message },
  };
}

export function successOwnerTransition(options: {
  previous: LayerDocumentProjectOwnerState;
  state: LayerDocumentProjectOwnerState;
  effect?: LayerDocumentProjectOwnerEffect;
}): LayerDocumentProjectOwnerTransitionResult {
  return {
    ok: true,
    changed: options.state !== options.previous,
    state: options.state,
    effect: options.effect ?? noRuntimeEffect(),
  };
}

export function validateOwnerTransactionAfter(options: {
  state: LayerDocumentProjectOwnerState;
  transaction: {
    before: unknown;
    after: LayerDocumentProjectOwnerState["currentProject"];
  };
  plainValue: unknown;
}): LayerDocumentProjectOwnerTransitionResult | null {
  if (options.transaction.before !== options.state.currentProject) {
    return failOwnerTransition(
      options.state,
      "stale-transaction",
      "Transaction before is not the current owner Project"
    );
  }
  const nonPlainPath = findNonPlainDataPath(options.plainValue);
  if (nonPlainPath) {
    return failOwnerTransition(
      options.state,
      "non-plain-data",
      `Owner transaction contains non-Plain Data: ${nonPlainPath}`
    );
  }
  const issues = validateLayerDocumentProject(options.transaction.after);
  if (issues.length > 0) {
    return failOwnerTransition(
      options.state,
      "invalid-after",
      `Transaction after Project is invalid: ${issues[0].message}`
    );
  }
  if (
    plainDataValuesEqual(
      options.state.currentProject,
      options.transaction.after
    )
  ) {
    return failOwnerTransition(
      options.state,
      "no-change",
      "Owner rejects a transaction with no Project change"
    );
  }
  return null;
}

export function changedOwnerRecordIds<T>(
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

export function createdOwnerRecordIds<T>(
  beforeById: Readonly<Record<string, T>>,
  afterById: Readonly<Record<string, T>>
): string[] {
  return Object.keys(afterById)
    .filter((id) => beforeById[id] === undefined)
    .sort();
}

export function deletedOwnerRecordIds<T>(
  beforeById: Readonly<Record<string, T>>,
  afterById: Readonly<Record<string, T>>
): string[] {
  return Object.keys(beforeById)
    .filter((id) => afterById[id] === undefined)
    .sort();
}

export function ownerIdsMatch(
  declared: readonly string[],
  actual: readonly string[]
): boolean {
  const sorted = [...declared].sort();
  return sorted.length === actual.length &&
    sorted.every((id, index) => id === actual[index]);
}
