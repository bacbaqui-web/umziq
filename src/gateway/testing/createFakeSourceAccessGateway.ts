import type {
  SourceAccessPort,
  SourceResourceReference,
} from "@/gateway/contracts/sourceAccessGateway";

export function createFakeSourceAccessGateway(
  fixtures: ReadonlyMap<string, Uint8Array>
): SourceAccessPort {
  const released = new Set<string>();
  return {
    chooseLinkedSource: async () => ({
      ok: false,
      error: { code: "cancelled", message: "No Fake Source queued" },
    }),
    readSource: async (source) => {
      const bytes = released.has(source.resourceId)
        ? undefined
        : fixtures.get(source.resourceId);
      return bytes
        ? { ok: true, value: bytes.slice() }
        : {
            ok: false,
            error: {
              code: "not-found",
              message: "Fake Source is unavailable",
            },
          };
    },
    copyIntoProjectAssets: async ({ sources }) => ({
      ok: true,
      value: sources.map((source): SourceResourceReference => ({
        ...source,
        relativePathHint: source.relativePathHint ?? source.fileName,
      })),
    }),
    release: (sources) => {
      sources.forEach((source) => released.add(source.resourceId));
    },
  };
}
