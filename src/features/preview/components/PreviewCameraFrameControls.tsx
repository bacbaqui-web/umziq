import { useRef, type PointerEvent } from "react";
import type { CanvasGuideViewModel } from "@/engines/canvas";

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type Props = {
  guide: CanvasGuideViewModel;
  previewZoom: number;
  onPreviewScale: (percent: number) => void;
  onCommitScale: (percent: number) => void;
};

export default function PreviewCameraFrameControls({
  guide,
  previewZoom,
  onPreviewScale,
  onCommitScale,
}: Props) {
  const dragRef = useRef<{
    pointerId: number;
    corner: Corner;
    startY: number;
    startPercent: number;
    value: number;
  } | null>(null);
  const frame = guide.geometry.frameRect;

  const begin = (corner: Corner, event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      pointerId: event.pointerId,
      corner,
      startY: event.clientY,
      startPercent: guide.cameraScalePercent,
      value: guide.cameraScalePercent,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = drag.corner.startsWith("top") ? -1 : 1;
    const screenDelta = (event.clientY - drag.startY) * direction;
    const worldHeightDelta = (screenDelta * 2) / Math.max(previewZoom, 0.0001);
    const percentDelta = (worldHeightDelta / 1920) * 100;
    drag.value = Math.min(
      1000,
      Math.max(1, Math.round((drag.startPercent + percentDelta) * 100) / 100)
    );
    onPreviewScale(drag.value);
  };

  const end = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    onCommitScale(drag.value);
  };

  const corners: Array<{ corner: Corner; left: number; top: number; cursor: string }> = [
    { corner: "top-left", left: frame.x, top: frame.y, cursor: "nwse-resize" },
    { corner: "top-right", left: frame.x + frame.width, top: frame.y, cursor: "nesw-resize" },
    { corner: "bottom-left", left: frame.x, top: frame.y + frame.height, cursor: "nesw-resize" },
    { corner: "bottom-right", left: frame.x + frame.width, top: frame.y + frame.height, cursor: "nwse-resize" },
  ];

  return (
    <div className="preview-camera-control" aria-label="가상 카메라 촬영 범위 조절" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
          boxSizing: "border-box",
          border: `${1 / Math.max(previewZoom, 0.0001)}px solid rgba(118, 197, 255, 0.92)`,
          boxShadow: `0 0 0 ${1 / Math.max(previewZoom, 0.0001)}px rgba(20, 52, 76, 0.45)`,
        }}
      />
      {corners.map(({ corner, left, top, cursor }) => (
        <button
          key={corner}
          className="preview-camera-control"
          type="button"
          aria-label={`${corner} 촬영 범위 크기 조절`}
          onPointerDown={(event) => begin(corner, event)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{
            position: "absolute",
            left,
            top,
            width: 12 / Math.max(previewZoom, 0.0001),
            height: 12 / Math.max(previewZoom, 0.0001),
            padding: 0,
            pointerEvents: "auto",
            border: `${1.5 / Math.max(previewZoom, 0.0001)}px solid #d7ecff`,
            borderRadius: 2 / Math.max(previewZoom, 0.0001),
            background: "#4f91c8",
            boxShadow: "0 2px 8px rgba(0,0,0,0.42)",
            transform: "translate(-50%, -50%)",
            cursor,
          }}
        />
      ))}
    </div>
  );
}
