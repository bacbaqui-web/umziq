import type { MouseEvent as ReactMouseEvent } from "react";
import type { ScaleHandleDirection } from "@/engines/canvas";
import type {
  HoveredGizmoHandle,
  PreviewEndpointHandle,
  PreviewPoint,
  PreviewScaleHandle,
} from "@/features/preview/types/previewGizmoTypes";

const CONNECTION_HIT_STROKE_WIDTH = 12;

type InteractiveLineProps = {
  label: string;
  hoverHandle: Exclude<HoveredGizmoHandle, "move" | null>;
  start: PreviewPoint;
  end: PreviewPoint;
  cursor: string;
  onPress: (clientX: number, clientY: number) => void;
  onHoverHandle: (handle: HoveredGizmoHandle) => void;
  onOpenInput: () => void;
};

function InteractiveLine({
  label,
  hoverHandle,
  start,
  end,
  cursor,
  onPress,
  onHoverHandle,
  onOpenInput,
}: InteractiveLineProps) {
  if (Math.hypot(end.x - start.x, end.y - start.y) < 0.001) return null;

  const consume = (event: ReactMouseEvent<SVGLineElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <line
      aria-label={label}
      data-gizmo-connection-hit={hoverHandle}
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
      fill="none"
      stroke="transparent"
      strokeWidth={CONNECTION_HIT_STROKE_WIDTH}
      strokeLinecap="butt"
      pointerEvents="stroke"
      style={{ cursor }}
      onMouseEnter={() => onHoverHandle(hoverHandle)}
      onMouseLeave={() => onHoverHandle(null)}
      onMouseDown={(event) => {
        consume(event);
        onPress(event.clientX, event.clientY);
      }}
      onDoubleClick={(event) => {
        consume(event);
        onOpenInput();
      }}
    />
  );
}

type PreviewGizmoConnectionHitLayerProps = {
  viewportSize: { width: number; height: number };
  cursors: {
    rotation: string;
    opacity: string;
    scale: Record<ScaleHandleDirection, string>;
  };
  previewRotationHandle: PreviewEndpointHandle;
  previewOpacityHandle: PreviewEndpointHandle;
  previewScaleHandles: PreviewScaleHandle[];
  onPressRotation: (clientX: number, clientY: number) => void;
  onPressOpacity: (clientX: number, clientY: number) => void;
  onPressScale: (
    handle: ScaleHandleDirection,
    clientX: number,
    clientY: number
  ) => void;
  onHoverHandle: (handle: HoveredGizmoHandle) => void;
  onOpenRotationInput: () => void;
  onOpenOpacityInput: () => void;
  onOpenScaleInput: (
    handle: ScaleHandleDirection,
    x: number,
    y: number
  ) => void;
};

export default function PreviewGizmoConnectionHitLayer({
  viewportSize,
  cursors,
  previewRotationHandle,
  previewOpacityHandle,
  previewScaleHandles,
  onPressRotation,
  onPressOpacity,
  onPressScale,
  onHoverHandle,
  onOpenRotationInput,
  onOpenOpacityInput,
  onOpenScaleInput,
}: PreviewGizmoConnectionHitLayerProps) {
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
      {previewScaleHandles.map((handle) => (
        <InteractiveLine
          key={handle.key}
          label={handle.label}
          hoverHandle={handle.key}
          start={handle.lineStart}
          end={handle.point}
          cursor={cursors.scale[handle.key]}
          onPress={(clientX, clientY) =>
            onPressScale(handle.key, clientX, clientY)
          }
          onHoverHandle={onHoverHandle}
          onOpenInput={() =>
            onOpenScaleInput(handle.key, handle.point.x, handle.point.y)
          }
        />
      ))}
      <InteractiveLine
        label="회전"
        hoverHandle="rotation"
        start={previewRotationHandle.lineStart}
        end={previewRotationHandle.lineEnd}
        cursor={cursors.rotation}
        onPress={onPressRotation}
        onHoverHandle={onHoverHandle}
        onOpenInput={onOpenRotationInput}
      />
      <InteractiveLine
        label="불투명도"
        hoverHandle="opacity"
        start={previewOpacityHandle.lineStart}
        end={previewOpacityHandle.lineEnd}
        cursor={cursors.opacity}
        onPress={onPressOpacity}
        onHoverHandle={onHoverHandle}
        onOpenInput={onOpenOpacityInput}
      />
    </svg>
  );
}
