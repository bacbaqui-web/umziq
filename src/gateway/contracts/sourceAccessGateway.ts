export type SourceKind = "psd" | "audio" | "video";

export type SourceResourceReference = {
  readonly resourceId: string;
  readonly fileName: string;
  readonly mimeType: string | null;
  readonly byteLength: number | null;
  readonly relativePathHint: string | null;
};

export type SourceAccessErrorCode =
  | "cancelled"
  | "permission-denied"
  | "not-found"
  | "read-failed"
  | "write-failed";

export type SourceAccessResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: SourceAccessErrorCode;
        readonly message: string;
      };
    };

export interface SourceAccessPort {
  readonly chooseLinkedSource: (options: {
    readonly suggestedFileName: string;
  }) => Promise<SourceAccessResult<SourceResourceReference>>;
  readonly readSource: (
    source: SourceResourceReference
  ) => Promise<SourceAccessResult<Uint8Array>>;
  readonly copyIntoProjectAssets: (options: {
    readonly sources: readonly SourceResourceReference[];
    readonly kind: SourceKind;
    readonly copy: boolean;
  }) => Promise<
    SourceAccessResult<readonly SourceResourceReference[]>
  >;
  readonly release: (
    sources: readonly SourceResourceReference[]
  ) => void;
}
