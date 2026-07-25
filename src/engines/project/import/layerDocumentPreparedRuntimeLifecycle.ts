import type {
  LayerDocumentSourceRuntimeResource,
} from "@/engines/playback-render";

export type LayerDocumentPreparedRuntimeState =
  | "prepared"
  | "confirming-owner"
  | "runtime-registration-pending"
  | "transferred"
  | "cancelled"
  | "failed-before-owner";

export type LayerDocumentPreparedRuntimeClaim =
  | {
      readonly ok: true;
      readonly mode: "commit-owner" | "retry-runtime-registration";
      readonly resources:
        readonly LayerDocumentSourceRuntimeResource[];
    }
  | {
      readonly ok: false;
      readonly state: LayerDocumentPreparedRuntimeState;
      readonly reason:
        | "already-transferred"
        | "already-cancelled"
        | "already-failed"
        | "confirm-in-progress";
    };

export interface LayerDocumentPreparedRuntimeDisposition {
  readonly changed: boolean;
  readonly state: LayerDocumentPreparedRuntimeState;
  readonly disposedCount: number;
}

export interface LayerDocumentPreparedRuntimeLifecycle {
  readonly readState: () => LayerDocumentPreparedRuntimeState;
  readonly readResourceCount: () => number;
  readonly claimForConfirm: () => LayerDocumentPreparedRuntimeClaim;
  readonly markOwnerCommitted: () => boolean;
  readonly markTransferred: () => boolean;
  readonly markRegistrationFailed: () => boolean;
  readonly failBeforeOwner: () =>
    LayerDocumentPreparedRuntimeDisposition;
  readonly cancel: () => LayerDocumentPreparedRuntimeDisposition;
}

function disposeResources(
  resources: readonly LayerDocumentSourceRuntimeResource[]
): number {
  resources.forEach((resource) => {
    try {
      resource.dispose?.();
    } catch {
      // Disposal is best effort; lifecycle consistency must not be reverted.
    }
  });
  return resources.length;
}

/**
 * Runtime-only one-shot ownership state. No instance is serializable or
 * admitted into the LayerDocument Project/History.
 */
export function createLayerDocumentPreparedRuntimeLifecycle(
  resources: readonly LayerDocumentSourceRuntimeResource[]
): LayerDocumentPreparedRuntimeLifecycle {
  let state: LayerDocumentPreparedRuntimeState = "prepared";
  let resourcesDisposed = false;
  const disposeOnce = () => {
    if (resourcesDisposed) return 0;
    resourcesDisposed = true;
    return disposeResources(resources);
  };
  return {
    readState: () => state,
    readResourceCount: () => resources.length,
    claimForConfirm: () => {
      if (state === "prepared") {
        state = "confirming-owner";
        return {
          ok: true,
          mode: "commit-owner",
          resources,
        };
      }
      if (state === "runtime-registration-pending") {
        return {
          ok: true,
          mode: "retry-runtime-registration",
          resources,
        };
      }
      const reason =
        state === "transferred"
          ? "already-transferred"
          : state === "cancelled"
            ? "already-cancelled"
            : state === "failed-before-owner"
              ? "already-failed"
              : "confirm-in-progress";
      return { ok: false, state, reason };
    },
    markOwnerCommitted: () => {
      if (state !== "confirming-owner") return false;
      state = "runtime-registration-pending";
      return true;
    },
    markTransferred: () => {
      if (state !== "runtime-registration-pending") return false;
      state = "transferred";
      return true;
    },
    markRegistrationFailed: () =>
      state === "runtime-registration-pending",
    failBeforeOwner: () => {
      if (state !== "confirming-owner") {
        return { changed: false, state, disposedCount: 0 };
      }
      state = "failed-before-owner";
      return {
        changed: true,
        state,
        disposedCount: disposeOnce(),
      };
    },
    cancel: () => {
      if (state !== "prepared") {
        return { changed: false, state, disposedCount: 0 };
      }
      state = "cancelled";
      return {
        changed: true,
        state,
        disposedCount: disposeOnce(),
      };
    },
  };
}
