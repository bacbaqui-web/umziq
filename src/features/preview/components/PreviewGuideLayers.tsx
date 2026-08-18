import type { CanvasGuideViewModel } from "@/engines/canvas";

type PreviewGuideLayersProps = {
  guide: CanvasGuideViewModel;
};

export default function PreviewGuideLayers({ guide }: PreviewGuideLayersProps) {
  if (!guide.showShortformFrame && !guide.showSafeZoneGuides) {
    return null;
  }

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
        width={guide.previewSize.width}
        height={guide.previewSize.height}
        viewBox={`0 0 ${guide.previewSize.width} ${guide.previewSize.height}`}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {guide.showShortformFrame && (
          <g>
            <g
              fill={`rgba(0, 0, 0, ${guide.cameraDimOpacityPercent / 100})`}
            >
              {guide.geometry.dimRects.map((rect, index) => (
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
        {guide.showSafeZoneGuides && (
          <g
            stroke="rgba(255, 0, 0, 0.5)"
            strokeWidth={guide.safeZoneStrokeWidth}
            strokeLinecap="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
            shapeRendering="geometricPrecision"
          >
            {guide.geometry.safeZoneLines.map((line, index) => (
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
