export type ProjectLifecycleUiControllerState = {
  readonly pendingProject: {
    readonly parentDirectoryName: string | null;
  } | null;
  readonly creating: boolean;
  readonly exportOpen: boolean;
};

export type ProjectLifecycleUiControllerIntents = {
  readonly startNewProject: () => void;
  readonly cancelNewProject: () => void;
  readonly chooseNewProjectLocation: () => Promise<void>;
  readonly createNewProject: (
    projectName: string
  ) => Promise<void>;
  readonly openProject: () => Promise<void>;
  readonly saveProject: () => Promise<void>;
  readonly saveProjectAs: () => Promise<void>;
  readonly closeProject: () => Promise<void>;
  readonly reconnectSource: (
    sourceId: string
  ) => Promise<void>;
  readonly openExport: () => void;
  readonly closeExport: () => void;
};

export type ProjectLifecycleUiControllerReadModel = {
  readonly state: ProjectLifecycleUiControllerState;
  readonly intents: ProjectLifecycleUiControllerIntents;
};
