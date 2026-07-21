import type { CanvasMotionPathPointViewModel } from "@/engines/canvas";

type PreviewMotionPathLayerProps = {
  points: CanvasMotionPathPointViewModel[];
  motionPathPolyline: string;
  motionPathDragReadout: string | null;
  onHoverMotionFrame: (frame: number | null) => void;
  onPressMotionPathDot: (
    frame: number,
    isKeyframe: boolean,
    clientX: number,
    clientY: number
  ) => void;
  onClickMotionPathDot: (frame: number, isKeyframe: boolean) => void;
};

export default function PreviewMotionPathLayer({
  points,
  motionPathPolyline,
  motionPathDragReadout,
  onHoverMotionFrame,
  onPressMotionPathDot,
  onClickMotionPathDot,
}: PreviewMotionPathLayerProps) {
  return (
    <>
      {points.length > 1 && (
        <polyline
          points={motionPathPolyline}
          fill="none"
          stroke="rgba(118, 197, 255, 0.18)"
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {points.map((point) => (
        <g key={`motion-${point.frame}`}>
          {point.isHovered && point.isInteractive && (
            <circle
              cx={point.point.x}
              cy={point.point.y}
              r={point.hoverRadius}
              fill="rgba(118, 197, 255, 0.08)"
              stroke="rgba(255,255,255,0.38)"
              strokeWidth={1}
              pointerEvents="none"
            />
          )}
          <circle
            cx={point.point.x}
            cy={point.point.y}
            r={point.radius + (point.isHovered || point.isDragging ? 0.45 : 0)}
            fill={
              point.isCurrent
                ? "rgba(255,255,255,0.96)"
                : `rgba(118, 197, 255, ${Math.min(
                    1,
                    point.displayedOpacity +
                      (point.isInteractive && (point.isHovered || point.isDragging) ? 0.18 : 0)
                  )})`
            }
            stroke={
              point.isCurrent
                ? "rgba(118, 197, 255, 0.9)"
                : point.isKeyframe
                  ? "rgba(255,255,255,0.48)"
                  : "none"
            }
            strokeWidth={point.isCurrent ? 1.5 : point.isKeyframe ? 1 : 0}
            pointerEvents="none"
          />
          {point.isInteractive && (
            <circle
              cx={point.point.x}
              cy={point.point.y}
              r={point.hitRadius}
              fill="transparent"
              stroke="none"
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onMouseEnter={() => onHoverMotionFrame(point.frame)}
              onMouseLeave={() => onHoverMotionFrame(null)}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onPressMotionPathDot(
                  point.frame,
                  point.isKeyframe,
                  event.clientX,
                  event.clientY
                );
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClickMotionPathDot(point.frame, point.isKeyframe);
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            />
          )}
          {point.isDragging && motionPathDragReadout && (
            <foreignObject
              x={point.point.x + 8}
              y={point.point.y - 18}
              width={120}
              height={24}
              pointerEvents="none"
            >
              <div
                style={{
                  display: "inline-flex",
                  padding: "1px 5px",
                  borderRadius: 999,
                  border: "1px solid rgba(118, 197, 255, 0.36)",
                  background: "rgba(17, 21, 27, 0.92)",
                  color: "#d9ebff",
                  fontSize: 10,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                {motionPathDragReadout}
              </div>
            </foreignObject>
          )}
        </g>
      ))}
    </>
  );
}
