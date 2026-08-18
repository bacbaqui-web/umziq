import type {
  ProjectLifecycleToolbarViewProps,
} from "@/editor/project-lifecycle/models/projectLifecyclePresentationModel";

export function ProjectLifecycleToolbar({
  busy,
  saveAsDisabled,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onCloseProject,
  onOpenExport,
}: ProjectLifecycleToolbarViewProps) {
  return (
    <div className="project-lifecycle-bar__commands">
      <span className="project-lifecycle-bar__brand">
        움직
      </span>
      <button
        className="ui-button"
        disabled={busy}
        onClick={onNewProject}
      >
        새 프로젝트
      </button>
      <button
        className="ui-button"
        disabled={busy}
        onClick={onOpenProject}
      >
        열기
      </button>
      <button
        className="ui-button"
        disabled={busy}
        onClick={onSaveProject}
      >
        저장
      </button>
      <button
        className="ui-button"
        disabled={saveAsDisabled}
        onClick={onSaveProjectAs}
      >
        다른 이름으로 저장
      </button>
      <button
        className="ui-button"
        disabled={busy}
        onClick={onCloseProject}
      >
        닫기
      </button>
      <span
        className="project-lifecycle-bar__separator"
        aria-hidden="true"
      />
      <button
        className="ui-button"
        disabled={busy}
        onClick={onOpenExport}
      >
        출력
      </button>
    </div>
  );
}
