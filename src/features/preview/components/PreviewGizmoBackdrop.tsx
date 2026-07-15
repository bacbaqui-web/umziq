import type { MouseEvent as ReactMouseEvent } from "react";
import type { ScaleHandleDirection } from "@/editor/types/editorViewTypes";

type PreviewGizmoBackdropProps = {
  viewportSize: {
    width: number;
    height: number;
  };
  previewCorners: {
    nw: { x: number; y: number };
    ne: { x: number; y: number };
    se: { x: number; y: number };
    sw: { x: number; y: number };
  } | null;
  polygonPoints: string;
  previewAnchor: { x: number; y: number };
  previewMoveHandle: {
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
  };
  previewRotationHandle: {
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
  };
  previewOpacityHandle: {
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
  };
  previewScaleHandles: Array<{
    key: ScaleHandleDirection;
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
    borderColor: string;
    label: string;
  }>;
  hoveredHandle: ScaleHandleDirection | "rotation" | "opacity" | "move" | null;
  isDraggingPosition: boolean;
  isDraggingOpacity: boolean;
  isDraggingRotation: boolean;
  onTargetMouseDown: (event: ReactMouseEvent<SVGPolygonElement>) => void;
};

export default function PreviewGizmoBackdrop({
  viewportSize,
  previewCorners,
  polygonPoints,
  previewAnchor,
  previewMoveHandle,
  previewRotationHandle,
  previewOpacityHandle,
  previewScaleHandles,
  hoveredHandle,
  isDraggingPosition,
  isDraggingOpacity,
  isDraggingRotation,
  onTargetMouseDown,
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
      {previewCorners && (
        <>
          <polygon
            points={polygonPoints}
            fill="rgba(118, 197, 255, 0.02)"
            stroke="rgba(118, 197, 255, 0.24)"
            strokeWidth={1}
            strokeLinejoin="round"
            style={{
              pointerEvents: "auto",
              cursor: isDraggingPosition ? "grabbing" : "move",
            }}
            onMouseDown={onTargetMouseDown}
          />
          <line
            x1={previewCorners.nw.x}
            y1={previewCorners.nw.y}
            x2={previewCorners.se.x}
            y2={previewCorners.se.y}
            stroke="rgba(118, 197, 255, 0.12)"
            strokeWidth={1}
          />
          <line
            x1={previewCorners.ne.x}
            y1={previewCorners.ne.y}
            x2={previewCorners.sw.x}
            y2={previewCorners.sw.y}
            stroke="rgba(118, 197, 255, 0.12)"
            strokeWidth={1}
          />
        </>
      )}
      {previewScaleHandles.map((handle) => (
        <line
          key={`line-${handle.key}`}
          x1={previewAnchor.x}
          y1={previewAnchor.y}
          x2={handle.point.x}
          y2={handle.point.y}
          stroke={handle.borderColor.replace(
            "0.98",
            hoveredHandle === handle.key ? "0.78" : "0.26"
          )}
          strokeWidth={hoveredHandle === handle.key ? 1.6 : 1.2}
          style={{ transition: "stroke 140ms ease, stroke-width 140ms ease" }}
        />
      ))}
      <line
        x1={previewMoveHandle.lineStart.x}
        y1={previewMoveHandle.lineStart.y}
        x2={previewMoveHandle.point.x}
        y2={previewMoveHandle.point.y}
        stroke={hoveredHandle === "move" || isDraggingPosition
          ? "rgba(118, 197, 255, 0.8)"
          : "rgba(118, 197, 255, 0.28)"}
        strokeWidth={hoveredHandle === "move" || isDraggingPosition ? 1.4 : 1}
        style={{ transition: "stroke 140ms ease, stroke-width 140ms ease" }}
      />
      <line
        x1={previewRotationHandle.lineStart.x}
        y1={previewRotationHandle.lineStart.y}
        x2={previewRotationHandle.point.x}
        y2={previewRotationHandle.point.y}
        stroke={hoveredHandle === "rotation" || isDraggingRotation
          ? "rgba(255, 186, 112, 0.82)"
          : "rgba(255, 186, 112, 0.32)"}
        strokeWidth={hoveredHandle === "rotation" || isDraggingRotation ? 1.4 : 1}
        style={{ transition: "stroke 140ms ease, stroke-width 140ms ease" }}
      />
      <line
        x1={previewOpacityHandle.lineStart.x}
        y1={previewOpacityHandle.lineStart.y}
        x2={previewOpacityHandle.point.x}
        y2={previewOpacityHandle.point.y}
        stroke={hoveredHandle === "opacity" || isDraggingOpacity
          ? "rgba(255, 255, 255, 0.88)"
          : "rgba(255, 255, 255, 0.34)"}
        strokeWidth={hoveredHandle === "opacity" || isDraggingOpacity ? 1.4 : 1}
        style={{ transition: "stroke 140ms ease, stroke-width 140ms ease" }}
      />
    </svg>
  );
}
