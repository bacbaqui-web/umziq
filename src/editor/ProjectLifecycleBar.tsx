import type {
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleUiViewModel,
} from "@/editor/projectLifecycleUi";

export type ProjectLifecycleBarProps = {
  readonly viewModel:
    ProjectLifecycleUiViewModel;
  readonly commands:
    ProjectLifecycleUiCommandPort;
};

export function ProjectLifecycleBar({
  viewModel,
  commands,
}: ProjectLifecycleBarProps) {
  const busy = viewModel.commandsDisabled;
  const status =
    viewModel.operation === "saving"
      ? "저장 중"
      : viewModel.operation === "loading"
        ? "불러오는 중"
        : viewModel.dirty === "dirty"
          ? "변경됨"
          : "저장됨";
  return (
    <header className="project-lifecycle-bar">
      <div className="project-lifecycle-bar__commands">
        <button
          className="ui-button"
          disabled={busy}
          onClick={() => void commands.newProject()}
        >
          새 프로젝트
        </button>
        <button
          className="ui-button"
          disabled={busy}
          onClick={() => void commands.openProject()}
        >
          열기
        </button>
        <button
          className="ui-button ui-button--primary"
          disabled={busy}
          onClick={() => void commands.saveProject()}
        >
          저장
        </button>
        <button
          className="ui-button"
          disabled={busy}
          onClick={() => void commands.saveProjectAs()}
        >
          다른 이름으로 저장
        </button>
        <button
          className="ui-button"
          disabled={busy}
          onClick={() => void commands.closeProject()}
        >
          닫기
        </button>
      </div>
      <div className="project-lifecycle-bar__status">
        <span
          className={`project-lifecycle-status project-lifecycle-status--${viewModel.operation === "idle" ? viewModel.dirty : viewModel.operation}`}
        >
          {status}
        </span>
        <span className="project-lifecycle-document">
          {viewModel.document === "file-backed"
            ? "파일 프로젝트"
            : "제목 없음"}
        </span>
        {viewModel.notice && (
          <span
            className={`project-lifecycle-notice project-lifecycle-notice--${viewModel.notice.tone}`}
            title={`${viewModel.notice.code}: ${viewModel.notice.message}`}
          >
            {viewModel.notice.message}
          </span>
        )}
        {viewModel.missingSources.length > 0 && (
          <details className="project-missing-sources">
            <summary>
              연결 필요 {viewModel.missingSources.length}
            </summary>
            <div className="project-missing-sources__menu">
              {viewModel.missingSources.map((source) => (
                <div
                  className="project-missing-sources__item"
                  key={source.sourceId}
                >
                  <span title={source.sourceId}>
                    {source.displayName}
                    {source.fingerprintPolicy ===
                    "legacy-unverified"
                      ? " · 지문 확인 필요"
                      : ""}
                  </span>
                  <button
                    className="ui-button"
                    disabled={busy}
                    onClick={() =>
                      void commands.reconnectSource(
                        source.sourceId
                      )
                    }
                  >
                    재연결
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </header>
  );
}
