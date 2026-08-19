import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  createProjectFileName,
  formatPendingProjectLocation,
  sanitizeProjectName,
} from "@/gateway/helpers/projectLifecycleNameHelpers";
import type {
  NewProjectDialogViewProps,
} from "@/engines/menu/models/projectLifecyclePresentationModel";

export function NewProjectDialog({
  parentDirectoryName,
  busy,
  onCancel,
  onChooseLocation,
  onCreate,
}: NewProjectDialogViewProps) {
  const [name, setName] = useState("");
  const projectName = sanitizeProjectName(name);
  const fileName =
    createProjectFileName(projectName);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, [busy, onCancel]);

  return createPortal(
    <div
      className="new-project-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="새 프로젝트 만들기"
    >
      <form
        className="new-project-dialog preview-dialog-surface"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !projectName ||
            !parentDirectoryName ||
            busy
          ) return;
          onCreate(projectName);
        }}
      >
        <header className="new-project-dialog__header">
          <strong>새 프로젝트 만들기</strong>
        </header>
        <main className="new-project-dialog__body">
          <label className="new-project-dialog__field">
            <span>프로젝트 이름</span>
            <input
              autoFocus
              value={name}
              disabled={busy}
              onChange={(event) =>
                setName(
                  event.currentTarget.value
                )
              }
            />
          </label>
          <div className="new-project-dialog__filename">
            저장 파일: {projectName
              ? fileName
              : "이름을 입력하세요"}
          </div>
          <section className="new-project-dialog__location">
            <div>
              <strong>프로젝트 저장 위치</strong>
              <span>
                {formatPendingProjectLocation(
                  parentDirectoryName,
                  projectName
                )}
              </span>
            </div>
            <button
              className="ui-button"
              type="button"
              disabled={busy}
              onClick={onChooseLocation}
            >
              위치 선택
            </button>
          </section>
          <p className="new-project-dialog__structure">
            프로젝트 폴더 안에 .ziq 파일과 psd, audio 폴더가 자동으로 만들어집니다.
          </p>
        </main>
        <footer className="new-project-dialog__actions">
          <button
            className="ui-button"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="ui-button ui-button--primary"
            type="submit"
            disabled={
              busy ||
              !projectName ||
              !parentDirectoryName
            }
          >
            {busy
              ? "만드는 중"
              : "프로젝트 만들기"}
          </button>
        </footer>
      </form>
    </div>,
    document.body
  );
}
