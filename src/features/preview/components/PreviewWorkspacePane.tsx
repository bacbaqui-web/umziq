import type { RefObject, WheelEvent, MouseEvent } from "react";
import PreviewInteractionOverlay from "@/features/preview/components/PreviewInteractionOverlay";
import PreviewViewportLayers from "@/features/preview/components/PreviewViewportLayers";
import PreviewWorkspaceControls from "@/features/preview/components/PreviewWorkspaceControls";
import type { Composition, CompositionMeta, Position } from "@/models";
import type {
  CanvasGuideViewModel,
  CanvasGizmoViewModel,
  CanvasInteractionCommands,
} from "@/engines/canvas";

type PreviewWorkspacePaneProps = {
  selectedComp: Composition | null;
  selectedMeta: CompositionMeta | null;
  previewWorkspaceRef: RefObject<HTMLDivElement | null>;
  previewViewportRef: RefObject<HTMLDivElement | null>;
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  previewBaseOffset: Position;
  previewPan: Position;
  previewZoom: number;
  previewZoomPercent: number;
  previewSize: {
    width: number;
    height: number;
  };
  previewViewportWidth: number;
  previewViewportHeight: number;
  guide: CanvasGuideViewModel;
  toggleShortformFrame: () => void;
  toggleSafeZone: () => void;
  resetPreviewView: () => void;
  setOneToOnePreviewView: () => void;
  centerPreviewView: () => void;
  handlePreviewViewportWheel: (event: WheelEvent<HTMLDivElement>) => void;
  handlePreviewViewportMouseDownCapture: (event: MouseEvent<HTMLDivElement>) => void;
  isPreviewPanning: boolean;
  isPreviewPanModifierActive: boolean;
  interactionViewModel: CanvasGizmoViewModel;
  interactionCommands: CanvasInteractionCommands;
};

export default function PreviewWorkspacePane({
  selectedComp,
  selectedMeta,
  previewWorkspaceRef,
  previewViewportRef,
  previewCanvasRef,
  previewOverlayRef,
  previewBaseOffset,
  previewPan,
  previewZoom,
  previewZoomPercent,
  previewSize,
  previewViewportWidth,
  previewViewportHeight,
  guide,
  toggleShortformFrame,
  toggleSafeZone,
  resetPreviewView,
  setOneToOnePreviewView,
  centerPreviewView,
  handlePreviewViewportWheel,
  handlePreviewViewportMouseDownCapture,
  isPreviewPanning,
  isPreviewPanModifierActive,
  interactionViewModel,
  interactionCommands,
}: PreviewWorkspacePaneProps) {
  return (
    <div
      style={{
        gridColumn: "3",
        gridRow: "1",
        position: "relative",
        minWidth: 0,
        minHeight: 0,
        background:
          "radial-gradient(circle at top, rgba(34,40,46,0.82) 0%, rgba(20,24,28,0.96) 42%, rgba(14,16,18,1) 100%)",
      }}
    >
      <div
        ref={previewWorkspaceRef}
        style={{
          position: "absolute",
          inset: 0,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {selectedComp && selectedMeta ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#171a1d",
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.035) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.035) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.035) 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              overflow: "hidden",
              cursor: isPreviewPanning
                ? "grabbing"
                : isPreviewPanModifierActive
                  ? "grab"
                  : "default",
            }}
            ref={previewViewportRef}
            onWheel={handlePreviewViewportWheel}
            onMouseDownCapture={handlePreviewViewportMouseDownCapture}
          >
            <PreviewWorkspaceControls
              previewZoomPercent={previewZoomPercent}
              showShortformFrameOverlay={guide.showShortformFrame}
              toggleShortformFrame={toggleShortformFrame}
              showSafeZoneGuides={guide.showSafeZoneGuides}
              toggleSafeZone={toggleSafeZone}
              resetPreviewView={resetPreviewView}
              setOneToOnePreviewView={setOneToOnePreviewView}
              centerPreviewView={centerPreviewView}
            />
            <PreviewViewportLayers
              previewCanvasRef={previewCanvasRef}
              previewBaseOffset={previewBaseOffset}
              previewPan={previewPan}
              previewZoom={previewZoom}
              previewSize={previewSize}
              guide={guide}
            />
            <PreviewInteractionOverlay
              previewOverlayRef={previewOverlayRef}
              previewViewportWidth={previewViewportWidth}
              previewViewportHeight={previewViewportHeight}
              viewModel={interactionViewModel}
              commands={interactionCommands}
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#7f8a95",
              fontSize: 14,
              letterSpacing: 0.2,
            }}
          >
            Preview
          </div>
        )}
      </div>
    </div>
  );
}
