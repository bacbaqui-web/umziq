import type { ExportDestinationPort } from "@/gateway/contracts/exportDestinationGateway";

export function createFakeExportDestinationGateway(): ExportDestinationPort & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    choose: async () => ({ ok: true, value: { destinationId: "fake-export", name: "Fake Export" } }),
    write: async (_destination, file) => { files.set(file.fileName, file.bytes.slice()); return { ok: true, value: undefined }; },
  };
}
