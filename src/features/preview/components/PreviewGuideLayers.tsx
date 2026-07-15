import type { PreviewGuideGeometry } from "@/editor/preview/guideGeometry";

type PreviewGuideLayersProps = {
  previewSize: {
    width: number;
    height: number;
  };
  viewportScale: number;
  guideGeometry: PreviewGuideGeometry;
  showShortformFrame: boolean;
  showSafeZoneGuides: boolean;
};

export default function PreviewGuideLayers({
  previewSize,
  viewportScale,
  guideGeometry,
  showShortformFrame,
  showSafeZoneGuides,
}: PreviewGuideLayersProps) {
  if (!showShortformFrame && !showSafeZoneGuides) {
    return null;
  }

  const safeZoneStrokeWidth = 1 / Math.max(viewportScale, 0.0001);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <svg
        width={previewSize.width}
        height={previewSize.height}
        viewBox={`0 0 ${previewSize.width} ${previewSize.height}`}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {showShortformFrame && (
          <g>
            <g fill="rgba(0, 0, 0, 0.7)">
              {guideGeometry.dimRects.map((rect, index) => (
                <rect
                  key={`dim-${index}`}
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                />
              ))}
            </g>
          </g>
        )}
        {showSafeZoneGuides && (
          <g
            stroke="rgba(255, 0, 0, 0.5)"
            strokeWidth={safeZoneStrokeWidth}
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
            shapeRendering="geometricPrecision"
          >
            {guideGeometry.safeZoneLines.map((line, index) => (
              <line
                key={`guide-${index}`}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
