import {
  copyFilesIntoProjectAssets,
} from "@/editor/projectAssetDirectoryRuntime";
import type {
  SourceAccessPort,
  SourceResourceReference,
} from "@/gateway/contracts/sourceAccessGateway";

export type WebSourceAccessGateway = SourceAccessPort & {
  readonly registerFiles: (
    files: readonly File[]
  ) => readonly SourceResourceReference[];
  readonly withFile: <T>(
    source: SourceResourceReference,
    consume: (file: File) => T
  ) => T;
};

export function createWebSourceAccessGateway():
WebSourceAccessGateway {
  const files = new Map<string, File>();
  let sequence = 0;
  const register = (
    file: File,
    relativePathHint: string | null = null
  ): SourceResourceReference => {
    const resourceId = `web-source:${++sequence}`;
    files.set(resourceId, file);
    return {
      resourceId,
      fileName: file.name,
      mimeType: file.type || null,
      byteLength: file.size,
      relativePathHint,
    };
  };
  const resolve = (source: SourceResourceReference) =>
    files.get(source.resourceId);

  return {
    chooseLinkedSource: async () => {
      const file = await new Promise<File | null>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.oncancel = () => resolve(null);
        input.click();
      });
      return file
        ? { ok: true, value: register(file) }
        : {
            ok: false,
            error: { code: "cancelled", message: "Source selection was cancelled" },
          };
    },
    registerFiles: (selected) => selected.map((file) => register(file)),
    withFile: (source, consume) => {
      const file = resolve(source);
      if (!file) throw new Error("Web Source is unavailable");
      return consume(file);
    },
    readSource: async (source) => {
      const file = resolve(source);
      if (!file) {
        return {
          ok: false,
          error: {
            code: "not-found",
            message: `Source ${source.fileName} is unavailable`,
          },
        };
      }
      try {
        return {
          ok: true,
          value: new Uint8Array(await file.arrayBuffer()),
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "read-failed",
            message: error instanceof Error
              ? error.message
              : "Source read failed",
          },
        };
      }
    },
    copyIntoProjectAssets: async ({ sources, kind, copy }) => {
      const selected = sources.map(resolve);
      if (selected.some((file) => !file)) {
        return {
          ok: false,
          error: {
            code: "not-found",
            message: "A selected Source is unavailable",
          },
        };
      }
      try {
        const copied = await copyFilesIntoProjectAssets({
          files: selected as File[],
          kind: kind === "video" ? "audio" : kind,
          copy,
        });
        return {
          ok: true,
          value: copied.map((entry) =>
            register(entry.file, entry.relativePathHint)
          ),
        };
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "write-failed",
            message: error instanceof Error
              ? error.message
              : "Source asset copy failed",
          },
        };
      }
    },
    release: (sources) => {
      sources.forEach((source) => files.delete(source.resourceId));
    },
  };
}
