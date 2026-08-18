import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  ProjectLifecycleUiCommandPort,
  ProjectLifecycleUiViewModel,
} from "@/editor/projectLifecycleUi";
import { ProjectExportDialog } from "@/editor/ProjectExportDialog";
import type {
  ProjectExportDestination,
  ProjectExportFormat,
  ProjectExportProgress,
} from "@/editor/projectExport";
import {
  queueProjectOpenSelection,
  setProjectAssetDirectory,
  type ProjectAssetDirectoryHandle,
} from "@/editor/projectAssetDirectoryRuntime";

type ProjectDirectoryHandle = ProjectAssetDirectoryHandle & {
  readonly name: string;
  values(): AsyncIterable<{
    readonly kind: "file" | "directory";
    readonly name: string;
    getFile?: () => Promise<File>;
  }>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options: {
    readonly mode: "readwrite";
  }) => Promise<ProjectDirectoryHandle>;
};

type PendingProject = {
  readonly parentDirectory:
    ProjectDirectoryHandle | null;
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

async function readProjectFileFromFolder(
  directory: ProjectDirectoryHandle
) {
  const projectFiles: File[] = [];
  for await (const entry of directory.values()) {
    if (
      entry.kind === "file" &&
      /\.ziq$/i.test(entry.name) &&
      entry.getFile
    ) {
      projectFiles.push(await entry.getFile());
    }
  }
  if (projectFiles.length !== 1) {
    return {
      file: null,
      count: projectFiles.length,
    } as const;
  }
  const file = projectFiles[0];
  const handle = await directory.getFileHandle(
    file.name,
    { create: false }
  );
  return {
    file,
    count: 1,
    selection: {
      file,
      bytes: new Uint8Array(
        await file.arrayBuffer()
      ),
      handle,
    },
  } as const;
}

function NewProjectDialog({
  pending,
  busy,
  onCancel,
  onChooseLocation,
  onCreate,
}: {
  readonly pending: PendingProject;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onChooseLocation: () => void;
  readonly onCreate: (options: {
    readonly projectName: string;
    readonly parentDirectory:
      ProjectDirectoryHandle;
  }) => void;
}) {
  const [name, setName] = useState("");
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
          if (
            !projectName ||
            !pending.parentDirectory ||
            busy
          ) return;
          onCreate({
            projectName,
            parentDirectory:
              pending.parentDirectory,
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
          <section className="new-project-dialog__location">
            <div>
              <strong>프로젝트 저장 위치</strong>
              <span>
                {pending.parentDirectory
                  ? `${pending.parentDirectory.name}/${projectName || "프로젝트 이름"}`
                  : "프로젝트를 보관할 상위 폴더를 선택해주세요."}
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
              !pending.parentDirectory
            }
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
  const saveAsDisabled =
    busy || !viewModel.projectCreated;
  const chooseNewProjectLocation = async () => {
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
      setPendingProject({
        parentDirectory: directory,
      });
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
  const createProjectFolder = async ({
    projectName,
    parentDirectory,
  }: {
    readonly projectName: string;
    readonly parentDirectory:
      ProjectDirectoryHandle;
  }) => {
    setCreating(true);
    try {
      const directory =
        await parentDirectory.getDirectoryHandle(
          projectName,
          { create: true }
        ) as ProjectDirectoryHandle;
      const existingProject =
        await readProjectFileFromFolder(directory);
      if (existingProject.count > 0) {
        window.alert(
          "같은 이름의 프로젝트 폴더에 이미 .ziq 파일이 있습니다. 다른 프로젝트 이름을 사용해주세요."
        );
        return;
      }
      await directory.getDirectoryHandle("psd", {
        create: true,
      });
      await directory.getDirectoryHandle("audio", {
        create: true,
      });
      setProjectAssetDirectory(directory);
      const fileName = `${projectName}.ziq`;
      const request = {
        projectName,
        directoryName: directory.name,
        psdFiles: [],
        target: {
          kind: "native-file-system" as const,
          fileName,
          handle: {
            name: fileName,
            createWritable: async () => {
              const handle =
                await directory.getFileHandle(
                  fileName,
                  { create: true }
                );
              return handle.createWritable();
            },
          },
        },
      };
      const created = await commands.newProject(request);
      if (created) {
        setPendingProject(null);
      }
    } catch (error) {
      if (
        !(error instanceof DOMException) ||
        error.name !== "AbortError"
      ) {
        window.alert(
          "프로젝트 폴더를 만들 수 없습니다. 폴더 접근 권한을 확인해주세요."
        );
      }
    } finally {
      setCreating(false);
    }
  };
  const openProjectFolder = async () => {
    const picker =
      (window as DirectoryPickerWindow)
        .showDirectoryPicker;
    if (!picker) {
      setProjectAssetDirectory(null);
      await commands.openProject();
      return;
    }
    try {
      const directory = await picker({
        mode: "readwrite",
      });
      const projectFile =
        await readProjectFileFromFolder(directory);
      if (!projectFile.file) {
        window.alert(
          projectFile.count === 0
            ? "선택한 폴더에 .ziq 프로젝트 파일이 없습니다."
            : "선택한 폴더에 .ziq 프로젝트 파일이 여러 개 있습니다. 프로젝트별로 폴더를 나누거나 열 파일을 하나만 남겨주세요."
        );
        return;
      }
      setProjectAssetDirectory(directory);
      const clearQueuedSelection =
        queueProjectOpenSelection(
          projectFile.selection
        );
      try {
        await commands.openProject();
      } finally {
        clearQueuedSelection();
      }
    } catch (error) {
      if (
        !(error instanceof DOMException) ||
        error.name !== "AbortError"
      ) {
        window.alert(
          "프로젝트 폴더를 열 수 없습니다. 폴더 접근 권한을 확인해주세요."
        );
      }
    }
  };

  return (
    <>
      {!viewModel.projectCreated && createPortal(
        <div className="project-start-screen">
          <div className="project-start-screen__card preview-dialog-surface">
            <div className="project-start-screen__actions">
              <button
                className="project-start-screen__action"
                disabled={busy}
                onClick={() => setPendingProject({
                  parentDirectory: null,
                })}
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
                onClick={() => void openProjectFolder()}
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
      )}
      <header className="project-lifecycle-bar">
        <div className="project-lifecycle-bar__commands">
          <span className="project-lifecycle-bar__brand">
            움직
          </span>
          <button
            className="ui-button"
            disabled={busy}
            onClick={() => setPendingProject({
              parentDirectory: null,
            })}
          >
            새 프로젝트
          </button>
          <button
            className="ui-button"
            disabled={busy}
            onClick={() => void openProjectFolder()}
          >
            열기
          </button>
          <button
            className="ui-button"
            disabled={busy}
            onClick={() => void commands.saveProject()}
          >
            저장
          </button>
          <button
            className="ui-button"
            disabled={saveAsDisabled}
            onClick={() => void commands.saveProjectAs()}
          >
            다른 이름으로 저장
          </button>
          <button
            className="ui-button"
            disabled={busy}
            onClick={() => {
              void commands.closeProject().then(() => {
                if (commands.read().document === "untitled") {
                  setProjectAssetDirectory(null);
                }
              });
            }}
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
      {pendingProject && createPortal(
        <NewProjectDialog
          pending={pendingProject}
          busy={creating}
          onCancel={() => setPendingProject(null)}
          onChooseLocation={() =>
            void chooseNewProjectLocation()
          }
          onCreate={(options) =>
            void createProjectFolder(options)
          }
        />,
        document.body
      )}
      {exportOpen && createPortal(
        <ProjectExportDialog
          projectName={exportOptions.projectName}
          durationFrames={exportOptions.durationFrames}
          frameRate={exportOptions.frameRate}
          onCancel={() => setExportOpen(false)}
          onExport={exportOptions.run}
        />,
        document.body
      )}
    </>
  );
}
