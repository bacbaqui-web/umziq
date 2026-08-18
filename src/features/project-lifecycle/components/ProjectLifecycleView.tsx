import { ProjectExportDialog } from "@/editor/ProjectExportDialog";
import type {
  ProjectLifecycleViewProps,
} from "@/editor/project-lifecycle/models/projectLifecyclePresentationModel";
import { MissingSourceBanner } from "@/features/project-lifecycle/components/MissingSourceBanner";
import { NewProjectDialog } from "@/features/project-lifecycle/components/NewProjectDialog";
import { ProjectLifecycleToolbar } from "@/features/project-lifecycle/components/ProjectLifecycleToolbar";
import { ProjectStartScreen } from "@/features/project-lifecycle/components/ProjectStartScreen";

export function ProjectLifecycleView({
  toolbar,
  startScreen,
  newProjectDialog,
  status,
  exportDialog,
}: ProjectLifecycleViewProps) {
  return (
    <>
      <ProjectStartScreen {...startScreen} />
      <header className="project-lifecycle-bar">
        <ProjectLifecycleToolbar {...toolbar} />
        <div className="project-lifecycle-bar__status">
          {status.notice && (
            <span
              className={`project-lifecycle-notice project-lifecycle-notice--${status.notice.tone}`}
              title={`${status.notice.code}: ${status.notice.message}`}
            >
              {status.notice.message}
            </span>
          )}
          {status.projectLocation && (
            <span
              className="project-lifecycle-location"
              title={status.projectLocation}
            >
              {status.projectLocation}
            </span>
          )}
          <MissingSourceBanner
            {...status.missingSources}
          />
        </div>
      </header>
      {newProjectDialog && (
        <NewProjectDialog
          {...newProjectDialog}
        />
      )}
      {exportDialog && (
        <ProjectExportDialog
          {...exportDialog}
        />
      )}
    </>
  );
}
