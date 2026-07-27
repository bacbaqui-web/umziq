import type {
  LayerDocumentPsdSourceResolution,
  LayerDocumentPsdSourceResolver,
} from "@/render/models/layerDocumentRuntimeModel";

export interface LayerDocumentSourceRuntimeResource {
  readonly sourceId: string;
  readonly sourceResourceCacheKey: string;
  readonly resolution: LayerDocumentPsdSourceResolution;
  /**
   * Runtime-only payload. It may contain Canvas/ImageBitmap/render resources
   * and must never enter Project, transaction, or History data.
   */
  readonly resource: unknown;
  readonly dispose?: () => void;
}

export type LayerDocumentSourceRuntimeInvalidation =
  | {
      readonly kind: "source";
      readonly sourceId: string;
    }
  | {
      readonly kind: "cache-key";
      readonly sourceId: string;
      readonly sourceResourceCacheKey: string;
    }
  | {
      readonly kind: "all";
    };

export type LayerDocumentRuntimeBatchRegistrationErrorCode =
  | "cache-disposed"
  | "invalid-entry"
  | "duplicate-entry"
  | "registration-failed";

export type LayerDocumentRuntimeBatchPreflightResult =
  | {
      readonly ok: true;
      readonly acceptedCount: number;
    }
  | {
      readonly ok: false;
      readonly acceptedCount: 0;
      readonly code: LayerDocumentRuntimeBatchRegistrationErrorCode;
      readonly message: string;
      readonly failedIndex: number | null;
    };

export type LayerDocumentRuntimeBatchRegistrationResult =
  | {
      readonly ok: true;
      readonly registeredCount: number;
    }
  | {
      readonly ok: false;
      readonly registeredCount: 0;
      readonly code: LayerDocumentRuntimeBatchRegistrationErrorCode;
      readonly message: string;
      readonly failedIndex: number | null;
      readonly retryable: boolean;
    };

export interface LayerDocumentSourceRuntimeResourcePort {
  readonly preflightBatch: (
    entries: readonly LayerDocumentSourceRuntimeResource[]
  ) => LayerDocumentRuntimeBatchPreflightResult;
  /**
   * Atomic total operation: a failure leaves the cache unchanged.
   * Incoming resources remain caller-owned when it returns ok:false.
   */
  readonly registerBatch: (
    entries: readonly LayerDocumentSourceRuntimeResource[]
  ) => LayerDocumentRuntimeBatchRegistrationResult;
  readonly register: (
    entry: LayerDocumentSourceRuntimeResource
  ) => LayerDocumentRuntimeBatchRegistrationResult;
  readonly resolve: (options: {
    sourceId: string;
    sourceResourceCacheKey: string;
  }) => LayerDocumentSourceRuntimeResource | null;
  readonly invalidate: (
    invalidation: LayerDocumentSourceRuntimeInvalidation
  ) => number;
  readonly suspendSource: (
    sourceId: string
  ) => number;
  readonly restoreSource: (
    sourceId: string
  ) => number;
  readonly disposeSuspendedSource: (
    sourceId: string
  ) => number;
  readonly dispose: () => void;
  readonly createPsdResolver: () => LayerDocumentPsdSourceResolver;
}

export interface LayerDocumentPsdRuntimeRegistrationBridge {
  readonly preflightResources: (
    entries: readonly LayerDocumentSourceRuntimeResource[]
  ) => LayerDocumentRuntimeBatchPreflightResult;
  readonly registerResources: (
    entries: readonly LayerDocumentSourceRuntimeResource[]
  ) => LayerDocumentRuntimeBatchRegistrationResult;
}
