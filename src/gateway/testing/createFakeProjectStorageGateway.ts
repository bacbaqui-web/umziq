import type {
  ProjectReadSelection,
  ProjectStorageGateway,
  ProjectStorageTarget,
} from "@/gateway/contracts/projectStorageGateway";

export function createFakeProjectStorageGateway(options: {
  readonly reads?: readonly ProjectReadSelection[];
} = {}) {
  const reads = [...(options.reads ?? [])];
  const writes: Array<{
    target: ProjectStorageTarget;
    bytes: Uint8Array;
  }> = [];
  let sequence = 0;
  const gateway: ProjectStorageGateway = {
    capability: "fake",
    chooseProject: async () => {
      const value = reads.shift();
      return value
        ? { ok: true, value }
        : {
            ok: false,
            error: { code: "cancelled", message: "No fake read queued" },
          };
    },
    chooseTarget: async (fileName) => ({
      ok: true,
      value: {
        targetId: `fake:${++sequence}`,
        kind: "native-file-system",
        fileName,
      },
    }),
    write: async ({ target, bytes, shouldCommit }) => {
      if (!shouldCommit()) {
        return {
          ok: false,
          error: { code: "stale-write", message: "Stale fake write" },
        };
      }
      writes.push({ target, bytes: bytes.slice() });
      return { ok: true, value: undefined };
    },
  };
  return { gateway, writes };
}
