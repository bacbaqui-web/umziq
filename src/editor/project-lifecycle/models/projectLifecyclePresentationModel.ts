import type {
  ProjectExportDestination,
  ProjectExportFormat,
  ProjectExportProgress,
} from "@/editor/projectExport";
import type {
  ProjectLifecycleUiNotice,
} from "@/editor/projectLifecycleUi";
import type {
  LayerDocumentProjectReconnectReadItem,
} from "@/engines/project";

export type ProjectLifecycleExportOptions = {
  readonly projectName: string;
  readonly durationFrames: number;
  readonly frameRate: number;
  readonly prepare: () => unknown;
  readonly run: (
    format: ProjectExportFormat,
    destination: ProjectExportDestination | null,
    onProgress: (progress: ProjectExportProgress) => void,
    signal: AbortSignal,
  ) => Promise<void>;
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
};

export type NewProjectDialogViewProps = {
  readonly parentDirectoryName: string | null;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onChooseLocation: () => void;
  readonly onCreate: (projectName: string) => void;
};

export type MissingSourceBannerViewProps = {
  readonly busy: boolean;
  readonly items:
    readonly LayerDocumentProjectReconnectReadItem[];
  readonly onReconnect: (sourceId: string) => void;
};

export type ProjectLifecycleStatusViewProps = {
  readonly notice: ProjectLifecycleUiNotice;
  readonly projectLocation: string | null;
  readonly missingSources:
    MissingSourceBannerViewProps;
};

export type ProjectLifecycleExportDialogViewProps = {
  readonly projectName: string;
  readonly durationFrames: number;
  readonly frameRate: number;
  readonly onCancel: () => void;
  readonly onExport: ProjectLifecycleExportOptions["run"];
};

export type ProjectLifecycleViewProps = {
  readonly toolbar: ProjectLifecycleToolbarViewProps;
  readonly startScreen:
    ProjectLifecycleStartScreenViewProps;
  readonly newProjectDialog:
    NewProjectDialogViewProps | null;
  readonly status: ProjectLifecycleStatusViewProps;
  readonly exportDialog:
    ProjectLifecycleExportDialogViewProps | null;
};
