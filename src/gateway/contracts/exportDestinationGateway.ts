export type ExportDestination = { readonly destinationId: string; readonly name: string };
export type ExportDestinationResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: "cancelled" | "unsupported" | "write-failed"; readonly message: string };
export interface ExportDestinationPort {
  choose: () => Promise<ExportDestinationResult<ExportDestination>>;
  write: (destination: ExportDestination | null, file: { readonly fileName: string; readonly mimeType: string; readonly bytes: Uint8Array }) => Promise<ExportDestinationResult<void>>;
}
