import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  menuExportExtension,
  type MenuExportFormat,
} from "@/engines/menu/models/menuExportModel";
import type {
  ProjectLifecycleExportDialogViewProps,
} from "@/engines/menu/models/projectLifecyclePresentationModel";

export type ProjectExportDialogProps =
  ProjectLifecycleExportDialogViewProps;

export function ProjectExportDialog({
  projectName,
  durationFrames,
  frameRate,
  state,
  commands,
}: ProjectExportDialogProps) {
  const [format, setFormat] = useState<MenuExportFormat>("mp4");
  const [showOtherFormats, setShowOtherFormats] = useState(false);
  const { progress, error, destination, busy } = state;
  const videoExtension = menuExportExtension(format);
  const formatSupported = commands.isFormatSupported(format);
  const seconds = durationFrames / Math.max(1, frameRate);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) commands.cancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, commands]);

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
            <button className="ui-button" type="button" disabled={busy} onClick={() => void commands.chooseDestination()}>
              위치 선택
            </button>
          </div>
          <label className={`project-export-option ${format === "mp4" ? "project-export-option--selected" : ""}`}>
            <input type="radio" name="export-format" checked={format === "mp4"} disabled={busy || !commands.isFormatSupported("mp4")} onChange={() => setFormat("mp4")} />
            <span>
              <strong>일반 영상 MP4</strong>
              <small>유튜브·인스타그램 등 SNS 게시용입니다. 소리가 함께 저장되고 투명 영역은 흰색 배경으로 출력됩니다.</small>
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
            <input type="radio" name="export-format" checked={format === "webm-alpha"} disabled={busy || !commands.isFormatSupported("webm-alpha")} onChange={() => setFormat("webm-alpha")} />
            <span>
              <strong>투명 배경 영상 WebM</strong>
              <small>배경이 투명하고 소리가 포함된 영상입니다. 다른 영상이나 이미지 위에 자연스럽게 겹쳐 사용할 수 있습니다.</small>
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
          <button className="ui-button" type="button" onClick={commands.cancel}>{busy ? "출력 취소" : "취소"}</button>
          <button className="ui-button ui-button--primary" type="button" disabled={busy || !formatSupported} onClick={() => void commands.run(format)}>
            {busy ? "출력 중" : "출력하기"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
