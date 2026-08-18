import {
  composeProjectLifecycleUiViewProps,
} from "@/editor/project-lifecycle/composers/projectLifecycleUiComposer";
import type {
  ProjectLifecycleExportOptions,
} from "@/editor/project-lifecycle/models/projectLifecyclePresentationModel";
import {
  useProjectLifecycleUiController,
} from "@/editor/project-lifecycle/state/useProjectLifecycleUiController";
import type {
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleUiViewModel,
} from "@/editor/projectLifecycleUi";
import {
  ProjectLifecycleView,
} from "@/features/project-lifecycle/components/ProjectLifecycleView";

export type ProjectLifecycleBarProps = {
  readonly viewModel:
    ProjectLifecycleUiViewModel;
  readonly commands:
    ProjectLifecycleUiCommandPort;
  readonly exportOptions:
    ProjectLifecycleExportOptions;
};

export function ProjectLifecycleBar({
  viewModel,
  commands,
  exportOptions,
}: ProjectLifecycleBarProps) {
  const controller =
    useProjectLifecycleUiController({
      viewModel,
      commands,
      exportOptions,
    });
  const viewProps =
    composeProjectLifecycleUiViewProps({
      viewModel,
      controller,
      exportOptions,
    });
  return <ProjectLifecycleView {...viewProps} />;
}
