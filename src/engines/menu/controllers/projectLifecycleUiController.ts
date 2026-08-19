import type {
  ProjectLifecycleExportOptions,
} from "@/engines/menu/models/projectLifecyclePresentationModel";
import type {
  ProjectLifecycleUiControllerIntents,
  ProjectLifecycleUiControllerState,
} from "@/engines/menu/models/projectLifecycleUiControllerModel";
import type {
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleNewProjectRequest,
  ProjectLifecycleUiViewModel,
} from "@/engines/menu/models/menuProjectCommandModel";

export type MenuDirectoryReference = {
  readonly directoryId: string;
  readonly name: string;
};

type MenuDirectoryConnection = {
  readonly retain: () => void;
  readonly restore: () => void;
};

export type MenuDirectoryPort = {
  readonly pickDirectory: () => Promise<
    | { readonly status: "selected"; readonly directory: MenuDirectoryReference }
    | { readonly status: "unsupported" }
    | { readonly status: "cancelled" }
    | { readonly status: "failed"; readonly error: unknown }
  >;
  readonly prepareNewProjectDirectory: (
    directory: MenuDirectoryReference,
    projectName: string
  ) => Promise<
    | { readonly status: "ready"; readonly directory: MenuDirectoryReference; readonly request: ProjectLifecycleNewProjectRequest }
    | { readonly status: "conflict"; readonly projectFileCount: number }
    | { readonly status: "failed"; readonly error: unknown }
  >;
  readonly prepareOpenProjectDirectory: (
    directory: MenuDirectoryReference
  ) => Promise<
    | { readonly status: "ready"; readonly directory: MenuDirectoryReference; readonly selection: unknown }
    | { readonly status: "invalid-project-count"; readonly projectFileCount: number }
    | { readonly status: "failed"; readonly error: unknown }
  >;
  readonly connectProjectDirectory: (
    directory: MenuDirectoryReference | null
  ) => MenuDirectoryConnection;
  readonly queueOpenSelection: (
    selection: unknown
  ) => () => void;
};

export type MenuRecentProject = {
  readonly id: string;
  readonly name: string;
  readonly lastOpenedAt: number;
  readonly directory: MenuDirectoryReference;
};

export type MenuRecentProjectPort = {
  readonly read: () => Promise<readonly MenuRecentProject[]>;
  readonly remember: (
    directory: MenuDirectoryReference
  ) => Promise<readonly MenuRecentProject[]>;
};

type ProjectLifecycleUiControllerDependencies = {
  readonly viewModel: ProjectLifecycleUiViewModel;
  readonly commands: ProjectLifecycleUiCommandPort;
  readonly exportOptions:
    ProjectLifecycleExportOptions;
};

export type ProjectLifecycleUiController = {
  readonly read: () =>
    ProjectLifecycleUiControllerState;
  readonly subscribe: (
    listener: () => void
  ) => () => void;
  readonly intents:
    ProjectLifecycleUiControllerIntents;
  readonly updateDependencies: (
    dependencies:
      ProjectLifecycleUiControllerDependencies
  ) => void;
  readonly activate: () => void;
  readonly deactivate: () => void;
};

type ProjectLifecycleUiControllerOptions = {
  readonly dependencies:
    ProjectLifecycleUiControllerDependencies;
  readonly directory:
    MenuDirectoryPort;
  readonly recentProjects:
    MenuRecentProjectPort;
  readonly alert: (message: string) => void;
  readonly schedule: (
    callback: () => void
  ) => () => void;
};

type IntentToken = {
  readonly id: number;
};

function isSuccessfulOpen(
  commands: ProjectLifecycleUiCommandPort
) {
  const code = commands.read().notice?.code;
  return code === "ready" ||
    code === "ready-degraded";
}

export function createProjectLifecycleUiController(
  options: ProjectLifecycleUiControllerOptions
): ProjectLifecycleUiController {
  let dependencies = options.dependencies;
  let state: ProjectLifecycleUiControllerState = {
    pendingProject: null,
    creating: false,
    exportOpen: false,
    recentProjects: [],
  };
  let pendingParentDirectory:
    MenuDirectoryReference | null = null;
  let active = true;
  let tokenSequence = 0;
  let activeIntent: IntentToken | null = null;
  const listeners = new Set<() => void>();
  const scheduledCleanups = new Set<() => void>();

  const publish = (
    patch: Partial<ProjectLifecycleUiControllerState>
  ) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const beginIntent = () => {
    if (activeIntent || !active) return null;
    const token = { id: ++tokenSequence };
    activeIntent = token;
    return token;
  };
  const isCurrent = (token: IntentToken) =>
    active && activeIntent === token;
  const finishIntent = (token: IntentToken) => {
    if (activeIntent === token) {
      activeIntent = null;
    }
  };
  const runCoreIntent = async (
    command: () => Promise<void>
  ) => {
    const token = beginIntent();
    if (!token) return;
    try {
      await command();
    } finally {
      finishIntent(token);
    }
  };
  let recentProjectEntries:
    readonly MenuRecentProject[] = [];
  const publishRecentProjects = (
    projects: readonly MenuRecentProject[]
  ) => {
    recentProjectEntries = projects;
    publish({
      recentProjects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        lastOpenedAt: project.lastOpenedAt,
      })),
    });
  };
  const rememberDirectory = async (
    directory: MenuDirectoryReference
  ) => {
    try {
      publishRecentProjects(
        await options.recentProjects.remember(directory)
      );
    } catch {
      // Recent Projects are a best-effort browser convenience.
    }
  };
  const openDirectory = async (
    directory: MenuDirectoryReference,
    token: IntentToken
  ) => {
    const prepared = await options.directory
      .prepareOpenProjectDirectory(directory);
    if (!isCurrent(token)) return;
    if (prepared.status === "invalid-project-count") {
      options.alert(
        prepared.projectFileCount === 0
          ? "선택한 폴더에 .ziq 프로젝트 파일이 없습니다."
          : "선택한 폴더에 .ziq 프로젝트 파일이 여러 개 있습니다. 프로젝트별로 폴더를 나누거나 열 파일을 하나만 남겨주세요."
      );
      return;
    }
    if (prepared.status === "failed") {
      options.alert(
        "프로젝트 폴더를 열 수 없습니다. 폴더 접근 권한을 확인해주세요."
      );
      return;
    }
    const connection =
      options.directory.connectProjectDirectory(
        prepared.directory
      );
    const clearSelection =
      options.directory.queueOpenSelection(
        prepared.selection
      );
    try {
      const commands = dependencies.commands;
      await commands.openProject();
      if (isSuccessfulOpen(commands)) {
        connection.retain();
        await rememberDirectory(prepared.directory);
        return;
      }
    } finally {
      clearSelection();
      connection.restore();
    }
  };

  const intents: ProjectLifecycleUiControllerIntents = {
    startNewProject: () => {
      const { viewModel } =
        dependencies;
      if (
        !active || activeIntent ||
        viewModel.commandsDisabled
      ) return;
      pendingParentDirectory = null;
      publish({
        pendingProject: {
          parentDirectoryName: null,
        },
      });
    },
    cancelNewProject: () => {
      if (!active || state.creating) return;
      pendingParentDirectory = null;
      publish({ pendingProject: null });
    },
    chooseNewProjectLocation: async () => {
      if (state.creating) return;
      const token = beginIntent();
      if (!token) return;
      try {
        const result =
          await options.directory.pickDirectory();
        if (!isCurrent(token)) return;
        if (result.status === "selected") {
          pendingParentDirectory =
            result.directory;
          publish({
            pendingProject: {
              parentDirectoryName:
                result.directory.name,
            },
          });
        } else if (result.status === "unsupported") {
          options.alert(
            "이 브라우저는 폴더 프로젝트 만들기를 지원하지 않습니다. Chrome 또는 Edge에서 실행해주세요."
          );
        } else if (result.status === "failed") {
          options.alert(
            "선택한 폴더를 읽을 수 없습니다. 폴더 접근 권한을 확인해주세요."
          );
        }
      } finally {
        finishIntent(token);
      }
    },
    createNewProject: async (projectName) => {
      const parentDirectory =
        pendingParentDirectory;
      if (!parentDirectory || !projectName) return;
      const token = beginIntent();
      if (!token) return;
      publish({ creating: true });
      try {
        const prepared =
          await options.directory
            .prepareNewProjectDirectory(
              parentDirectory,
              projectName
            );
        if (!isCurrent(token)) return;
        if (prepared.status === "conflict") {
          options.alert(
            "같은 이름의 프로젝트 폴더에 이미 .ziq 파일이 있습니다. 다른 프로젝트 이름을 사용해주세요."
          );
          return;
        }
        if (prepared.status === "failed") {
          options.alert(
            "프로젝트 폴더를 만들 수 없습니다. 폴더 접근 권한을 확인해주세요."
          );
          return;
        }
        const connection =
          options.directory.connectProjectDirectory(
            prepared.directory
          );
        let created = false;
        try {
          created = await dependencies
            .commands.newProject(prepared.request);
        } catch {
          options.alert(
            "프로젝트 폴더를 만들 수 없습니다. 폴더 접근 권한을 확인해주세요."
          );
        }
        if (created && isCurrent(token)) {
          connection.retain();
          await rememberDirectory(
            prepared.directory
          );
          pendingParentDirectory = null;
          publish({ pendingProject: null });
        } else {
          connection.restore();
        }
      } finally {
        if (isCurrent(token)) {
          publish({ creating: false });
        }
        finishIntent(token);
      }
    },
    openProject: async () => {
      const token = beginIntent();
      if (!token) return;
      let restoreDirectory:
        (() => void) | null = null;
      try {
        const picked =
          await options.directory.pickDirectory();
        if (!isCurrent(token)) return;
        if (picked.status === "cancelled") return;
        if (picked.status === "failed") {
          options.alert(
            "프로젝트 폴더를 열 수 없습니다. 폴더 접근 권한을 확인해주세요."
          );
          return;
        }

        const commands =
          dependencies.commands;
        if (picked.status === "unsupported") {
          const connection =
            options.directory.connectProjectDirectory(
              null
            );
          restoreDirectory = connection.restore;
          await commands.openProject();
          if (isSuccessfulOpen(commands)) {
            connection.retain();
            restoreDirectory = null;
          }
          return;
        }

        await openDirectory(picked.directory, token);
      } catch {
        options.alert(
          "프로젝트 폴더를 열 수 없습니다. 폴더 접근 권한을 확인해주세요."
        );
      } finally {
        restoreDirectory?.();
        finishIntent(token);
      }
    },
    openRecentProject: async (projectId) => {
      const token = beginIntent();
      if (!token) return;
      try {
        const project = recentProjectEntries.find(
          (candidate) => candidate.id === projectId
        );
        if (!project) return;
        await openDirectory(project.directory, token);
      } catch {
        options.alert(
          "최근 프로젝트를 열 수 없습니다. 폴더 접근 권한을 다시 확인해주세요."
        );
      } finally {
        finishIntent(token);
      }
    },
    saveProject: () =>
      runCoreIntent(() =>
        dependencies.commands.saveProject()
      ),
    saveProjectAs: () =>
      runCoreIntent(() =>
        dependencies.commands.saveProjectAs()
      ),
    closeProject: async () => {
      const token = beginIntent();
      if (!token) return;
      try {
        const commands =
          dependencies.commands;
        await commands.closeProject();
        if (
          commands.read().notice?.code ===
          "close-project"
        ) {
          options.directory
            .connectProjectDirectory(null)
            .retain();
        }
      } finally {
        finishIntent(token);
      }
    },
    openExport: () => {
      const { viewModel, exportOptions } =
        dependencies;
      if (
        !active || state.exportOpen ||
        viewModel.commandsDisabled
      ) return;
      publish({ exportOpen: true });
      let cleanup = () => {};
      cleanup = options.schedule(() => {
        scheduledCleanups.delete(cleanup);
        if (active) exportOptions.prepare();
      });
      scheduledCleanups.add(cleanup);
    },
    closeExport: () => {
      if (!active || !state.exportOpen) return;
      publish({ exportOpen: false });
    },
  };

  return {
    read: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    intents,
    updateDependencies: (next) => {
      dependencies = next;
    },
    activate: () => {
      active = true;
      void options.recentProjects.read()
        .then((projects) => {
          if (active) publishRecentProjects(projects);
        })
        .catch(() => {});
    },
    deactivate: () => {
      active = false;
      activeIntent = null;
      tokenSequence += 1;
      for (const cleanup of scheduledCleanups) {
        cleanup();
      }
      scheduledCleanups.clear();
    },
  };
}
