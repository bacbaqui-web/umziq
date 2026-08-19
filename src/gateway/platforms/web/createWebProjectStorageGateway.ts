import {
  createLayerDocumentProjectBrowserOpenAdapter,
} from "@/gateway/platforms/web/adapters/layerDocumentProjectBrowserOpenAdapter";
import { createLayerDocumentProjectBrowserWriteAdapter } from "@/gateway/platforms/web/adapters/layerDocumentProjectBrowserWriteAdapter";
import type { WebProjectOpenPort, WebProjectOpenSelection, WebProjectWritePort, WebProjectWriteTarget } from "@/gateway/platforms/web/webProjectStorageTypes";
import type {
  ProjectStorageGateway,
  ProjectStorageTarget,
} from "@/gateway/contracts/projectStorageGateway";

const projectTargets = new Map<
  string,
  WebProjectWriteTarget
>();
let projectTargetSequence = 0;

export function registerWebProjectStorageTarget(
  target: WebProjectWriteTarget
): ProjectStorageTarget {
  const targetId =
    `web-project-target:${++projectTargetSequence}`;
  projectTargets.set(targetId, target);
  return {
    targetId,
    kind: target.kind === "blob-download"
      ? "browser-download"
      : target.kind,
    fileName: target.fileName,
  };
}

export function createWebProjectStorageGateway(options: {
  readonly takeQueuedSelection?: () =>
    WebProjectOpenSelection | null;
  readonly readPort?: WebProjectOpenPort;
  readonly writePort?: WebProjectWritePort;
} = {}): ProjectStorageGateway {
  const read = options.readPort ??
    createLayerDocumentProjectBrowserOpenAdapter();
  let write = options.writePort ?? null;
  const getWrite = () => {
    write ??= createLayerDocumentProjectBrowserWriteAdapter();
    return write;
  };
  return {
    capability: read.capability === "native-file-system"
      ? "native-file-system"
      : "browser-fallback",
    chooseProject: async () => {
      const queued = options.takeQueuedSelection?.();
      const selected = queued
        ? { ok: true as const, value: queued }
        : await read.chooseProjectFile();
      if (!selected.ok) return selected;
      const handle = selected.value.handle;
      return {
        ok: true,
        value: {
          fileName: selected.value.file.name,
          bytes: selected.value.bytes,
          target: handle
            ? registerWebProjectStorageTarget({
                kind: "native-file-system",
                fileName: handle.name || selected.value.file.name,
                handle,
              })
            : null,
        },
      };
    },
    chooseTarget: async (suggestedFileName) => {
      const selected = await getWrite().chooseTarget(suggestedFileName);
      return selected.ok
        ? { ok: true, value: registerWebProjectStorageTarget(selected.value) }
        : selected;
    },
    write: async ({ target, bytes, shouldCommit }) => {
      const concrete = projectTargets.get(target.targetId);
      if (!concrete) {
        return {
          ok: false,
          error: {
            code: "write-failed",
            message: "Project storage target is unavailable",
          },
        };
      }
      return getWrite().write({ target: concrete, bytes, shouldCommit });
    },
  };
}
