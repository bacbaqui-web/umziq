import PreviewQualityControl from "@/features/preview/components/PreviewQualityControl";
import PreviewRendererModeControl from "@/features/preview/components/PreviewRendererModeControl";
import type {
  PreviewQualityControlCommands,
  PreviewQualityControlViewModel,
  RendererMode,
} from "@/engines/canvas";

type PreviewWorkspaceControlsProps = {
  previewZoomPercent: number;
  showShortformFrameOverlay: boolean;
  toggleShortformFrame: () => void;
  showSafeZoneGuides: boolean;
  toggleSafeZone: () => void;
  showSelectionGlow: boolean;
  toggleSelectionGlow: () => void;
  resetPreviewView: () => void;
  setOneToOnePreviewView: () => void;
  centerPreviewView: () => void;
  rendererMode: RendererMode;
  setRendererMode: (mode: RendererMode) => void;
  previewQuality: PreviewQualityControlViewModel;
  previewQualityCommands: PreviewQualityControlCommands;
};

const controlsContainerStyle = {
  position: "absolute",
  top: 12,
  zIndex: 40,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 8px",
} as const;

export default function PreviewWorkspaceControls({
  previewZoomPercent,
  showShortformFrameOverlay,
  toggleShortformFrame,
  showSafeZoneGuides,
  toggleSafeZone,
  showSelectionGlow,
  toggleSelectionGlow,
  resetPreviewView,
  setOneToOnePreviewView,
  centerPreviewView,
  rendererMode,
  setRendererMode,
  previewQuality,
  previewQualityCommands,
}: PreviewWorkspaceControlsProps) {
  return (
    <>
      <div
        className="preview-toolbar"
        style={{
          ...controlsContainerStyle,
          left: 12,
        }}
      >
        <button
          className="ui-button"
          type="button"
          onClick={toggleShortformFrame}
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
          프레임
        </button>
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
          aria-pressed={showSelectionGlow}
          onClick={toggleSelectionGlow}
          style={{
            border: `1px solid ${
              showSelectionGlow
                ? "rgba(255, 202, 112, 0.34)"
                : "rgba(255,255,255,0.1)"
            }`,
            background: showSelectionGlow
              ? "rgba(255, 202, 112, 0.12)"
              : "rgba(255,255,255,0.04)",
          }}
        >
          선택 강조
        </button>
        <span className="preview-toolbar__divider" aria-hidden="true" />
        <PreviewQualityControl
          viewModel={previewQuality}
          commands={previewQualityCommands}
        />
        <span className="preview-toolbar__divider" aria-hidden="true" />
        <PreviewRendererModeControl
          rendererMode={rendererMode}
          setRendererMode={setRendererMode}
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
        <button className="ui-button" type="button" onClick={centerPreviewView}>
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
