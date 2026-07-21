import type { ScaleHandleDirection } from "@/engines/canvas";

type PreviewGizmoBackdropProps = {
  viewportSize: {
    width: number;
    height: number;
  };
  previewRotationHandle: {
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
    lineEnd: { x: number; y: number };
  };
  previewOpacityHandle: {
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
    lineEnd: { x: number; y: number };
  };
  previewScaleHandles: Array<{
    key: ScaleHandleDirection;
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
    arrowWingPoints: {
      first: { x: number; y: number };
      second: { x: number; y: number };
    };
    borderColor: string;
    label: string;
  }>;
  hoveredHandle: ScaleHandleDirection | "rotation" | "opacity" | "move" | null;
  isDraggingOpacity: boolean;
  isDraggingRotation: boolean;
};

export default function PreviewGizmoBackdrop({
  viewportSize,
  previewRotationHandle,
  previewOpacityHandle,
  previewScaleHandles,
  hoveredHandle,
  isDraggingOpacity,
  isDraggingRotation,
}: PreviewGizmoBackdropProps) {
  return (
    <svg
      width={viewportSize.width}
      height={viewportSize.height}
      viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {previewScaleHandles.map((handle) => {
        const stroke = handle.borderColor.replace(
          "0.98",
          hoveredHandle === handle.key ? "0.78" : "0.26"
        );
        const strokeWidth = hoveredHandle === handle.key ? 3.2 : 2.4;
        const path = [
          `M ${handle.lineStart.x} ${handle.lineStart.y}`,
          `L ${handle.point.x} ${handle.point.y}`,
          `L ${handle.arrowWingPoints.first.x} ${handle.arrowWingPoints.first.y}`,
          `M ${handle.point.x} ${handle.point.y}`,
          `L ${handle.arrowWingPoints.second.x} ${handle.arrowWingPoints.second.y}`,
        ].join(" ");
        return (
          <path
            key={`arrow-${handle.key}`}
            data-scale-arrow={handle.key}
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: "stroke 140ms ease, stroke-width 140ms ease" }}
          />
        );
      })}
      <line
        x1={previewRotationHandle.lineStart.x}
        y1={previewRotationHandle.lineStart.y}
        x2={previewRotationHandle.lineEnd.x}
        y2={previewRotationHandle.lineEnd.y}
        stroke={hoveredHandle === "rotation" || isDraggingRotation
          ? "rgba(255, 186, 112, 0.82)"
          : "rgba(255, 186, 112, 0.32)"}
        strokeWidth={hoveredHandle === "rotation" || isDraggingRotation ? 2.8 : 2}
        style={{ transition: "stroke 140ms ease, stroke-width 140ms ease" }}
      />
      <line
        x1={previewOpacityHandle.lineStart.x}
        y1={previewOpacityHandle.lineStart.y}
        x2={previewOpacityHandle.lineEnd.x}
        y2={previewOpacityHandle.lineEnd.y}
        stroke={hoveredHandle === "opacity" || isDraggingOpacity
          ? "rgba(255, 255, 255, 0.88)"
          : "rgba(255, 255, 255, 0.34)"}
        strokeWidth={hoveredHandle === "opacity" || isDraggingOpacity ? 2.8 : 2}
        style={{ transition: "stroke 140ms ease, stroke-width 140ms ease" }}
      />
    </svg>
  );
}
