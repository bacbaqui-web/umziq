import type { RefObject } from "react";
import PreviewGuideLayers from "@/features/preview/components/PreviewGuideLayers";
import PreviewCameraFrameControls from "@/features/preview/components/PreviewCameraFrameControls";
import type { CanvasGuideViewModel } from "@/engines/canvas";
import type { Position } from "@/models";
import type { DrawingEngineViewProps } from "@/engines/drawing";

type PreviewViewportLayersProps = {
  drawing: DrawingEngineViewProps;
  selectedLayerDocumentId: string | null;
  selectedSourceId: string | null;
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  previewBaseOffset: Position;
  previewPan: Position;
  previewZoom: number;
  previewSize: {
    width: number;
    height: number;
  };
  guide: CanvasGuideViewModel;
  cameraEditing: boolean;
  setCameraScalePercent: (percent: number) => void;
  commitCameraScalePercent: (percent: number) => void;
};

export default function PreviewViewportLayers({
  drawing,
  selectedLayerDocumentId,
  selectedSourceId,
  previewCanvasRef,
  previewBaseOffset,
  previewPan,
  previewZoom,
  previewSize,
  guide,
  cameraEditing,
  setCameraScalePercent,
  commitCameraScalePercent,
}: PreviewViewportLayersProps) {
  const previewStageStyle = {
    position: "absolute" as const,
    left: previewBaseOffset.x,
    top: previewBaseOffset.y,
    width: previewSize.width,
    height: previewSize.height,
    transform: `translate(${previewPan.x}px, ${previewPan.y}px) scale(${previewZoom})`,
    transformOrigin: "top left",
    willChange: "transform",
    overflow: "visible" as const,
  };

  return (
    <>
      <div style={previewStageStyle}>
        <canvas
          data-selected-layer-document-id={
            selectedLayerDocumentId ?? undefined
          }
          data-selected-source-id={
            selectedSourceId ?? undefined
          }
          ref={previewCanvasRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: previewSize.width,
            height: previewSize.height,
            background: "transparent",
          }}
        />
        {drawing.modeEnabled && drawing.geometry && (
          <svg viewBox={`0 0 ${drawing.geometry.width} ${drawing.geometry.height}`}
            onPointerDown={drawing.pointerDown} onPointerMove={drawing.pointerMove}
            onPointerUp={drawing.pointerUp} onPointerCancel={drawing.pointerCancel}
            style={{ position: "absolute",
              left: drawing.geometry.position.x - drawing.geometry.anchor.x,
              top: drawing.geometry.position.y - drawing.geometry.anchor.y,
              width: drawing.geometry.width, height: drawing.geometry.height,
              transformOrigin: `${drawing.geometry.anchor.x}px ${drawing.geometry.anchor.y}px`,
              transform: `rotate(${drawing.geometry.rotation}deg) scale(${drawing.geometry.scale.x / 100}, ${drawing.geometry.scale.y / 100})`,
              zIndex: 40, cursor: "crosshair", touchAction: "none" }}>
            {drawing.draftPoints.length > 0 && (
              <polyline points={drawing.draftPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none" stroke={drawing.tool === "eraser" ? "#ff657a" : drawing.color}
                strokeWidth={drawing.size} strokeLinecap="round" strokeLinejoin="round"
                opacity={drawing.tool === "eraser" ? 0.65 : 1} />
            )}
          </svg>
        )}
      </div>

      <div
        aria-hidden="true"
        style={{
          ...previewStageStyle,
          zIndex: cameraEditing ? 70 : 30,
          pointerEvents: "none",
        }}
      >
        <PreviewGuideLayers
          guide={guide}
        />
        {cameraEditing && (
          <PreviewCameraFrameControls
            guide={guide}
            previewZoom={previewZoom}
            onPreviewScale={setCameraScalePercent}
            onCommitScale={commitCameraScalePercent}
          />
        )}
      </div>
    </>
  );
}
