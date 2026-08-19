export type ProjectLifecycleUiControllerState = {
  readonly pendingProject: {
    readonly parentDirectoryName: string | null;
  } | null;
  readonly creating: boolean;
  readonly exportOpen: boolean;
  readonly recentProjects: readonly {
    readonly id: string;
    readonly name: string;
    readonly lastOpenedAt: number;
  }[];
};

export type ProjectLifecycleUiControllerIntents = {
  readonly startNewProject: () => void;
  readonly cancelNewProject: () => void;
  readonly chooseNewProjectLocation: () => Promise<void>;
  readonly createNewProject: (
    projectName: string
  ) => Promise<void>;
  readonly openProject: () => Promise<void>;
  readonly openRecentProject: (
    projectId: string
  ) => Promise<void>;
  readonly saveProject: () => Promise<void>;
  readonly saveProjectAs: () => Promise<void>;
  readonly closeProject: () => Promise<void>;
  readonly openExport: () => void;
  readonly closeExport: () => void;
};

export type ProjectLifecycleUiControllerReadModel = {
  readonly state: ProjectLifecycleUiControllerState;
  readonly intents: ProjectLifecycleUiControllerIntents;
  readonly exportState: import("@/engines/menu/models/menuExportModel").MenuExportControllerSnapshot;
  readonly exportCommands: Pick<
    import("@/engines/menu/models/menuExportModel").MenuExportController,
    "chooseDestination" | "run" | "cancel" | "isFormatSupported"
  >;
};
