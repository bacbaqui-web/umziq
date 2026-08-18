import type {
  ProjectLifecycleExportOptions,
  ProjectLifecycleViewProps,
} from "@/editor/project-lifecycle/models/projectLifecyclePresentationModel";
import type {
  ProjectLifecycleUiControllerReadModel,
} from "@/editor/project-lifecycle/models/projectLifecycleUiControllerModel";
import type {
  ProjectLifecycleUiViewModel,
} from "@/editor/projectLifecycleUi";

export function composeProjectLifecycleUiViewProps(
  options: {
    readonly viewModel:
      ProjectLifecycleUiViewModel;
    readonly controller:
      ProjectLifecycleUiControllerReadModel;
    readonly exportOptions:
      ProjectLifecycleExportOptions;
  }
): ProjectLifecycleViewProps {
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
      missingSources: {
        busy,
        items: viewModel.missingSources,
        onReconnect: (sourceId) => {
          void controller.intents
            .reconnectSource(sourceId);
        },
      },
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
            onCancel:
              controller.intents.closeExport,
            onExport: exportOptions.run,
          }
        : null,
  };
}
