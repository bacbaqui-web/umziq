import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  isProjectExportFormatSupported,
  projectVideoExtension,
  type ProjectExportDestination,
  type ProjectExportFormat,
  type ProjectExportProgress,
} from "@/editor/projectExport";

export type ProjectExportDialogProps = {
  readonly projectName: string;
  readonly durationFrames: number;
  readonly frameRate: number;
  readonly onCancel: () => void;
  readonly onExport: (
    format: ProjectExportFormat,
    destination: ProjectExportDestination | null,
    onProgress: (progress: ProjectExportProgress) => void
  ) => Promise<void>;
};

type ExportDirectoryHandle = {
  readonly name: string;
  getFileHandle: (
    name: string,
    options: { readonly create: true }
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

type ExportPickerWindow = Window & {
  showDirectoryPicker?: (options: {
    readonly mode: "readwrite";
  }) => Promise<ExportDirectoryHandle>;
};

export function ProjectExportDialog({
  projectName,
  durationFrames,
  frameRate,
  onCancel,
  onExport,
}: ProjectExportDialogProps) {
  const [progress, setProgress] = useState<ProjectExportProgress | null>(null);
  const [format, setFormat] = useState<ProjectExportFormat>("mp4");
  const [showOtherFormats, setShowOtherFormats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] =
    useState<ProjectExportDestination | null>(null);
  const busy = progress !== null;
  const videoExtension = projectVideoExtension(format);
  const formatSupported = isProjectExportFormatSupported(format);
  const seconds = durationFrames / Math.max(1, frameRate);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  const runExport = async () => {
    setError(null);
    setProgress({ completedFrames: 0, totalFrames: durationFrames });
    try {
      await onExport(format, destination, setProgress);
      onCancel();
    } catch (reason) {
      setProgress(null);
      setError(reason instanceof Error ? reason.message : "출력에 실패했습니다.");
    }
  };
  const chooseDestination = async () => {
    const picker = (window as ExportPickerWindow).showDirectoryPicker;
    if (!picker) {
      setError("이 브라우저에서는 출력 폴더를 직접 선택할 수 없습니다.");
      return;
    }
    try {
      const directory = await picker({ mode: "readwrite" });
      setDestination({
        name: directory.name,
        write: async (fileName, blob) => {
          const handle = await directory.getFileHandle(fileName, { create: true });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        },
      });
      setError(null);
    } catch (reason) {
      if (!(reason instanceof DOMException) || reason.name !== "AbortError") {
        setError("출력 폴더를 선택할 수 없습니다.");
      }
    }
  };
  const percent = progress
    ? Math.round((progress.completedFrames / Math.max(1, progress.totalFrames)) * 100)
    : 0;
  const outputName = `${projectName.trim().replace(/[<>:"/\\|?*]/g, "-") || "umziq"}.${videoExtension ?? "mp4"}`;
  const summaryFrameRate = format === "gif"
    ? Math.min(30, frameRate)
    : format === "webp"
      ? Math.min(30, frameRate)
      : frameRate;

  return createPortal(
    <div className="new-project-dialog-backdrop" role="dialog" aria-modal="true" aria-label="프로젝트 출력">
      <div className="new-project-dialog preview-dialog-surface project-export-dialog">
        <header className="new-project-dialog__header">
          <strong>출력</strong>
        </header>
        <main className="new-project-dialog__body project-export-dialog__body">
          <div className="project-export-dialog__summary">
            <span>1080 × 1920</span>
            <span>{summaryFrameRate} fps</span>
            <span>{seconds.toFixed(1)}초</span>
          </div>
          <div className="project-export-destination">
            <div>
              <strong>저장 위치</strong>
              <span title={`${destination?.name ?? "기본 다운로드 폴더"}/${outputName}`}>
                {destination?.name ?? "기본 다운로드 폴더"}/{outputName}
              </span>
            </div>
            <button className="ui-button" type="button" disabled={busy} onClick={() => void chooseDestination()}>
              위치 선택
            </button>
          </div>
          <label className={`project-export-option ${format === "mp4" ? "project-export-option--selected" : ""}`}>
            <input type="radio" name="export-format" checked={format === "mp4"} disabled={busy || !isProjectExportFormatSupported("mp4")} onChange={() => setFormat("mp4")} />
            <span>
              <strong>일반 영상 MP4</strong>
              <small>유튜브·인스타그램 등 SNS 게시용입니다. 투명 영역은 흰색 배경으로 출력됩니다.</small>
            </span>
          </label>
          <button
            className="project-export-formats-toggle"
            type="button"
            aria-expanded={showOtherFormats}
            disabled={busy}
            onClick={() => setShowOtherFormats((value) => !value)}
          >
            <span>다른 출력 형식</span>
            <svg
              className={showOtherFormats ? "project-export-formats-toggle__icon project-export-formats-toggle__icon--open" : "project-export-formats-toggle__icon"}
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m3 5 4 4 4-4" />
            </svg>
          </button>
          {(showOtherFormats || format === "webm-alpha") && <label className={`project-export-option ${format === "webm-alpha" ? "project-export-option--selected" : ""}`}>
            <input type="radio" name="export-format" checked={format === "webm-alpha"} disabled={busy || !isProjectExportFormatSupported("webm-alpha")} onChange={() => setFormat("webm-alpha")} />
            <span>
              <strong>투명 배경 영상 WebM</strong>
              <small>배경이 투명한 영상으로 저장됩니다. 다른 영상이나 이미지 위에 자연스럽게 겹쳐 사용할 수 있습니다.</small>
            </span>
          </label>}
          {(showOtherFormats || format === "gif") && <label className={`project-export-option ${format === "gif" ? "project-export-option--selected" : ""}`}>
            <input type="radio" name="export-format" checked={format === "gif"} disabled={busy} onChange={() => setFormat("gif")} />
            <span>
              <strong>움직이는 이미지 GIF</strong>
              <small>최대 256색으로 표현되어 색 변화가 많은 장면은 다소 거칠게 보일 수 있습니다. 소리는 포함되지 않습니다.</small>
            </span>
          </label>}
          {(showOtherFormats || format === "webp") && <label className={`project-export-option ${format === "webp" ? "project-export-option--selected" : ""}`}>
            <input type="radio" name="export-format" checked={format === "webp"} disabled={busy} onChange={() => setFormat("webp")} />
            <span>
              <strong>움직이는 이미지 WebP</strong>
              <small>GIF보다 색과 투명한 가장자리가 자연스럽습니다. 소리는 없으며 일부 메신저나 게시판에서는 움직이지 않을 수 있습니다.</small>
            </span>
          </label>}
          {busy && (
            <div className="project-export-progress">
              <div><span>출력 중</span><span>{percent}%</span></div>
              <progress max={100} value={percent} />
            </div>
          )}
          {error && <p className="project-export-error">{error}</p>}
        </main>
        <footer className="new-project-dialog__actions">
          <button className="ui-button" type="button" disabled={busy} onClick={onCancel}>취소</button>
          <button className="ui-button ui-button--primary" type="button" disabled={busy || !formatSupported} onClick={() => void runExport()}>
            {busy ? "출력 중" : "출력하기"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
