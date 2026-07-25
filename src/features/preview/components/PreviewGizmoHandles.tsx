import type { ScaleHandleDirection } from "@/engines/canvas";
import {
  type HoveredGizmoHandle,
  type PreviewLineHandle,
  type PreviewScaleHandle,
} from "@/features/preview/types/previewGizmoTypes";

const RADIAL_ENDPOINT_SIZE = 12;

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
    width: RADIAL_ENDPOINT_SIZE,
    height: RADIAL_ENDPOINT_SIZE,
    marginLeft: -(RADIAL_ENDPOINT_SIZE / 2),
    marginTop: -(RADIAL_ENDPOINT_SIZE / 2),
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

function createPositionRingStyle({
  point,
  cursor,
  active,
}: {
  point: PreviewLineHandle["point"];
  cursor: string;
  active: boolean;
}) {
  const size = 48;
  return {
    position: "absolute" as const,
    left: point.x,
    top: point.y,
    width: size,
    height: size,
    marginLeft: -(size / 2),
    marginTop: -(size / 2),
    padding: 0,
    borderRadius: 999,
    border: `2px solid rgba(118, 197, 255, ${active ? "0.98" : "0.68"})`,
    background: "rgba(118, 197, 255, 0.035)",
    boxSizing: "border-box" as const,
    pointerEvents: "auto" as const,
    cursor,
    boxShadow: active
      ? "0 0 0 3px rgba(118, 197, 255, 0.16)"
      : "0 0 0 1px rgba(8, 10, 14, 0.28)",
    transition: "border-color 140ms ease, box-shadow 120ms ease, background 140ms ease",
  };
}

function createScaleArrowStyle({
  point,
  cursor,
}: {
  point: PreviewLineHandle["point"];
  cursor: string;
}) {
  const size = 21.6;
  return {
    position: "absolute" as const,
    left: point.x,
    top: point.y,
    width: size,
    height: size,
    marginLeft: -(size / 2),
    marginTop: -(size / 2),
    padding: 0,
    border: 0,
    borderRadius: 999,
    background: "transparent",
    boxSizing: "border-box" as const,
    pointerEvents: "auto" as const,
    cursor,
    opacity: 1,
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
        aria-label="위치 이동"
        style={createPositionRingStyle({
          point: previewMoveHandle.point,
          cursor: isDraggingPosition ? "grabbing" : cursors.move,
          active: hoveredHandle === "move" || isDraggingPosition,
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
          border: "2px solid rgba(255, 186, 112, 0.92)",
          background: "rgba(17, 21, 27, 0.68)",
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
          aria-label={handle.label}
          style={createScaleArrowStyle({
            point: handle.point,
            cursor: cursors.scale[handle.key],
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
          border: "2px solid rgba(255, 255, 255, 0.95)",
          background: "rgba(17, 21, 27, 0.68)",
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
