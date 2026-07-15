import type { Dispatch, RefObject, SetStateAction, WheelEvent, MouseEvent } from "react";
import PreviewInteractionOverlay from "@/features/preview/components/PreviewInteractionOverlay";
import PreviewViewportLayers from "@/features/preview/components/PreviewViewportLayers";
import PreviewWorkspaceControls from "@/features/preview/components/PreviewWorkspaceControls";
import type { Composition, CompositionMeta, Position, Scale } from "@/editor/types/types";
import type {
  PreviewMotionPathPoint,
  PreviewOverlay as PreviewOverlayData,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";
import type { PreviewGuideGeometry } from "@/editor/preview/guideGeometry";

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
  previewViewportOffset: Position;
  previewViewportWidth: number;
  previewViewportHeight: number;
  guideGeometry: PreviewGuideGeometry;
  showShortformFrameOverlay: boolean;
  setShowShortformFrameOverlay: Dispatch<SetStateAction<boolean>>;
  showSafeZoneGuides: boolean;
  setShowSafeZoneGuides: Dispatch<SetStateAction<boolean>>;
  resetPreviewView: () => void;
  setOneToOnePreviewView: () => void;
  centerPreviewView: () => void;
  handlePreviewViewportWheel: (event: WheelEvent<HTMLDivElement>) => void;
  handlePreviewViewportMouseDownCapture: (event: MouseEvent<HTMLDivElement>) => void;
  isPreviewPanning: boolean;
  isPreviewPanModifierActive: boolean;
  overlay: PreviewOverlayData;
  motionPath: PreviewMotionPathPoint[];
  currentOpacity: number;
  currentRotation: number;
  currentScale: Scale;
  isDraggingAnchor: boolean;
  isDraggingPosition: boolean;
  isDraggingOpacity: boolean;
  isDraggingRotation: boolean;
  positionReadout: string | null;
  opacityReadout: string | null;
  rotationReadout: string | null;
  scaleReadout: {
    handle: ScaleHandleDirection;
    text: string;
  } | null;
  onStartScaleDrag: (handle: ScaleHandleDirection) => void;
  onStartMoveDrag: (clientX: number, clientY: number) => void;
  onStartOpacityDrag: () => void;
  onStartRotationDrag: (clientX: number, clientY: number) => void;
  onTargetMouseDown: (event: MouseEvent<SVGPolygonElement>) => void;
  onAnchorMouseDown: (event: MouseEvent<HTMLDivElement>) => void;
  onMotionPathDotClick: (frame: number, isKeyframe: boolean) => void;
  onStartMotionPathKeyframeDrag: (frame: number, clientX: number, clientY: number) => void;
  draggingMotionPathFrame: number | null;
  motionPathDragReadout: string | null;
  onCommitScaleInput: (handle: ScaleHandleDirection, value: number) => void;
  onCommitRotationInput: (value: number) => void;
  onCommitOpacityInput: (value: number) => void;
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
  previewViewportOffset,
  previewViewportWidth,
  previewViewportHeight,
  guideGeometry,
  showShortformFrameOverlay,
  setShowShortformFrameOverlay,
  showSafeZoneGuides,
  setShowSafeZoneGuides,
  resetPreviewView,
  setOneToOnePreviewView,
  centerPreviewView,
  handlePreviewViewportWheel,
  handlePreviewViewportMouseDownCapture,
  isPreviewPanning,
  isPreviewPanModifierActive,
  overlay,
  motionPath,
  currentOpacity,
  currentRotation,
  currentScale,
  isDraggingAnchor,
  isDraggingPosition,
  isDraggingOpacity,
  isDraggingRotation,
  positionReadout,
  opacityReadout,
  rotationReadout,
  scaleReadout,
  onStartScaleDrag,
  onStartMoveDrag,
  onStartOpacityDrag,
  onStartRotationDrag,
  onTargetMouseDown,
  onAnchorMouseDown,
  onMotionPathDotClick,
  onStartMotionPathKeyframeDrag,
  draggingMotionPathFrame,
  motionPathDragReadout,
  onCommitScaleInput,
  onCommitRotationInput,
  onCommitOpacityInput,
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
              showShortformFrameOverlay={showShortformFrameOverlay}
              setShowShortformFrameOverlay={setShowShortformFrameOverlay}
              showSafeZoneGuides={showSafeZoneGuides}
              setShowSafeZoneGuides={setShowSafeZoneGuides}
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
              guideGeometry={guideGeometry}
              showShortformFrameOverlay={showShortformFrameOverlay}
              showSafeZoneGuides={showSafeZoneGuides}
            />
            <PreviewInteractionOverlay
              previewOverlayRef={previewOverlayRef}
              previewZoom={previewZoom}
              previewViewportOffset={previewViewportOffset}
              previewViewportWidth={previewViewportWidth}
              previewViewportHeight={previewViewportHeight}
              previewSize={previewSize}
              selectedMeta={selectedMeta}
              overlay={overlay}
              motionPath={motionPath}
              currentOpacity={currentOpacity}
              currentRotation={currentRotation}
              currentScale={currentScale}
              isDraggingAnchor={isDraggingAnchor}
              isDraggingPosition={isDraggingPosition}
              isDraggingOpacity={isDraggingOpacity}
              isDraggingRotation={isDraggingRotation}
              positionReadout={positionReadout}
              opacityReadout={opacityReadout}
              rotationReadout={rotationReadout}
              scaleReadout={scaleReadout}
              onStartScaleDrag={onStartScaleDrag}
              onStartMoveDrag={onStartMoveDrag}
              onStartOpacityDrag={onStartOpacityDrag}
              onStartRotationDrag={onStartRotationDrag}
              onTargetMouseDown={onTargetMouseDown}
              onAnchorMouseDown={onAnchorMouseDown}
              onMotionPathDotClick={onMotionPathDotClick}
              onStartMotionPathKeyframeDrag={onStartMotionPathKeyframeDrag}
              draggingMotionPathFrame={draggingMotionPathFrame}
              motionPathDragReadout={motionPathDragReadout}
              onCommitScaleInput={onCommitScaleInput}
              onCommitRotationInput={onCommitRotationInput}
              onCommitOpacityInput={onCommitOpacityInput}
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
