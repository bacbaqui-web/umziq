import type { LibraryViewProps } from "@/engines/library";

export default function LibraryAssetCopyDialog({
  prompt,
  onResolve,
}: {
  readonly prompt: NonNullable<LibraryViewProps["assetCopyPrompt"]>;
  readonly onResolve: (copy: boolean) => void;
}) {
  return (
    <div
      className="new-project-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="프로젝트에 파일 복사"
    >
      <div
        className="new-project-dialog preview-dialog-surface"
        style={{ width: "min(520px, calc(100vw - 40px))" }}
      >
        <header className="new-project-dialog__header">
          <strong>프로젝트에 파일 복사</strong>
        </header>
        <main className="new-project-dialog__body" style={{ gap: 10 }}>
          <strong style={{ fontSize: 15, color: "#edf1f4" }}>
            선택한 {prompt.fileCount}개 파일을 프로젝트에 복사할까요?
          </strong>
          <p style={{ margin: 0, color: "#9ba6af", fontSize: 13, lineHeight: 1.6 }}>
            {prompt.kind === "psd" ? "psd" : "audio"} 폴더에 복사하면 원본
            파일을 옮겨도 프로젝트에서 다시 찾기 쉽습니다.
          </p>
        </main>
        <footer className="new-project-dialog__actions">
          <button className="ui-button" type="button" onClick={() => onResolve(false)}>
            원본 위치 유지
          </button>
          <button className="ui-button ui-button--primary" type="button" autoFocus onClick={() => onResolve(true)}>
            프로젝트에 복사
          </button>
        </footer>
      </div>
    </div>
  );
}
