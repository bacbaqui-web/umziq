import type { RefObject } from "react";
import PreviewGuideLayers from "@/features/preview/components/PreviewGuideLayers";
import type { PreviewGuideGeometry } from "@/editor/preview/guideGeometry";
import type { Position } from "@/editor/types/types";

type PreviewViewportLayersProps = {
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  previewBaseOffset: Position;
  previewPan: Position;
  previewZoom: number;
  previewSize: {
    width: number;
    height: number;
  };
  guideGeometry: PreviewGuideGeometry;
  showShortformFrameOverlay: boolean;
  showSafeZoneGuides: boolean;
};

export default function PreviewViewportLayers({
  previewCanvasRef,
  previewBaseOffset,
  previewPan,
  previewZoom,
  previewSize,
  guideGeometry,
  showShortformFrameOverlay,
  showSafeZoneGuides,
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
          zIndex: 30,
          pointerEvents: "none",
        }}
      >
        <PreviewGuideLayers
          previewSize={previewSize}
          viewportScale={previewZoom}
          guideGeometry={guideGeometry}
          showShortformFrame={showShortformFrameOverlay}
          showSafeZoneGuides={showSafeZoneGuides}
        />
      </div>
    </>
  );
}
