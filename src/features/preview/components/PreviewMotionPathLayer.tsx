type PreviewMotionPathLayerProps = {
  previewMotionPath: Array<{
    frame: number;
    isCurrent: boolean;
    isKeyframe: boolean;
    point: {
      x: number;
      y: number;
    };
  }>;
  motionPathPolyline: string;
  protectedControlPoints: Array<{ x: number; y: number }>;
  currentMotionFrame: number | null;
  hoveredMotionFrame: number | null;
  draggingMotionPathFrame: number | null;
  motionPathInteractionLocked: boolean;
  motionPathDragReadout: string | null;
  suppressedMotionPathClickFrame: number | null;
  onHoverMotionFrame: (frame: number | null) => void;
  onPressMotionPathDot: (
    frame: number,
    isKeyframe: boolean,
    clientX: number,
    clientY: number
  ) => void;
  onClickMotionPathDot: (
    frame: number,
    isKeyframe: boolean,
    suppressedClickFrame: number | null
  ) => void;
};

const MOTION_PATH_HANDLE_PROTECTION_RADIUS = 18;

export default function PreviewMotionPathLayer({
  previewMotionPath,
  motionPathPolyline,
  protectedControlPoints,
  currentMotionFrame,
  hoveredMotionFrame,
  draggingMotionPathFrame,
  motionPathInteractionLocked,
  motionPathDragReadout,
  suppressedMotionPathClickFrame,
  onHoverMotionFrame,
  onPressMotionPathDot,
  onClickMotionPathDot,
}: PreviewMotionPathLayerProps) {
  return (
    <>
      {previewMotionPath.length > 1 && (
        <polyline
          points={motionPathPolyline}
          fill="none"
          stroke="rgba(118, 197, 255, 0.18)"
          strokeWidth={1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {previewMotionPath.map(({ frame, point, isKeyframe, isCurrent }) => {
        const frameDistance =
          currentMotionFrame === null ? Number.POSITIVE_INFINITY : Math.abs(frame - currentMotionFrame);
        const proximity = Number.isFinite(frameDistance)
          ? Math.max(0, 1 - frameDistance / 10)
          : 0;
        const nearestControlDistance = Math.min(
          ...protectedControlPoints.map((controlPoint) =>
            Math.hypot(point.x - controlPoint.x, point.y - controlPoint.y)
          )
        );
        const isNearProtectedControl =
          nearestControlDistance < MOTION_PATH_HANDLE_PROTECTION_RADIUS;
        const isInteractive = !motionPathInteractionLocked && !isNearProtectedControl;
        const isHovered = hoveredMotionFrame === frame && isInteractive;
        const radius = isCurrent
          ? 4
          : isKeyframe
            ? 2.6 + proximity * 0.8
            : 1.2 + proximity * 1.2;
        const hoverRadius = radius + (isCurrent ? 0.8 : 1.2);
        const fillOpacity = isCurrent
          ? 0.96
          : isKeyframe
            ? 0.52 + proximity * 0.34
            : 0.12 + proximity * 0.32;
        const displayedOpacity = isNearProtectedControl
          ? Math.max(0.08, fillOpacity * 0.45)
          : fillOpacity;
        const hitRadius = isKeyframe ? 8 : 6;

        return (
          <g key={`motion-${frame}`}>
            {isHovered && isInteractive && (
              <circle
                cx={point.x}
                cy={point.y}
                r={hoverRadius}
                fill="rgba(118, 197, 255, 0.08)"
                stroke="rgba(255,255,255,0.38)"
                strokeWidth={1}
                pointerEvents="none"
              />
            )}
            <circle
              cx={point.x}
              cy={point.y}
              r={radius + (isHovered || draggingMotionPathFrame === frame ? 0.45 : 0)}
              fill={
                isCurrent
                  ? "rgba(255,255,255,0.96)"
                  : `rgba(118, 197, 255, ${Math.min(
                      1,
                      displayedOpacity +
                        (isInteractive && (isHovered || draggingMotionPathFrame === frame)
                          ? 0.18
                          : 0)
                    )})`
              }
              stroke={
                isCurrent
                  ? "rgba(118, 197, 255, 0.9)"
                  : isKeyframe
                    ? "rgba(255,255,255,0.48)"
                    : "none"
              }
              strokeWidth={isCurrent ? 1.5 : isKeyframe ? 1 : 0}
              pointerEvents="none"
            />
            {isInteractive && (
              <circle
                cx={point.x}
                cy={point.y}
                r={hitRadius}
                fill="transparent"
                stroke="none"
                style={{
                  pointerEvents: "auto",
                  cursor: "pointer",
                }}
                onMouseEnter={() => onHoverMotionFrame(frame)}
                onMouseLeave={() => onHoverMotionFrame(null)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onPressMotionPathDot(frame, isKeyframe, event.clientX, event.clientY);
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClickMotionPathDot(frame, isKeyframe, suppressedMotionPathClickFrame);
                }}
              />
            )}
            {draggingMotionPathFrame === frame && motionPathDragReadout && (
              <foreignObject
                x={point.x + 8}
                y={point.y - 18}
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
        );
      })}
    </>
  );
}
