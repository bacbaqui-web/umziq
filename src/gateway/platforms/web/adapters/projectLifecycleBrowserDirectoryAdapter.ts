import {
  queueProjectOpenSelection,
  readProjectAssetDirectory,
  setProjectAssetDirectory,
  type ProjectAssetDirectoryHandle,
} from "@/editor/projectAssetDirectoryRuntime";
import {
  createProjectFileName,
} from "@/gateway/helpers/projectLifecycleNameHelpers";
import type {
  ProjectStorageTarget,
} from "@/gateway/contracts/projectStorageGateway";
import type { SourceResourceReference } from "@/gateway/contracts/sourceAccessGateway";
import {
  registerWebProjectStorageTarget,
} from "@/gateway/platforms/web/createWebProjectStorageGateway";

type ProjectDirectoryEntry = {
  readonly kind: "file" | "directory";
  readonly name: string;
  getFile?: () => Promise<File>;
};

type ProjectLifecycleNewProjectRequest = {
  readonly projectName: string;
  readonly directoryName: string;
  readonly psdSources: readonly SourceResourceReference[];
  readonly target: ProjectStorageTarget;
};

export type ProjectLifecycleDirectoryHandle =
  ProjectAssetDirectoryHandle & {
    values(): AsyncIterable<ProjectDirectoryEntry>;
  };

export type ProjectLifecycleDirectoryConnection = {
  readonly retain: () => void;
  readonly restore: () => void;
};

type ProjectOpenSelection = Parameters<
  typeof queueProjectOpenSelection
>[0];

export type ProjectLifecycleDirectoryPickerResult =
  | {
      readonly status: "selected";
      readonly directory:
        ProjectLifecycleDirectoryHandle;
    }
  | {
      readonly status: "unsupported";
    }
  | {
      readonly status: "cancelled";
    }
  | {
      readonly status: "failed";
      readonly error: unknown;
    };

export type ProjectLifecycleNewDirectoryResult =
  | {
      readonly status: "ready";
      readonly directory:
        ProjectLifecycleDirectoryHandle;
      readonly request:
        ProjectLifecycleNewProjectRequest;
    }
  | {
      readonly status: "conflict";
      readonly projectFileCount: number;
    }
  | {
      readonly status: "failed";
      readonly error: unknown;
    };

export type ProjectLifecycleOpenDirectoryResult =
  | {
      readonly status: "ready";
      readonly directory:
        ProjectLifecycleDirectoryHandle;
      readonly selection: ProjectOpenSelection;
    }
  | {
      readonly status: "invalid-project-count";
      readonly projectFileCount: number;
    }
  | {
      readonly status: "failed";
      readonly error: unknown;
    };

export type ProjectLifecycleBrowserDirectoryAdapter = {
  readonly pickDirectory: () => Promise<
    ProjectLifecycleDirectoryPickerResult
  >;
  readonly prepareNewProjectDirectory: (
    parentDirectory:
      ProjectLifecycleDirectoryHandle,
    projectName: string
  ) => Promise<ProjectLifecycleNewDirectoryResult>;
  readonly prepareOpenProjectDirectory: (
    directory: ProjectLifecycleDirectoryHandle
  ) => Promise<ProjectLifecycleOpenDirectoryResult>;
  readonly connectProjectDirectory: (
    directory:
      ProjectLifecycleDirectoryHandle | null
  ) => ProjectLifecycleDirectoryConnection;
  readonly queueOpenSelection: (
    selection: ProjectOpenSelection
  ) => () => void;
};

type ProjectLifecycleDirectoryAdapterOptions = {
  readonly readPicker: () =>
    | ((options: {
        readonly mode: "readwrite";
      }) => Promise<
        ProjectLifecycleDirectoryHandle
      >)
    | undefined;
  readonly assets: {
    readonly read: () =>
      ProjectAssetDirectoryHandle | null;
    readonly set: (
      directory:
        ProjectAssetDirectoryHandle | null
    ) => void;
    readonly queueOpenSelection: (
      selection: ProjectOpenSelection
    ) => () => void;
  };
};

function isAbortError(error: unknown) {
  return error instanceof DOMException &&
    error.name === "AbortError";
}

async function readProjectFiles(
  directory: ProjectLifecycleDirectoryHandle
) {
  const projectFiles: File[] = [];
  for await (const entry of directory.values()) {
    if (
      entry.kind === "file" &&
      /\.ziq$/i.test(entry.name) &&
      entry.getFile
    ) {
      projectFiles.push(await entry.getFile());
    }
  }
  return projectFiles;
}

async function requestDirectoryPermission(
  directory: ProjectLifecycleDirectoryHandle
) {
  const permissionHandle = directory as
    ProjectLifecycleDirectoryHandle & {
      queryPermission?: (options: {
        readonly mode: "readwrite";
      }) => Promise<PermissionState>;
      requestPermission?: (options: {
        readonly mode: "readwrite";
      }) => Promise<PermissionState>;
    };
  const current = await permissionHandle
    .queryPermission?.({ mode: "readwrite" });
  if (current === "denied") return false;
  if (current === "prompt") {
    return await permissionHandle.requestPermission?.({
      mode: "readwrite",
    }) === "granted";
  }
  return true;
}

export function createProjectLifecycleBrowserDirectoryAdapter(
  options: ProjectLifecycleDirectoryAdapterOptions
): ProjectLifecycleBrowserDirectoryAdapter {
  return {
    pickDirectory: async () => {
      const picker = options.readPicker();
      if (!picker) {
        return { status: "unsupported" };
      }
      try {
        return {
          status: "selected",
          directory: await picker({
            mode: "readwrite",
          }),
        };
      } catch (error) {
        return isAbortError(error)
          ? { status: "cancelled" }
          : { status: "failed", error };
      }
    },
    prepareNewProjectDirectory: async (
      parentDirectory,
      projectName
    ) => {
      try {
        const directory =
          await parentDirectory.getDirectoryHandle(
            projectName,
            { create: true }
          ) as ProjectLifecycleDirectoryHandle;
        const projectFiles =
          await readProjectFiles(directory);
        if (projectFiles.length > 0) {
          return {
            status: "conflict",
            projectFileCount:
              projectFiles.length,
          };
        }
        await directory.getDirectoryHandle("psd", {
          create: true,
        });
        await directory.getDirectoryHandle("audio", {
          create: true,
        });
        const fileName =
          createProjectFileName(projectName);
        return {
          status: "ready",
          directory,
          request: {
            projectName,
            directoryName: directory.name,
            psdSources: [],
            target: registerWebProjectStorageTarget({
              kind: "native-file-system",
              fileName,
              handle: {
                name: fileName,
                createWritable: async () => {
                  const handle =
                    await directory.getFileHandle(
                      fileName,
                      { create: true }
                    );
                  return handle.createWritable();
                },
              },
            }),
          },
        };
      } catch (error) {
        return { status: "failed", error };
      }
    },
    prepareOpenProjectDirectory: async (
      directory
    ) => {
      try {
        if (!await requestDirectoryPermission(directory)) {
          return {
            status: "failed",
            error: new DOMException(
              "Project directory permission was denied",
              "NotAllowedError"
            ),
          };
        }
        const projectFiles =
          await readProjectFiles(directory);
        if (projectFiles.length !== 1) {
          return {
            status: "invalid-project-count",
            projectFileCount:
              projectFiles.length,
          };
        }
        const file = projectFiles[0]!;
        const handle =
          await directory.getFileHandle(
            file.name,
            { create: false }
          );
        return {
          status: "ready",
          directory,
          selection: {
            file,
            bytes: new Uint8Array(
              await file.arrayBuffer()
            ),
            handle,
          },
        };
      } catch (error) {
        return { status: "failed", error };
      }
    },
    connectProjectDirectory: (directory) => {
      const previous = options.assets.read();
      options.assets.set(directory);
      let active = true;
      return {
        retain: () => {
          active = false;
        },
        restore: () => {
          if (!active) return;
          active = false;
          if (options.assets.read() === directory) {
            options.assets.set(previous);
          }
        },
      };
    },
    queueOpenSelection: (selection) => {
      const clear =
        options.assets.queueOpenSelection(selection);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        clear();
      };
    },
  };
}

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options: {
    readonly mode: "readwrite";
  }) => Promise<ProjectLifecycleDirectoryHandle>;
};

export const BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER =
  createProjectLifecycleBrowserDirectoryAdapter({
    readPicker: () =>
      (window as DirectoryPickerWindow)
        .showDirectoryPicker,
    assets: {
      read: readProjectAssetDirectory,
      set: setProjectAssetDirectory,
      queueOpenSelection:
        queueProjectOpenSelection,
    },
  });
