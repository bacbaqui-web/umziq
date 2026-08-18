import { memo, useEffect, useRef, useState } from "react";
import LibraryNode from "@/features/library/components/LibraryNode";
import PsdImportPreviewDialog from "@/features/library/components/PsdImportPreviewDialog";
import PsdRefreshSummaryCard from "@/features/library/components/PsdRefreshSummaryCard";
import type { LibraryViewProps } from "@/engines/library";
import type { LibraryHoverPreviewViewModel } from "@/engines/library";
import LayerCompositionIcon from "@/shared/components/LayerCompositionIcon";
import LayerHoverPreviewCard from "@/shared/components/LayerHoverPreviewCard";
import {
  measureLayerHoverPreview,
  positionLayerHoverPreview,
} from "@/shared/helpers/layerHoverPreviewHelpers";

function LibraryPanel({
  nodes,
  fileInputRef,
  audioFileInputRef,
  draggedMainCompId,
  dropTarget,
  importPlan,
  importPreviewStatus,
  importPreviewError,
  audioRecordingStatus,
  audioRecordingName,
  assetCopyPrompt,
  refreshSummary,
  onImportClick,
  onFileInputChange,
  onAudioImportClick,
  onAudioFileInputChange,
  onStartAudioRecording,
  onStopAudioRecording,
  onCancelAudioRecording,
  onConfirmAudioRecording,
  onResolveAssetCopy,
  onSelectNode,
  onToggleNodeVisibility,
  onToggleNodeLock,
  onToggleNodePlayback,
  onRenameNode,
  onDeleteNode,
  onRefreshMainComp,
  onDeleteMainComp,
  onBeginMainDrag,
  onDragOverMain,
  onDropMain,
  onEndMainDrag,
  onMoveNodeKeyboard,
  onCancelImport,
  onConfirmImport,
  onMoveImportNode,
  onScaleImport,
  onRenameImportNode,
  onRemoveImportNode,
  onDismissRefreshSummary,
}: LibraryViewProps) {
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<{
    preview: LibraryHoverPreviewViewModel;
    x: number;
    y: number;
  } | null>(null);
  const previewTimer = useRef<number | null>(null);
  const pendingPreview = useRef<typeof hoverPreview>(null);
  const clearPreview = () => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    previewTimer.current = null;
    pendingPreview.current = null;
    setHoverPreview(null);
  };
  useEffect(() => () => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
  }, []);
  const movePreview = (
    preview: LibraryHoverPreviewViewModel,
    clientX: number,
    clientY: number
  ) => {
    const cardHeight = preview.kind === "audio"
      ? 154
      : measureLayerHoverPreview({
          hasVisual: preview.status === "ready" && Boolean(preview.surface),
          width: preview.width,
          height: preview.height,
        }).cardHeight;
    const position = positionLayerHoverPreview({ clientX, clientY, cardHeight });
    const next = {
      preview,
      x: position.x,
      y: position.y,
    };
    pendingPreview.current = next;
    if (hoverPreview) {
      setHoverPreview(next);
      return;
    }
    if (previewTimer.current !== null) return;
    previewTimer.current = window.setTimeout(() => {
      previewTimer.current = null;
      setHoverPreview(pendingPreview.current);
    }, 180);
  };
  const nodeHandlers = {
    draggedMainCompId,
    dropTarget,
    onSelectNode,
    onToggleNodeVisibility,
    onToggleNodeLock,
    onToggleNodePlayback,
    onRenameNode,
    onDeleteNode,
    onRefreshMainComp,
    onDeleteMainComp,
    onBeginMainDrag,
    onDragOverMain,
    onDropMain,
    onEndMainDrag,
    onMoveNodeKeyboard,
    onPreviewMove: movePreview,
    onPreviewEnd: clearPreview,
  };
  const projectNode = nodes.find((node) => node.type === "project") ?? null;
  const libraryNodes = nodes.filter((node) => node.type !== "project");

  return (
    <div
      aria-label="라이브러리"
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <PsdImportPreviewDialog
        plan={importPlan}
        status={importPreviewStatus}
        error={importPreviewError}
        onCancel={onCancelImport}
        onConfirm={onConfirmImport}
        onMoveNode={onMoveImportNode}
        onScale={onScaleImport}
        onRenameNode={onRenameImportNode}
        onRemoveNode={onRemoveImportNode}
      />
      {assetCopyPrompt && (
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
                선택한 {assetCopyPrompt.fileCount}개 파일을 프로젝트에 복사할까요?
              </strong>
              <p style={{ margin: 0, color: "#9ba6af", fontSize: 13, lineHeight: 1.6 }}>
                {assetCopyPrompt.kind === "psd" ? "psd" : "audio"} 폴더에 복사하면
                원본 파일을 옮겨도 프로젝트에서 다시 찾기 쉽습니다.
              </p>
            </main>
            <footer className="new-project-dialog__actions">
              <button className="ui-button" type="button" onClick={() => onResolveAssetCopy(false)}>
                원본 위치 유지
              </button>
              <button className="ui-button ui-button--primary" type="button" autoFocus onClick={() => onResolveAssetCopy(true)}>
                프로젝트에 복사
              </button>
            </footer>
          </div>
        </div>
      )}
      {refreshSummary && (
        <PsdRefreshSummaryCard
          summary={refreshSummary}
          onDismiss={onDismissRefreshSummary}
        />
      )}
      {importPreviewStatus === "idle" && importPreviewError && (
        <div role="alert" style={{ color: "#e69a9a", fontSize: 12, padding: "0 8px" }}>
          {importPreviewError}
        </div>
      )}
      {audioRecordingStatus !== "idle" && (
        <div
          role="status"
          style={{
            margin: "0 4px", padding: "10px 11px", border: "1px solid #3d4a43",
            borderRadius: 8, background: "#171d1a", color: "#dce7df", fontSize: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>
            {audioRecordingStatus === "requesting" && "마이크 권한을 확인하고 있습니다…"}
            {audioRecordingStatus === "recording" && "● 녹음 중"}
            {audioRecordingStatus === "preparing" && "녹음을 확인하고 있습니다…"}
            {audioRecordingStatus === "review" && `${audioRecordingName ?? "움직 녹음"}을 추가할까요?`}
          </span>
          {audioRecordingStatus === "recording" && (
            <button type="button" onClick={onStopAudioRecording}>녹음 끝내기</button>
          )}
          {audioRecordingStatus === "review" && (
            <button type="button" onClick={onConfirmAudioRecording}>추가</button>
          )}
          <button type="button" onClick={onCancelAudioRecording}>취소</button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".psd"
        multiple
        style={{ display: "none" }}
        onChange={(event) => {
          if (event.currentTarget.files) {
            onFileInputChange(event.currentTarget.files);
          }
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac"
        multiple
        style={{ display: "none" }}
        onChange={(event) => {
          if (event.currentTarget.files) {
            onAudioFileInputChange(event.currentTarget.files);
          }
          event.currentTarget.value = "";
        }}
      />

      <div style={{ display: "flex", flexDirection: "column" }}>
        {projectNode && (
          <div
            style={{
              height: 44,
              padding: "0 8px 0 9px",
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: projectNode.selected
                ? "1px solid #4b6685"
                : "1px solid #343d45",
              borderRadius: 8,
              background: projectNode.selected
                ? "linear-gradient(90deg, rgba(47, 79, 127, 0.9), rgba(42, 64, 91, 0.62))"
                : "linear-gradient(145deg, #23292f 0%, #1b2025 100%)",
              boxShadow: projectNode.selected
                ? "0 5px 16px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(111, 157, 204, 0.13)"
                : "0 4px 14px rgba(0, 0, 0, 0.18)",
            }}
          >
            <button
              type="button"
              onClick={() => onSelectNode(projectNode.id)}
              style={{
                minWidth: 0,
                flex: 1,
                alignSelf: "stretch",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: 0,
                background: "transparent",
                color: "#f3f5f7",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8eb6d8",
                  flex: "0 0 auto",
                }}
              >
                <LayerCompositionIcon kind="composition" size={18} />
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: 15,
                  lineHeight: 1,
                  fontWeight: 750,
                  letterSpacing: -0.2,
                }}
              >
                프로젝트
              </span>
            </button>

            <button
              type="button"
              onClick={onImportClick}
              style={{
                height: 27,
                padding: "0 8px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "1px solid #4f7198",
                borderRadius: 6,
                background: "rgba(48, 85, 126, 0.48)",
                color: "#bcd9f2",
                cursor: "pointer",
                fontSize: 11.5,
                fontWeight: 650,
                whiteSpace: "nowrap",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
                <path d="M6 1.5v9M1.5 6h9" />
              </svg>
              PSD
            </button>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={audioMenuOpen}
                onClick={() => setAudioMenuOpen((open) => !open)}
                style={{
                  height: 27, padding: "0 8px", border: "1px solid #48765a",
                  borderRadius: 6, background: "rgba(40, 91, 61, 0.42)",
                  color: "#a9e1ba", cursor: "pointer", fontSize: 11.5,
                  fontWeight: 650, whiteSpace: "nowrap",
                }}
              >
                + 오디오
              </button>
              {audioMenuOpen && (
                <div role="menu" style={{
                  position: "absolute", zIndex: 20, top: 31, right: 0, width: 130,
                  padding: 4, border: "1px solid #46515b", borderRadius: 7,
                  background: "#1b2126", boxShadow: "0 8px 20px rgba(0,0,0,.4)",
                }}>
                  <button type="button" role="menuitem" onClick={() => {
                    setAudioMenuOpen(false);
                    onAudioImportClick();
                  }} style={{ width: "100%", padding: "7px 8px", textAlign: "left" }}>
                    파일 불러오기
                  </button>
                  <button type="button" role="menuitem" onClick={() => {
                    setAudioMenuOpen(false);
                    onStartAudioRecording();
                  }} style={{ width: "100%", padding: "7px 8px", textAlign: "left" }}>
                    직접 녹음
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            position: "relative",
            marginLeft: 18,
            paddingTop: 7,
          }}
        >
        {libraryNodes.length === 0 && (
          <div
            className="psd-empty-state"
            style={{ marginLeft: 10 }}
          >
            아직 불러온 PSD가 없습니다.
          </div>
        )}

        {libraryNodes.map((node, index) => (
          <div
            key={node.id}
            style={{
              position: "relative",
              paddingLeft: 10,
              paddingBottom: index === libraryNodes.length - 1 ? 0 : 6,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: index === 0 ? -20 : -7,
                height: index === libraryNodes.length - 1
                  ? index === 0 ? 38 : 25
                  : index === 0 ? "calc(100% + 20px)" : "calc(100% + 7px)",
                borderLeft: "1px solid rgba(142, 182, 216, 0.82)",
                transform: "translateX(-0.5px)",
              }}
            />
            {!(node.contentKind === "audio" && node.type !== "main") && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 18,
                  width: 13,
                  borderTop: "1px solid rgba(142, 182, 216, 0.82)",
                  transform: "translateY(-0.5px)",
                }}
              />
            )}
          <LibraryNode
            node={node}
            isFirstRoot={index === 0}
            isLastSibling={index === libraryNodes.length - 1}
            projectRootChild
            {...nodeHandlers}
          />
          </div>
        ))}
        </div>
      </div>
      {hoverPreview && (
        hoverPreview.preview.kind === "visual" ? (
          <LayerHoverPreviewCard
            name={hoverPreview.preview.name}
            width={hoverPreview.preview.width}
            height={hoverPreview.preview.height}
            surface={hoverPreview.preview.surface}
            status={hoverPreview.preview.status === "ready" ? "ready" : "empty"}
            x={hoverPreview.x}
            y={hoverPreview.y}
          />
        ) : (
          <LibraryAudioHoverPreviewCard
            preview={hoverPreview.preview}
            x={hoverPreview.x}
            y={hoverPreview.y}
          />
        )
      )}
    </div>
  );
}

function LibraryAudioHoverPreviewCard({
  preview,
  x,
  y,
}: {
  preview: Extract<LibraryHoverPreviewViewModel, { kind: "audio" }>;
  x: number;
  y: number;
}) {
  const statusText = preview.status === "missing"
    ? "원본 파일을 찾을 수 없습니다"
    : preview.status === "empty" ? "파형이 없는 오디오" : null;
  return (
    <div aria-hidden="true" style={{
      position: "fixed", zIndex: 1100, left: x, top: y, width: 220,
      pointerEvents: "none", overflow: "hidden", border: "1px solid #50677b",
      borderRadius: 8, background: "#11161a", boxShadow: "0 14px 34px rgba(0,0,0,.58)",
    }}>
      <div style={{ padding: "5px 7px", display: "flex", gap: 8, justifyContent: "space-between", color: "#dce8f2", fontSize: 11 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.name}</span>
        <span style={{ flex: "0 0 auto", color: "#8798a6", fontVariantNumeric: "tabular-nums" }}>
          {preview.durationSeconds !== null ? `${preview.durationSeconds.toFixed(1)}초` : ""}
        </span>
      </div>
      <div style={{
        minHeight: 112, padding: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "#142019",
        backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
      }}>
        {statusText ? (
          <span style={{ color: preview.status === "missing" ? "#d99a9a" : "#aebbc6", fontSize: 12, fontWeight: 650 }}>{statusText}</span>
        ) : (
          <svg width="204" height="92" viewBox="0 0 204 92" role="img" aria-label="오디오 파형">
            <line x1="0" y1="46" x2="204" y2="46" stroke="rgba(101,201,138,.28)" />
            {preview.waveform.map((peak, index) => {
              const xValue = (index / Math.max(1, preview.waveform.length - 1)) * 204;
              const height = Math.max(1, Math.min(42, Math.abs(peak) * 42));
              return <line key={index} x1={xValue} y1={46 - height} x2={xValue} y2={46 + height} stroke="#65c98a" strokeWidth="1.3" />;
            })}
          </svg>
        )}
      </div>
      {preview.status === "ready" && (
        <div style={{ padding: "4px 7px 6px", color: "#789184", fontSize: 10.5 }}>
          {preview.channelCount ? `${preview.channelCount}채널` : "채널 정보 없음"}
          {preview.sampleRate ? ` · ${(preview.sampleRate / 1000).toFixed(1)}kHz` : ""}
        </div>
      )}
    </div>
  );
}

export default memo(LibraryPanel);
