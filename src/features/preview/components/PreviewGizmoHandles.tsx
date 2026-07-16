import type { ScaleHandleDirection } from "@/engines/canvas";
import {
  GIZMO_HANDLE_SIZE,
  type HoveredGizmoHandle,
  type PreviewLineHandle,
  type PreviewScaleHandle,
} from "@/features/preview/types/previewGizmoTypes";

type PreviewGizmoHandlesProps = {
  cursors: {
    move: string;
    rotation: string;
    opacity: string;
    scale: Record<ScaleHandleDirection, string>;
  };
  previewMoveHandle: PreviewLineHandle;
  previewRotationHandle: PreviewLineHandle;
  previewOpacityHandle: PreviewLineHandle;
  previewScaleHandles: PreviewScaleHandle[];
  hoveredHandle: HoveredGizmoHandle;
  isDraggingPosition: boolean;
  isDraggingOpacity: boolean;
  isDraggingRotation: boolean;
  onPressMove: (clientX: number, clientY: number) => void;
  onPressRotation: (clientX: number, clientY: number) => void;
  onPressOpacity: (clientX: number, clientY: number) => void;
  onPressScale: (handle: ScaleHandleDirection, clientX: number, clientY: number) => void;
  onHoverHandle: (handle: HoveredGizmoHandle) => void;
  onOpenRotationInput: () => void;
  onOpenOpacityInput: () => void;
  onOpenScaleInput: (handle: ScaleHandleDirection, x: number, y: number) => void;
};

function createCircularHandleStyle({
  point,
  border,
  background,
  cursor,
  opacity,
  boxShadow,
}: {
  point: PreviewLineHandle["point"];
  border: string;
  background: string;
  cursor: string;
  opacity: number;
  boxShadow: string;
}) {
  return {
    position: "absolute" as const,
    left: point.x,
    top: point.y,
    width: GIZMO_HANDLE_SIZE,
    height: GIZMO_HANDLE_SIZE,
    marginLeft: -(GIZMO_HANDLE_SIZE / 2),
    marginTop: -(GIZMO_HANDLE_SIZE / 2),
    padding: 0,
    borderRadius: 999,
    border,
    background,
    boxSizing: "border-box" as const,
    pointerEvents: "auto" as const,
    cursor,
    opacity,
    boxShadow,
    transition: "opacity 140ms ease, box-shadow 120ms ease",
  };
}

export default function PreviewGizmoHandles({
  cursors,
  previewMoveHandle,
  previewRotationHandle,
  previewOpacityHandle,
  previewScaleHandles,
  hoveredHandle,
  isDraggingPosition,
  isDraggingOpacity,
  isDraggingRotation,
  onPressMove,
  onPressRotation,
  onPressOpacity,
  onPressScale,
  onHoverHandle,
  onOpenRotationInput,
  onOpenOpacityInput,
  onOpenScaleInput,
}: PreviewGizmoHandlesProps) {
  return (
    <>
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onPressMove(event.clientX, event.clientY);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseEnter={() => onHoverHandle("move")}
        onMouseLeave={() => onHoverHandle(null)}
        title="이동"
        style={createCircularHandleStyle({
          point: previewMoveHandle.point,
          border: "1px solid rgba(118, 197, 255, 0.95)",
          background: "rgba(118, 197, 255, 0.88)",
          cursor: isDraggingPosition ? "grabbing" : cursors.move,
          opacity: hoveredHandle === "move" || isDraggingPosition ? 0.98 : 0.56,
          boxShadow:
            hoveredHandle === "move" || isDraggingPosition
              ? "0 0 0 1px rgba(118, 197, 255, 0.24)"
              : "0 0 0 1px rgba(8, 10, 14, 0.24)",
        })}
      />

      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onPressRotation(event.clientX, event.clientY);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenRotationInput();
        }}
        onMouseEnter={() => onHoverHandle("rotation")}
        onMouseLeave={() => onHoverHandle(null)}
        title="회전"
        style={createCircularHandleStyle({
          point: previewRotationHandle.point,
          border: "1px solid rgba(255, 186, 112, 0.92)",
          background: "rgba(255, 186, 112, 0.9)",
          cursor: isDraggingRotation ? "grabbing" : cursors.rotation,
          opacity: hoveredHandle === "rotation" || isDraggingRotation ? 0.96 : 0.56,
          boxShadow: isDraggingRotation
            ? "0 0 0 1px rgba(255, 186, 112, 0.22)"
            : hoveredHandle === "rotation"
              ? "0 0 0 1px rgba(255, 186, 112, 0.18)"
              : "0 0 0 1px rgba(255, 186, 112, 0.06)",
        })}
      />

      {previewScaleHandles.map((handle) => (
        <button
          key={handle.key}
          type="button"
          onMouseEnter={() => onHoverHandle(handle.key)}
          onMouseLeave={() => onHoverHandle(null)}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPressScale(handle.key, event.clientX, event.clientY);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenScaleInput(handle.key, handle.point.x, handle.point.y);
          }}
          title={handle.label}
          style={createCircularHandleStyle({
            point: handle.point,
            border: `1px solid ${handle.borderColor}`,
            background: handle.borderColor.replace("0.98", "0.88"),
            cursor: cursors.scale[handle.key],
            opacity: hoveredHandle === handle.key ? 0.96 : 0.56,
            boxShadow:
              hoveredHandle === handle.key
                ? "0 0 0 1px rgba(8, 10, 14, 0.62)"
                : "0 0 0 1px rgba(8, 10, 14, 0.24)",
          })}
        />
      ))}

      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onPressOpacity(event.clientX, event.clientY);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenOpacityInput();
        }}
        onMouseEnter={() => onHoverHandle("opacity")}
        onMouseLeave={() => onHoverHandle(null)}
        title="불투명도"
        style={createCircularHandleStyle({
          point: previewOpacityHandle.point,
          border: "1px solid rgba(255, 255, 255, 0.95)",
          background: "rgba(255, 255, 255, 0.92)",
          cursor: cursors.opacity,
          opacity: hoveredHandle === "opacity" || isDraggingOpacity ? 0.96 : 0.56,
          boxShadow:
            hoveredHandle === "opacity" || isDraggingOpacity
              ? "0 0 0 1px rgba(255,255,255,0.28)"
              : "0 0 0 1px rgba(8, 10, 14, 0.24)",
        })}
      />
    </>
  );
}
