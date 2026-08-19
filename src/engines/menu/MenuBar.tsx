import {
  composeMenuViewProps,
} from "@/engines/menu/composers/menuComposer";
import type {
  ProjectLifecycleExportOptions,
} from "@/engines/menu/models/projectLifecyclePresentationModel";
import {
  useMenuEngine,
} from "@/engines/menu/useMenuEngine";
import type {
  MenuDirectoryPort,
  MenuRecentProjectPort,
} from "@/engines/menu/controllers/projectLifecycleUiController";
import type {
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleUiViewModel,
} from "@/engines/menu/models/menuProjectCommandModel";
import {
  MenuView,
} from "@/engines/menu/components/MenuView";

export type MenuBarProps = {
  readonly viewModel:
    ProjectLifecycleUiViewModel;
  readonly commands:
    ProjectLifecycleUiCommandPort;
  readonly exportOptions:
    ProjectLifecycleExportOptions;
  readonly directory: MenuDirectoryPort;
  readonly recentProjects: MenuRecentProjectPort;
};

export function MenuBar({
  viewModel,
  commands,
  exportOptions,
  directory,
  recentProjects,
}: MenuBarProps) {
  const controller =
    useMenuEngine({
      viewModel,
      commands,
      exportOptions,
      directory,
      recentProjects,
    });
  const viewProps =
    composeMenuViewProps({
      viewModel,
      controller,
      exportOptions,
    });
  return <MenuView {...viewProps} />;
}
