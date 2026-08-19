import { ProjectExportDialog } from "@/engines/menu/components/ProjectExportDialog";
import type {
  MenuViewProps,
} from "@/engines/menu/models/projectLifecyclePresentationModel";
import { NewProjectDialog } from "@/engines/menu/components/NewProjectDialog";
import { ProjectLifecycleToolbar } from "@/engines/menu/components/ProjectLifecycleToolbar";
import { ProjectStartScreen } from "@/engines/menu/components/ProjectStartScreen";

export function MenuView({
  toolbar,
  startScreen,
  newProjectDialog,
  status,
  exportDialog,
}: MenuViewProps) {
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
