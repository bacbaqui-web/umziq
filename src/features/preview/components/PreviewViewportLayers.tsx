import type { RefObject } from "react";
import PreviewGuideLayers from "@/features/preview/components/PreviewGuideLayers";
import type { CanvasGuideViewModel } from "@/engines/canvas";
import type { Position } from "@/models";

type PreviewViewportLayersProps = {
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  previewBaseOffset: Position;
  previewPan: Position;
  previewZoom: number;
  previewSize: {
    width: number;
    height: number;
  };
  guide: CanvasGuideViewModel;
};

export default function PreviewViewportLayers({
  previewCanvasRef,
  previewBaseOffset,
  previewPan,
  previewZoom,
  previewSize,
  guide,
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
          guide={guide}
        />
      </div>
    </>
  );
}
