import type { RefObject } from "react";
import PreviewGuideLayers from "@/features/preview/components/PreviewGuideLayers";
import PreviewCameraFrameControls from "@/features/preview/components/PreviewCameraFrameControls";
import type { CanvasGuideViewModel } from "@/engines/canvas";
import type { Position } from "@/models";

type PreviewViewportLayersProps = {
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
