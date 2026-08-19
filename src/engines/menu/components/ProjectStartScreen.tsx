import { createPortal } from "react-dom";
import type {
  ProjectLifecycleStartScreenViewProps,
} from "@/engines/menu/models/projectLifecyclePresentationModel";

export function ProjectStartScreen({
  visible,
  busy,
  onNewProject,
  onOpenProject,
  recentProjects,
  onOpenRecentProject,
}: ProjectLifecycleStartScreenViewProps) {
  if (!visible) return null;
  return createPortal(
    <div className="project-start-screen">
      <div className="project-start-screen__card preview-dialog-surface">
        <div className="project-start-screen__actions">
          <button
            className="project-start-screen__action"
            disabled={busy}
            onClick={onNewProject}
          >
            <span
              className="project-start-screen__action-icon project-start-screen__action-icon--plus"
              aria-hidden="true"
            >
              +
            </span>
            <strong>새 프로젝트</strong>
            <small>새 작업을 시작합니다</small>
          </button>
          <button
            className="project-start-screen__action project-start-screen__action--open"
            disabled={busy}
            onClick={onOpenProject}
          >
            <span
              className="project-start-screen__action-icon"
              aria-hidden="true"
            >
              <svg
                width="58"
                height="58"
                viewBox="0 0 64 64"
                fill="none"
              >
                <path
                  d="M7 18.5h19l5 6H57v28.5H7z"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 24.5v-9.5h18l5 6h15"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m32 34 6 6-6 6M38 40H22"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <strong>프로젝트 열기</strong>
            <small>기존 프로젝트 폴더를 엽니다</small>
          </button>
          <section className="project-start-screen__recent">
            <div className="project-start-screen__recent-heading">
              <strong>최근 작업</strong>
              <small>최근에 열었던 프로젝트</small>
            </div>
            {recentProjects.length === 0 ? (
              <p>최근에 작업한 프로젝트가 없습니다.</p>
            ) : (
              <div className="project-start-screen__recent-list">
                {recentProjects.map((project) => (
                  <button
                    key={project.id}
                    className="project-start-screen__recent-item"
                    disabled={busy}
                    onClick={() =>
                      onOpenRecentProject(project.id)
                    }
                  >
                    <span>{project.name}</span>
                    <time dateTime={new Date(
                      project.lastOpenedAt
                    ).toISOString()}>
                      {new Intl.DateTimeFormat("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(project.lastOpenedAt)}
                    </time>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
