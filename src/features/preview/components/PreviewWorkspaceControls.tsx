import type { Dispatch, SetStateAction } from "react";

type PreviewWorkspaceControlsProps = {
  previewZoomPercent: number;
  showShortformFrameOverlay: boolean;
  setShowShortformFrameOverlay: Dispatch<SetStateAction<boolean>>;
  showSafeZoneGuides: boolean;
  setShowSafeZoneGuides: Dispatch<SetStateAction<boolean>>;
  resetPreviewView: () => void;
  setOneToOnePreviewView: () => void;
  centerPreviewView: () => void;
};

const overlayButtonStyle = {
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#eef3f8",
  fontSize: 11,
  cursor: "pointer",
} as const;

const controlsContainerStyle = {
  position: "absolute",
  top: 12,
  zIndex: 40,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 8px",
  borderRadius: 999,
  background: "rgba(14, 18, 24, 0.84)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.2)",
  backdropFilter: "blur(10px)",
} as const;

export default function PreviewWorkspaceControls({
  previewZoomPercent,
  showShortformFrameOverlay,
  setShowShortformFrameOverlay,
  showSafeZoneGuides,
  setShowSafeZoneGuides,
  resetPreviewView,
  setOneToOnePreviewView,
  centerPreviewView,
}: PreviewWorkspaceControlsProps) {
  return (
    <>
      <div
        style={{
          ...controlsContainerStyle,
          left: 12,
        }}
      >
        <button
          type="button"
          onClick={() => setShowShortformFrameOverlay((prev) => !prev)}
          style={{
            ...overlayButtonStyle,
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
          프레임
        </button>
        <button
          type="button"
          onClick={() => setShowSafeZoneGuides((prev) => !prev)}
          style={{
            ...overlayButtonStyle,
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
      </div>

      <div
        style={{
          ...controlsContainerStyle,
          right: 12,
        }}
      >
        <button type="button" onClick={resetPreviewView} style={overlayButtonStyle}>
          맞춤
        </button>
        <button type="button" onClick={setOneToOnePreviewView} style={overlayButtonStyle}>
          100%
        </button>
        <button type="button" onClick={centerPreviewView} style={overlayButtonStyle}>
          리셋
        </button>
        <div
          style={{
            minWidth: 48,
            textAlign: "right",
            fontSize: 11,
            color: "#c7d0d9",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {previewZoomPercent}%
        </div>
      </div>
    </>
  );
}
