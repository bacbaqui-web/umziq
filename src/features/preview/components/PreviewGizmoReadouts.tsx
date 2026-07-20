import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ScaleHandleDirection } from "@/engines/canvas";
import type { CanvasDirectInputState } from "@/engines/canvas";
import type { PreviewLineHandle, PreviewScaleHandle } from "@/features/preview/types/previewGizmoTypes";

type PreviewGizmoReadoutsProps = {
  previewMoveHandle: PreviewLineHandle;
  previewRotationHandle: PreviewLineHandle;
  previewOpacityHandle: PreviewLineHandle;
  activeScaleHandle: PreviewScaleHandle | null;
  positionReadout: string | null;
  opacityReadout: string | null;
  rotationReadout: string | null;
  scaleReadout: {
    handle: ScaleHandleDirection;
    text: string;
  } | null;
  isDraggingOpacity: boolean;
  isDraggingRotation: boolean;
  directInput: CanvasDirectInputState;
  onDirectInputChange: (value: string) => void;
  onDirectInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onCloseDirectInput: () => void;
  onCommitDirectInput: () => void;
};

export default function PreviewGizmoReadouts({
  previewMoveHandle,
  previewRotationHandle,
  previewOpacityHandle,
  activeScaleHandle,
  positionReadout,
  opacityReadout,
  rotationReadout,
  scaleReadout,
  isDraggingOpacity,
  isDraggingRotation,
  directInput,
  onDirectInputChange,
  onDirectInputKeyDown,
  onCloseDirectInput,
  onCommitDirectInput,
}: PreviewGizmoReadoutsProps) {
  return (
    <>
      {isDraggingRotation && rotationReadout && (
        <div
          style={{
            position: "absolute",
            left: previewRotationHandle.point.x + 9,
            top: previewRotationHandle.point.y - 14,
            padding: "1px 5px",
            borderRadius: 999,
            border: "1px solid rgba(255, 186, 112, 0.4)",
            background: "rgba(17, 21, 27, 0.92)",
            color: "#ffe0ba",
            fontSize: 10,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {rotationReadout}
        </div>
      )}

      {positionReadout && (
        <div
          style={{
            position: "absolute",
            left: previewMoveHandle.point.x + 10,
            top: previewMoveHandle.point.y - 14,
            padding: "1px 5px",
            borderRadius: 999,
            border: "1px solid rgba(118, 197, 255, 0.36)",
            background: "rgba(17, 21, 27, 0.92)",
            color: "#d9ebff",
            fontSize: 10,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {positionReadout}
        </div>
      )}

      {scaleReadout && activeScaleHandle && (
        <div
          style={{
            position: "absolute",
            left: activeScaleHandle.point.x + 14,
            top: activeScaleHandle.point.y - 14,
            padding: "2px 6px",
            borderRadius: 999,
            border: `1px solid ${activeScaleHandle.borderColor.replace("0.98", "0.45")}`,
            background: "rgba(17, 21, 27, 0.95)",
            color: "#f4f7fb",
            fontSize: 11,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {scaleReadout.text}
        </div>
      )}

      {isDraggingOpacity && opacityReadout && (
        <div
          style={{
            position: "absolute",
            left: previewOpacityHandle.point.x + 9,
            top: previewOpacityHandle.point.y - 14,
            padding: "1px 5px",
            borderRadius: 999,
            border: "1px solid rgba(255, 255, 255, 0.36)",
            background: "rgba(17, 21, 27, 0.92)",
            color: "#f6f8fa",
            fontSize: 10,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {opacityReadout}
        </div>
      )}

      {directInput && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onCommitDirectInput();
          }}
          style={{
            position: "absolute",
            left: directInput.x,
            top: directInput.y,
            padding: 4,
            borderRadius: 7,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(15, 18, 22, 0.96)",
            pointerEvents: "auto",
            boxShadow: "0 8px 18px rgba(0,0,0,0.28)",
          }}
        >
          <input
            className="ui-input"
            autoFocus
            type="number"
            value={directInput.value}
            onChange={(event) => onDirectInputChange(event.target.value)}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onKeyDown={onDirectInputKeyDown}
            onBlur={onCloseDirectInput}
            style={{
              width: 64,
              padding: "4px 6px",
              border: "1px solid #39424a",
              background: "#14181d",
              color: "#f4f7fb",
              fontSize: 12,
              outline: "none",
            }}
          />
        </form>
      )}
    </>
  );
}
