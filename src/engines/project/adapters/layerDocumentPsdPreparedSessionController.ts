import type {
  LayerDocumentPsdImportPreviewPlan,
  PreparedLayerDocumentPsdRefreshPlan,
} from "@/engines/project/adapters/layerDocumentPsdTreeController";

export type LayerDocumentPsdPreparedSession =
  | {
      readonly kind: "imports";
      readonly plans: readonly LayerDocumentPsdImportPreviewPlan[];
    }
  | {
      readonly kind: "refresh";
      readonly plan: PreparedLayerDocumentPsdRefreshPlan;
    }
  | null;

/**
 * Runtime-only async preparation sequencing. A result that settles after a
 * newer request is immediately cancelled/disposed and never becomes active.
 */
export function createLayerDocumentPsdPreparedSessionController(options: {
  cancelImport: (
    plan: LayerDocumentPsdImportPreviewPlan
  ) => unknown;
  cancelRefresh: (
    plan: PreparedLayerDocumentPsdRefreshPlan
  ) => unknown;
}) {
  let sequence = 0;
  let active: LayerDocumentPsdPreparedSession = null;
  const dispose = (session: LayerDocumentPsdPreparedSession) => {
    if (session?.kind === "imports") {
      session.plans.forEach(options.cancelImport);
    } else if (session?.kind === "refresh") {
      options.cancelRefresh(session.plan);
    }
  };
  const begin = () => {
    sequence += 1;
    dispose(active);
    active = null;
    return sequence;
  };
  const acceptImports = (
    requestSequence: number,
    plans: readonly LayerDocumentPsdImportPreviewPlan[]
  ) => {
    if (requestSequence !== sequence) {
      plans.forEach(options.cancelImport);
      return { accepted: false as const, reason: "stale" as const };
    }
    dispose(active);
    active = { kind: "imports", plans };
    return { accepted: true as const };
  };
  const acceptRefresh = (
    requestSequence: number,
    plan: PreparedLayerDocumentPsdRefreshPlan
  ) => {
    if (requestSequence !== sequence) {
      options.cancelRefresh(plan);
      return { accepted: false as const, reason: "stale" as const };
    }
    dispose(active);
    active = { kind: "refresh", plan };
    return { accepted: true as const };
  };
  const clearTransferred = (
    expected: Exclude<LayerDocumentPsdPreparedSession, null>
  ) => {
    if (active !== expected) return false;
    active = null;
    return true;
  };
  const replaceActiveImports = (
    plans: readonly LayerDocumentPsdImportPreviewPlan[]
  ) => {
    if (active?.kind !== "imports") return false;
    active = { kind: "imports", plans };
    return true;
  };
  const cancelActive = () => {
    sequence += 1;
    const current = active;
    active = null;
    dispose(current);
    return current !== null;
  };
  return {
    begin,
    acceptImports,
    acceptRefresh,
    read: () => active,
    replaceActiveImports,
    clearTransferred,
    cancelActive,
    readSequence: () => sequence,
  };
}

export type LayerDocumentPsdPreparedSessionController = ReturnType<
  typeof createLayerDocumentPsdPreparedSessionController
>;
