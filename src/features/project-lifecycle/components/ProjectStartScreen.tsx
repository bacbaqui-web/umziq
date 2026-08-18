import { createPortal } from "react-dom";
import type {
  ProjectLifecycleStartScreenViewProps,
} from "@/editor/project-lifecycle/models/projectLifecyclePresentationModel";

export function ProjectStartScreen({
  visible,
  busy,
  onNewProject,
  onOpenProject,
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
        </div>
      </div>
    </div>,
    document.body
  );
}
