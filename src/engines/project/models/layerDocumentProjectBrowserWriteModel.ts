export type LayerDocumentProjectWriteCapability =
  | "native-file-system"
  | "blob-download";

export interface LayerDocumentProjectWritableStream {
  readonly write: (
    data: Uint8Array
  ) => Promise<void>;
  readonly close: () => Promise<void>;
  readonly abort?: () => Promise<void>;
}

export interface LayerDocumentProjectWritableFileHandle {
  readonly name: string;
  readonly createWritable: () =>
    Promise<LayerDocumentProjectWritableStream>;
}

export type LayerDocumentProjectWriteTarget =
  | {
      readonly kind: "native-file-system";
      readonly fileName: string;
      readonly handle:
        LayerDocumentProjectWritableFileHandle;
    }
  | {
      readonly kind: "blob-download";
      readonly fileName: string;
    };

export type LayerDocumentProjectWriteErrorCode =
  | "cancelled"
  | "permission-denied"
  | "write-failed"
  | "download-failed"
  | "stale-write";

export type LayerDocumentProjectWriteResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly code:
          LayerDocumentProjectWriteErrorCode;
        readonly message: string;
      };
    };

export interface LayerDocumentProjectBrowserWritePort {
  readonly capability:
    LayerDocumentProjectWriteCapability;
  readonly chooseTarget: (
    suggestedFileName: string
  ) => Promise<
    LayerDocumentProjectWriteResult<
      LayerDocumentProjectWriteTarget
    >
  >;
  readonly write: (options: {
    readonly target:
      LayerDocumentProjectWriteTarget;
    readonly bytes: Uint8Array;
    readonly shouldCommit: () => boolean;
  }) => Promise<
    LayerDocumentProjectWriteResult<void>
  >;
}

export interface LayerDocumentProjectBrowserWriteEnvironment {
  readonly showSaveFilePicker?: (
    options: {
      readonly suggestedName: string;
      readonly types: readonly {
        readonly description: string;
        readonly accept: Readonly<
          Record<string, readonly string[]>
        >;
      }[];
    }
  ) => Promise<
    LayerDocumentProjectWritableFileHandle
  >;
  readonly createObjectURL: (blob: Blob) => string;
  readonly revokeObjectURL: (url: string) => void;
  readonly createDownloadAnchor: () => {
    href: string;
    download: string;
    click: () => void;
    remove?: () => void;
  };
}
