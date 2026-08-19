export type LayerDocumentSourceRuntimeResolutionStatus =
  | "unresolved"
  | "resolving"
  | "available"
  | "missing"
  | "error";

export type LayerDocumentSourceRuntimePermission =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied";

export interface LayerDocumentSourceRuntimeResolution {
  readonly sourceId: string;
  readonly status: LayerDocumentSourceRuntimeResolutionStatus;
  readonly permission: LayerDocumentSourceRuntimePermission;
  readonly error: string | null;
}

export interface LayerDocumentSourceRuntimeResolutionReadPort {
  readonly read: (
    sourceId: string
  ) => LayerDocumentSourceRuntimeResolution;
  readonly subscribe: (
    listener: () => void
  ) => () => void;
}

export interface LayerDocumentSourceRuntimeResolutionPort
  extends LayerDocumentSourceRuntimeResolutionReadPort {
  readonly setResolving: (options: {
    readonly sourceId: string;
    readonly permission?: LayerDocumentSourceRuntimePermission;
  }) => LayerDocumentSourceRuntimeResolution;
  readonly setAvailable: (options: {
    readonly sourceId: string;
    readonly permission?: LayerDocumentSourceRuntimePermission;
  }) => LayerDocumentSourceRuntimeResolution;
  readonly setMissing: (
    sourceId: string
  ) => LayerDocumentSourceRuntimeResolution;
  readonly setError: (
    sourceId: string,
    error: string
  ) => LayerDocumentSourceRuntimeResolution;
  readonly remove: (sourceId: string) => boolean;
  readonly reset: () => void;
}
