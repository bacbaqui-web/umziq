import { useEffect, useState } from "react";
import type {
  ProjectLifecycleNewProjectRequest,
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleUiViewModel,
} from "@/editor/projectLifecycleUi";
import { ProjectExportDialog } from "@/editor/ProjectExportDialog";
import type {
  ProjectExportDestination,
  ProjectExportFormat,
  ProjectExportProgress,
} from "@/editor/projectExport";

type WritableFileStream = {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
};

type WritableFileHandle = {
  readonly name: string;
  createWritable(): Promise<WritableFileStream>;
};

type ProjectDirectoryHandle = {
  readonly name: string;
  values(): AsyncIterable<{
    readonly kind: "file" | "directory";
    readonly name: string;
    getFile?: () => Promise<File>;
  }>;
  getFileHandle(
    name: string,
    options: { readonly create: true }
  ): Promise<WritableFileHandle>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options: {
    readonly mode: "readwrite";
  }) => Promise<ProjectDirectoryHandle>;
};

type PendingProject = {
  readonly directory: ProjectDirectoryHandle;
  readonly psdFiles: readonly File[];
};

export type ProjectLifecycleBarProps = {
  readonly viewModel:
    ProjectLifecycleUiViewModel;
  readonly commands:
    ProjectLifecycleUiCommandPort;
  readonly exportOptions: {
    readonly projectName: string;
    readonly durationFrames: number;
    readonly frameRate: number;
    readonly prepare: () => unknown;
    readonly run: (
      format: ProjectExportFormat,
      destination: ProjectExportDestination | null,
      onProgress: (progress: ProjectExportProgress) => void,
      signal: AbortSignal,
    ) => Promise<void>;
  };
};

function safeProjectName(value: string) {
  return value
    .trim()
    .replace(/\.ziq$/i, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .map((character) =>
      character.charCodeAt(0) < 32
        ? "-"
        : character
    )
    .join("")
    .replace(/\.+$/g, "")
    .slice(0, 120);
}

async function readProjectFolder(
  directory: ProjectDirectoryHandle
) {
  const psdFiles: File[] = [];
  for await (const entry of directory.values()) {
    if (
      entry.kind === "file" &&
      /\.psd$/i.test(entry.name) &&
      entry.getFile
    ) {
      psdFiles.push(await entry.getFile());
    }
  }
  return psdFiles.sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

function NewProjectDialog({
  pending,
  busy,
  onCancel,
  onCreate,
}: {
  readonly pending: PendingProject;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onCreate: (
    request: ProjectLifecycleNewProjectRequest
  ) => void;
}) {
  const [name, setName] = useState(
    pending.directory.name
  );
  const projectName = safeProjectName(name);
  const fileName = `${projectName}.ziq`;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  return (
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
          if (!projectName || busy) return;
          onCreate({
            projectName,
            directoryName: pending.directory.name,
            psdFiles: pending.psdFiles,
            target: {
              kind: "native-file-system",
              fileName,
              handle: {
                name: fileName,
                createWritable: async () => {
                  const handle =
                    await pending.directory.getFileHandle(
                      fileName,
                      { create: true }
                    );
                  return handle.createWritable();
                },
              },
            },
          });
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
                setName(event.currentTarget.value)
              }
            />
          </label>
          <div className="new-project-dialog__filename">
            저장 파일: {projectName ? fileName : "이름을 입력하세요"}
          </div>
          <section className="new-project-dialog__files">
            <strong>
              발견한 PSD 파일 {pending.psdFiles.length}개
            </strong>
            {pending.psdFiles.length > 0 ? (
              <ul>
                {pending.psdFiles.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            ) : (
              <p>
                PSD는 프로젝트를 만든 후에도 불러올 수 있습니다.
              </p>
            )}
          </section>
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
            disabled={busy || !projectName}
          >
            {busy ? "만드는 중" : "프로젝트 만들기"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function ProjectLifecycleBar({
  viewModel,
  commands,
  exportOptions,
}: ProjectLifecycleBarProps) {
  const [pendingProject, setPendingProject] =
    useState<PendingProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const busy =
    viewModel.commandsDisabled || creating;
  const projectActionsDisabled =
    busy || !viewModel.projectCreated;
  const chooseProjectFolder = async () => {
    const picker =
      (window as DirectoryPickerWindow)
        .showDirectoryPicker;
    if (!picker) {
      window.alert(
        "이 브라우저는 폴더 프로젝트 만들기를 지원하지 않습니다. Chrome 또는 Edge에서 실행해주세요."
      );
      return;
    }
    try {
      const directory = await picker({
        mode: "readwrite",
      });
      const psdFiles =
        await readProjectFolder(directory);
      setPendingProject({ directory, psdFiles });
    } catch (error) {
      if (
        !(error instanceof DOMException) ||
        error.name !== "AbortError"
      ) {
        window.alert(
          "선택한 폴더를 읽을 수 없습니다. 폴더 접근 권한을 확인해주세요."
        );
      }
    }
  };

  return (
    <>
      <header className="project-lifecycle-bar">
        <div className="project-lifecycle-bar__commands">
          <span className="project-lifecycle-bar__brand">
            움직
          </span>
          <button
            className="ui-button"
            disabled={busy}
            onClick={() => void chooseProjectFolder()}
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
            className="ui-button"
            disabled={projectActionsDisabled}
            onClick={() => void commands.saveProject()}
          >
            저장
          </button>
          <button
            className="ui-button"
            disabled={projectActionsDisabled}
            onClick={() => void commands.saveProjectAs()}
          >
            다른 이름으로 저장
          </button>
          <button
            className="ui-button"
            disabled={projectActionsDisabled}
            onClick={() => void commands.closeProject()}
          >
            닫기
          </button>
          <span className="project-lifecycle-bar__separator" aria-hidden="true" />
          <button
            className="ui-button"
            disabled={busy}
            onClick={() => {
              setExportOpen(true);
              window.setTimeout(() => {
                exportOptions.prepare();
              }, 0);
            }}
          >
            출력
          </button>
        </div>
        <div className="project-lifecycle-bar__status">
          {viewModel.notice && (
            <span
              className={`project-lifecycle-notice project-lifecycle-notice--${viewModel.notice.tone}`}
              title={`${viewModel.notice.code}: ${viewModel.notice.message}`}
            >
              {viewModel.notice.message}
            </span>
          )}
          {viewModel.projectLocation && (
            <span
              className="project-lifecycle-location"
              title={viewModel.projectLocation}
            >
              {viewModel.projectLocation}
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
      {pendingProject && (
        <NewProjectDialog
          pending={pendingProject}
          busy={creating}
          onCancel={() => setPendingProject(null)}
          onCreate={(request) => {
            const selected = pendingProject;
            setPendingProject(null);
            setCreating(true);
            void commands.newProject(request)
              .then((created) => {
                if (!created) {
                  setPendingProject(selected);
                }
              })
              .finally(() => setCreating(false));
          }}
        />
      )}
      {exportOpen && (
        <ProjectExportDialog
          projectName={exportOptions.projectName}
          durationFrames={exportOptions.durationFrames}
          frameRate={exportOptions.frameRate}
          onCancel={() => setExportOpen(false)}
          onExport={exportOptions.run}
        />
      )}
    </>
  );
}
