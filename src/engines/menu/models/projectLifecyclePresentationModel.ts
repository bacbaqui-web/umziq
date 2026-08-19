import type { ExportDestinationPort } from "@/gateway";
import type {
  MenuExportController,
  MenuExportControllerSnapshot,
  MenuExportRuntimePort,
} from "@/engines/menu/models/menuExportModel";
import type {
  ProjectLifecycleUiNotice,
} from "@/engines/menu/models/menuProjectCommandModel";

export type ProjectLifecycleExportOptions = {
  readonly projectName: string;
  readonly durationFrames: number;
  readonly frameRate: number;
  readonly prepare: () => unknown;
  readonly destinationPort: ExportDestinationPort;
  readonly runtime: MenuExportRuntimePort;
};

export type ProjectLifecycleToolbarViewProps = {
  readonly busy: boolean;
  readonly saveAsDisabled: boolean;
  readonly onNewProject: () => void;
  readonly onOpenProject: () => void;
  readonly onSaveProject: () => void;
  readonly onSaveProjectAs: () => void;
  readonly onCloseProject: () => void;
  readonly onOpenExport: () => void;
};

export type ProjectLifecycleStartScreenViewProps = {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly onNewProject: () => void;
  readonly onOpenProject: () => void;
  readonly recentProjects: readonly {
    readonly id: string;
    readonly name: string;
    readonly lastOpenedAt: number;
  }[];
  readonly onOpenRecentProject: (
    projectId: string
  ) => void;
};

export type NewProjectDialogViewProps = {
  readonly parentDirectoryName: string | null;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onChooseLocation: () => void;
  readonly onCreate: (projectName: string) => void;
};

export type ProjectLifecycleStatusViewProps = {
  readonly notice: ProjectLifecycleUiNotice;
  readonly projectLocation: string | null;
};

export type ProjectLifecycleExportDialogViewProps = {
  readonly projectName: string;
  readonly durationFrames: number;
  readonly frameRate: number;
  readonly state: MenuExportControllerSnapshot;
  readonly commands: Pick<
    MenuExportController,
    "chooseDestination" | "run" | "cancel" | "isFormatSupported"
  >;
};

export type MenuViewProps = {
  readonly toolbar: ProjectLifecycleToolbarViewProps;
  readonly startScreen:
    ProjectLifecycleStartScreenViewProps;
  readonly newProjectDialog:
    NewProjectDialogViewProps | null;
  readonly status: ProjectLifecycleStatusViewProps;
  readonly exportDialog:
    ProjectLifecycleExportDialogViewProps | null;
};
