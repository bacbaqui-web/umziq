import {
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  createProjectLifecycleUiController,
  type MenuDirectoryPort,
  type MenuRecentProjectPort,
} from "@/engines/menu/controllers/projectLifecycleUiController";
import {
  createMenuExportController,
} from "@/engines/menu/controllers/menuExportController";
import type {
  ProjectLifecycleExportOptions,
} from "@/engines/menu/models/projectLifecyclePresentationModel";
import type {
  ProjectLifecycleUiControllerReadModel,
} from "@/engines/menu/models/projectLifecycleUiControllerModel";
import type {
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleUiViewModel,
} from "@/engines/menu/models/menuProjectCommandModel";

type UseProjectLifecycleUiControllerOptions = {
  readonly viewModel:
    ProjectLifecycleUiViewModel;
  readonly commands:
    ProjectLifecycleUiCommandPort;
  readonly exportOptions:
    ProjectLifecycleExportOptions;
  readonly directory: MenuDirectoryPort;
  readonly recentProjects: MenuRecentProjectPort;
};

export function useMenuEngine({
  viewModel,
  commands,
  exportOptions,
  directory,
  recentProjects,
}: UseProjectLifecycleUiControllerOptions):
ProjectLifecycleUiControllerReadModel {
  const [controller] = useState(() =>
    createProjectLifecycleUiController({
        dependencies: {
          viewModel,
          commands,
          exportOptions,
        },
        directory,
        recentProjects,
        alert: (message) =>
          window.alert(message),
        schedule: (callback) => {
          const timer = window.setTimeout(
            callback,
            0
          );
          return () => window.clearTimeout(timer);
        },
      })
  );
  const [exportController] = useState(() =>
    createMenuExportController({
      destination: exportOptions.destinationPort,
      runtime: exportOptions.runtime,
      close: controller.intents.closeExport,
    })
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.read,
    controller.read
  );
  const exportState = useSyncExternalStore(
    exportController.subscribe,
    exportController.read,
    exportController.read
  );
  useEffect(() => {
    controller.updateDependencies({
      viewModel,
      commands,
      exportOptions,
    });
  }, [
    commands,
    controller,
    exportOptions,
    viewModel,
  ]);
  useEffect(() => {
    exportController.updatePorts({
      destination: exportOptions.destinationPort,
      runtime: exportOptions.runtime,
      close: controller.intents.closeExport,
    });
  }, [controller, exportController, exportOptions]);
  useEffect(() => {
    controller.activate();
    return () => {
      exportController.dispose();
      controller.deactivate();
    };
  }, [controller, exportController]);
  return {
    state,
    intents: controller.intents,
    exportState,
    exportCommands: exportController,
  };
}
