import type {
  LayerDocumentSourceRuntimeResource,
} from "@/render";

export type LayerDocumentPreparedRuntimeState =
  | "prepared"
  | "confirming-nexus"
  | "runtime-registration-pending"
  | "transferred"
  | "cancelled"
  | "abandoned-after-nexus"
  | "failed-before-nexus";

export type LayerDocumentPreparedRuntimeClaim<TResource = LayerDocumentSourceRuntimeResource> =
  | {
      readonly ok: true;
      readonly mode: "commit-nexus" | "retry-runtime-registration";
      readonly resources:
        readonly TResource[];
    }
  | {
      readonly ok: false;
      readonly state: LayerDocumentPreparedRuntimeState;
      readonly reason:
        | "already-transferred"
        | "already-cancelled"
        | "already-abandoned"
        | "already-failed"
        | "confirm-in-progress";
    };

export interface LayerDocumentPreparedRuntimeDisposition {
  readonly changed: boolean;
  readonly state: LayerDocumentPreparedRuntimeState;
  readonly disposedCount: number;
}

export interface LayerDocumentPreparedRuntimeLifecycle<TResource = LayerDocumentSourceRuntimeResource> {
  readonly readState: () => LayerDocumentPreparedRuntimeState;
  readonly readResourceCount: () => number;
  readonly claimForConfirm: () => LayerDocumentPreparedRuntimeClaim<TResource>;
  readonly markNexusCommitted: () => boolean;
  readonly markTransferred: () => boolean;
  readonly markRegistrationFailed: () => boolean;
  readonly failBeforeNexus: () =>
    LayerDocumentPreparedRuntimeDisposition;
  readonly cancel: () => LayerDocumentPreparedRuntimeDisposition;
  readonly disposeForSessionEnd: () =>
    LayerDocumentPreparedRuntimeDisposition;
}

function disposeResources(
  resources: readonly { readonly dispose?: () => void }[]
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
export function createLayerDocumentPreparedRuntimeLifecycle<
  TResource extends { readonly dispose?: () => void },
>(
  resources: readonly TResource[]
): LayerDocumentPreparedRuntimeLifecycle<TResource> {
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
        state = "confirming-nexus";
        return {
          ok: true,
          mode: "commit-nexus",
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
            : state === "abandoned-after-nexus"
              ? "already-abandoned"
              : state === "failed-before-nexus"
                ? "already-failed"
                : "confirm-in-progress";
      return { ok: false, state, reason };
    },
    markNexusCommitted: () => {
      if (state !== "confirming-nexus") return false;
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
    failBeforeNexus: () => {
      if (state !== "confirming-nexus") {
        return { changed: false, state, disposedCount: 0 };
      }
      state = "failed-before-nexus";
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
    disposeForSessionEnd: () => {
      if (state !== "prepared" && state !== "runtime-registration-pending") {
        return { changed: false, state, disposedCount: 0 };
      }
      state = state === "prepared" ? "cancelled" : "abandoned-after-nexus";
      return {
        changed: true,
        state,
        disposedCount: disposeOnce(),
      };
    },
  };
}
