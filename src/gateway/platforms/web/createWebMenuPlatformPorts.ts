import {
  BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER,
  type ProjectLifecycleDirectoryHandle,
} from "@/gateway/platforms/web/adapters/projectLifecycleBrowserDirectoryAdapter";
import {
  BROWSER_PROJECT_LIFECYCLE_RECENT_PROJECT_STORE,
} from "@/gateway/platforms/web/adapters/projectLifecycleRecentProjectStore";
import type {
  MenuDirectoryPort,
  MenuDirectoryReference,
  MenuRecentProjectPort,
} from "../../../engines/menu/controllers/projectLifecycleUiController.ts";
type SelectionReference = {
  readonly selectionId: string;
};

export function createWebMenuPlatformPorts(): {
  readonly directory: MenuDirectoryPort;
  readonly recentProjects: MenuRecentProjectPort;
} {
  const directories = new Map<
    string,
    ProjectLifecycleDirectoryHandle
  >();
  const selections = new Map<string, unknown>();
  let sequence = 0;
  const registerDirectory = (
    directory: ProjectLifecycleDirectoryHandle
  ): MenuDirectoryReference => {
    const directoryId = `web-directory:${++sequence}`;
    directories.set(directoryId, directory);
    return { directoryId, name: directory.name };
  };
  const resolveDirectory = (
    reference: MenuDirectoryReference
  ) => {
    const directory = directories.get(reference.directoryId);
    if (!directory) {
      throw new Error("Web directory reference is unavailable");
    }
    return directory;
  };

  const directory: MenuDirectoryPort = {
    pickDirectory: async () => {
      const result = await BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER
        .pickDirectory();
      return result.status === "selected"
        ? {
            status: "selected",
            directory: registerDirectory(result.directory),
          }
        : result;
    },
    prepareNewProjectDirectory: async (parent, projectName) => {
      const result = await BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER
        .prepareNewProjectDirectory(
          resolveDirectory(parent),
          projectName
        );
      return result.status === "ready"
        ? {
            ...result,
            directory: registerDirectory(result.directory),
          }
        : result;
    },
    prepareOpenProjectDirectory: async (reference) => {
      const result = await BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER
        .prepareOpenProjectDirectory(
          resolveDirectory(reference)
        );
      if (result.status !== "ready") return result;
      const selectionId = `web-selection:${++sequence}`;
      selections.set(selectionId, result.selection);
      return {
        status: "ready",
        directory: registerDirectory(result.directory),
        selection: { selectionId } satisfies SelectionReference,
      };
    },
    connectProjectDirectory: (reference) =>
      BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER
        .connectProjectDirectory(
          reference ? resolveDirectory(reference) : null
        ),
    queueOpenSelection: (reference) => {
      const selectionId =
        (reference as SelectionReference).selectionId;
      const selection = selections.get(selectionId);
      if (!selection) {
        throw new Error("Web Project selection is unavailable");
      }
      const clear = BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER
        .queueOpenSelection(selection as never);
      return () => {
        selections.delete(selectionId);
        clear();
      };
    },
  };

  const recentProjects: MenuRecentProjectPort = {
    read: async () =>
      (await BROWSER_PROJECT_LIFECYCLE_RECENT_PROJECT_STORE.read())
        .map((project) => ({
          ...project,
          directory: registerDirectory(project.directory),
        })),
    remember: async (reference) =>
      (await BROWSER_PROJECT_LIFECYCLE_RECENT_PROJECT_STORE.remember(
        resolveDirectory(reference)
      )).map((project) => ({
        ...project,
        directory: registerDirectory(project.directory),
      })),
  };
  return { directory, recentProjects };
}
