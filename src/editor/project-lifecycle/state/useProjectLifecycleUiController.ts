import {
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER,
  type ProjectLifecycleBrowserDirectoryAdapter,
} from "@/editor/project-lifecycle/adapters/projectLifecycleBrowserDirectoryAdapter";
import {
  createProjectLifecycleUiController,
} from "@/editor/project-lifecycle/controllers/projectLifecycleUiController";
import type {
  ProjectLifecycleExportOptions,
} from "@/editor/project-lifecycle/models/projectLifecyclePresentationModel";
import type {
  ProjectLifecycleUiControllerReadModel,
} from "@/editor/project-lifecycle/models/projectLifecycleUiControllerModel";
import type {
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleUiViewModel,
} from "@/editor/projectLifecycleUi";

type UseProjectLifecycleUiControllerOptions = {
  readonly viewModel:
    ProjectLifecycleUiViewModel;
  readonly commands:
    ProjectLifecycleUiCommandPort;
  readonly exportOptions:
    ProjectLifecycleExportOptions;
  readonly directory?:
    ProjectLifecycleBrowserDirectoryAdapter;
};

export function useProjectLifecycleUiController({
  viewModel,
  commands,
  exportOptions,
  directory =
    BROWSER_PROJECT_LIFECYCLE_DIRECTORY_ADAPTER,
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
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.read,
    controller.read
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
    controller.activate();
    return () => controller.deactivate();
  }, [controller]);
  return {
    state,
    intents: controller.intents,
  };
}
