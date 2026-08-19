export type ProjectStorageCapability =
  | "native-file-system"
  | "browser-fallback"
  | "fake";

export interface ProjectStorageTarget {
  readonly targetId: string;
  readonly kind: "native-file-system" | "browser-download";
  readonly fileName: string;
}

export type ProjectStorageErrorCode =
  | "cancelled"
  | "permission-denied"
  | "read-failed"
  | "write-failed"
  | "download-failed"
  | "stale-write";

export type ProjectStorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: ProjectStorageErrorCode;
        readonly message: string;
      };
    };

export interface ProjectReadSelection {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly target: ProjectStorageTarget | null;
}

export interface ProjectReadPort {
  readonly capability: ProjectStorageCapability;
  readonly chooseProject: () => Promise<
    ProjectStorageResult<ProjectReadSelection>
  >;
}

export interface ProjectWritePort {
  readonly capability: ProjectStorageCapability;
  readonly chooseTarget: (
    suggestedFileName: string
  ) => Promise<ProjectStorageResult<ProjectStorageTarget>>;
  readonly write: (options: {
    readonly target: ProjectStorageTarget;
    readonly bytes: Uint8Array;
    readonly shouldCommit: () => boolean;
  }) => Promise<ProjectStorageResult<void>>;
}

export interface ProjectStorageGateway
  extends ProjectReadPort,
    ProjectWritePort {}
