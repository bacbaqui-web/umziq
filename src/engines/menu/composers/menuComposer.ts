import type {
  ProjectLifecycleExportOptions,
  MenuViewProps,
} from "@/engines/menu/models/projectLifecyclePresentationModel";
import type {
  ProjectLifecycleUiControllerReadModel,
} from "@/engines/menu/models/projectLifecycleUiControllerModel";
import type {
  ProjectLifecycleUiViewModel,
} from "@/engines/menu/models/menuProjectCommandModel";

export function composeMenuViewProps(
  options: {
    readonly viewModel:
      ProjectLifecycleUiViewModel;
    readonly controller:
      ProjectLifecycleUiControllerReadModel;
    readonly exportOptions:
      ProjectLifecycleExportOptions;
  }
): MenuViewProps {
  const { viewModel, controller, exportOptions } =
    options;
  const busy =
    viewModel.commandsDisabled ||
    controller.state.creating;
  return {
    toolbar: {
      busy,
      saveAsDisabled:
        busy || !viewModel.projectCreated,
      onNewProject:
        controller.intents.startNewProject,
      onOpenProject: () => {
        void controller.intents.openProject();
      },
      onSaveProject: () => {
        void controller.intents.saveProject();
      },
      onSaveProjectAs: () => {
        void controller.intents.saveProjectAs();
      },
      onCloseProject: () => {
        void controller.intents.closeProject();
      },
      onOpenExport:
        controller.intents.openExport,
    },
    startScreen: {
      visible: !viewModel.projectCreated,
      busy,
      onNewProject:
        controller.intents.startNewProject,
      onOpenProject: () => {
        void controller.intents.openProject();
      },
      recentProjects:
        controller.state.recentProjects,
      onOpenRecentProject: (projectId) => {
        void controller.intents
          .openRecentProject(projectId);
      },
    },
    newProjectDialog:
      controller.state.pendingProject
        ? {
            parentDirectoryName:
              controller.state.pendingProject
                .parentDirectoryName,
            busy: controller.state.creating,
            onCancel:
              controller.intents
                .cancelNewProject,
            onChooseLocation: () => {
              void controller.intents
                .chooseNewProjectLocation();
            },
            onCreate: (projectName) => {
              void controller.intents
                .createNewProject(projectName);
            },
          }
        : null,
    status: {
      notice: viewModel.notice,
      projectLocation:
        viewModel.projectLocation,
    },
    exportDialog:
      controller.state.exportOpen
        ? {
            projectName:
              exportOptions.projectName,
            durationFrames:
              exportOptions.durationFrames,
            frameRate:
              exportOptions.frameRate,
            state: controller.exportState,
            commands: controller.exportCommands,
          }
        : null,
  };
}
