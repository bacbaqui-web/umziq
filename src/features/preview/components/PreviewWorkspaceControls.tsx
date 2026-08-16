import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import PreviewQualityControl from "@/features/preview/components/PreviewQualityControl";
import type {
  PreviewQualityControlCommands,
  PreviewQualityControlViewModel,
} from "@/engines/canvas";

type PreviewWorkspaceControlsProps = {
  previewZoomPercent: number;
  cameraScalePercent: number;
  showShortformFrameOverlay: boolean;
  toggleShortformFrame: () => void;
  showSafeZoneGuides: boolean;
  toggleSafeZone: () => void;
  setCameraScalePercent: (percent: number) => void;
  commitCameraScalePercent: (percent: number) => void;
  frameMenuOpen: boolean;
  setFrameMenuOpen: Dispatch<SetStateAction<boolean>>;
  showSelectionHighlight: boolean;
  toggleSelectionHighlight: () => void;
  showWhiteBackground: boolean;
  toggleWhiteBackground: () => void;
  resetPreviewView: () => void;
  setOneToOnePreviewView: () => void;
  zoomOutPreviewView: () => void;
  zoomInPreviewView: () => void;
  previewQuality: PreviewQualityControlViewModel;
  previewQualityCommands: PreviewQualityControlCommands;
};

const controlsContainerStyle = {
  position: "absolute",
  top: 12,
  zIndex: 90,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 8px",
} as const;

export default function PreviewWorkspaceControls({
  previewZoomPercent,
  cameraScalePercent,
  showShortformFrameOverlay,
  toggleShortformFrame,
  showSafeZoneGuides,
  toggleSafeZone,
  setCameraScalePercent,
  commitCameraScalePercent,
  frameMenuOpen,
  setFrameMenuOpen,
  showSelectionHighlight,
  toggleSelectionHighlight,
  showWhiteBackground,
  toggleWhiteBackground,
  resetPreviewView,
  setOneToOnePreviewView,
  zoomOutPreviewView,
  zoomInPreviewView,
  previewQuality,
  previewQualityCommands,
}: PreviewWorkspaceControlsProps) {
  const frameMenuRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<{
    startY: number;
    startPercent: number;
    value: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!frameMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".preview-camera-control")
      ) return;
      if (!frameMenuRef.current?.contains(event.target as Node)) {
        setFrameMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, [frameMenuOpen, setFrameMenuOpen]);

  const normalizeCameraScale = (value: number) => {
    if (!Number.isFinite(value) || value < 1) return cameraScalePercent;
    const next = Math.min(1000, Math.max(1, Math.round(value * 100) / 100));
    return next;
  };

  return (
    <>
      <div
        className="preview-toolbar"
        style={{
          ...controlsContainerStyle,
          left: 12,
        }}
      >
        <div ref={frameMenuRef} style={{ position: "relative" }}>
          <button
            className="ui-button"
            type="button"
            aria-expanded={frameMenuOpen}
            onClick={() => setFrameMenuOpen((open) => !open)}
            style={{
              border: `1px solid ${
                showShortformFrameOverlay
                  ? "rgba(118, 197, 255, 0.28)"
                  : "rgba(255,255,255,0.1)"
              }`,
              background: showShortformFrameOverlay
                ? "rgba(118, 197, 255, 0.12)"
                : "rgba(255,255,255,0.04)",
            }}
          >
            촬영 범위
            <span aria-hidden="true" style={{ marginLeft: 5, fontSize: 8 }}>▼</span>
          </button>
          {frameMenuOpen && (
            <div
              className="ui-card"
              style={{
                position: "absolute",
                left: 0,
                top: "calc(100% + 6px)",
                width: 148,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                borderRadius: 8,
                boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <button
                  type="button"
                  className="ui-button"
                  aria-pressed={showShortformFrameOverlay}
                  onClick={() => {
                    if (!showShortformFrameOverlay) toggleShortformFrame();
                  }}
                  style={{ background: showShortformFrameOverlay ? "rgba(118, 197, 255, 0.18)" : undefined }}
                >
                  보임
                </button>
                <button
                  type="button"
                  className="ui-button"
                  aria-pressed={!showShortformFrameOverlay}
                  onClick={() => {
                    if (showShortformFrameOverlay) toggleShortformFrame();
                  }}
                  style={{ background: !showShortformFrameOverlay ? "rgba(118, 197, 255, 0.18)" : undefined }}
                >
                  안 보임
                </button>
              </div>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "#aeb9c3", fontSize: 11 }}>
                촬영 범위
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <input
                    className="dimension-input number-input--no-spinner"
                    type="number"
                    min={1}
                    max={1000}
                    value={cameraScalePercent}
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value);
                      if (Number.isFinite(value)) {
                        setCameraScalePercent(normalizeCameraScale(value));
                      }
                    }}
                    onBlur={() => commitCameraScalePercent(cameraScalePercent)}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      scrubRef.current = {
                        startY: event.clientY,
                        startPercent: cameraScalePercent,
                        value: cameraScalePercent,
                        moved: false,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const scrub = scrubRef.current;
                      if (!scrub || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                      const delta = scrub.startY - event.clientY;
                      if (Math.abs(delta) < 2 && !scrub.moved) return;
                      scrub.moved = true;
                      scrub.value = normalizeCameraScale(scrub.startPercent + delta);
                      setCameraScalePercent(scrub.value);
                    }}
                    onPointerUp={(event) => {
                      const scrub = scrubRef.current;
                      if (!scrub) return;
                      event.currentTarget.releasePointerCapture(event.pointerId);
                      scrubRef.current = null;
                      if (scrub.moved) commitCameraScalePercent(scrub.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitCameraScalePercent(cameraScalePercent);
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        event.currentTarget.blur();
                      }
                    }}
                    style={{ width: 48, textAlign: "right", cursor: "ns-resize" }}
                    aria-label="가상 카메라 촬영 범위"
                  />
                  %
                </span>
              </label>
            </div>
          )}
        </div>
        <button
          className="ui-button"
          type="button"
          onClick={toggleSafeZone}
          style={{
            border: `1px solid ${
              showSafeZoneGuides
                ? "rgba(255, 116, 116, 0.34)"
                : "rgba(255,255,255,0.1)"
            }`,
            background: showSafeZoneGuides
              ? "rgba(255, 116, 116, 0.12)"
              : "rgba(255,255,255,0.04)",
          }}
        >
          세이프존
        </button>
        <button
          className="ui-button"
          type="button"
          aria-pressed={showSelectionHighlight}
          onClick={toggleSelectionHighlight}
          style={{
            border: `1px solid ${
              showSelectionHighlight
                ? "rgba(255, 202, 112, 0.34)"
                : "rgba(255,255,255,0.1)"
            }`,
            background: showSelectionHighlight
              ? "rgba(255, 202, 112, 0.12)"
              : "rgba(255,255,255,0.04)",
          }}
        >
          선택 강조
        </button>
        <button
          className="ui-button"
          type="button"
          aria-pressed={showWhiteBackground}
          onClick={toggleWhiteBackground}
          style={{
            border: `1px solid ${
              showWhiteBackground
                ? "rgba(220, 228, 235, 0.48)"
                : "rgba(255,255,255,0.1)"
            }`,
            background: showWhiteBackground
              ? "rgba(255,255,255,0.16)"
              : "rgba(255,255,255,0.04)",
          }}
        >
          배경
        </button>
        <span className="preview-toolbar__divider" aria-hidden="true" />
        <PreviewQualityControl
          viewModel={previewQuality}
          commands={previewQualityCommands}
        />
      </div>

      <div
        className="preview-toolbar"
        style={{
          ...controlsContainerStyle,
          right: 12,
        }}
      >
        <button className="ui-button" type="button" onClick={resetPreviewView}>
          맞춤
        </button>
        <button className="ui-button" type="button" onClick={setOneToOnePreviewView}>
          100%
        </button>
        <button
          className="ui-button"
          type="button"
          aria-label="축소"
          onClick={zoomOutPreviewView}
        >
          −
        </button>
        <div
          style={{
            minWidth: 42,
            textAlign: "center",
            fontSize: 11,
            color: "#c7d0d9",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {previewZoomPercent}%
        </div>
        <button
          className="ui-button"
          type="button"
          aria-label="확대"
          onClick={zoomInPreviewView}
        >
          +
        </button>
      </div>
    </>
  );
}
