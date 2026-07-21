import type { MouseEvent as ReactMouseEvent } from "react";
import type { PreviewPoint } from "@/features/preview/types/previewGizmoTypes";

type PreviewAnchorControlProps = {
  previewAnchor: PreviewPoint;
  anchorOpacity: number;
  isDraggingAnchor: boolean;
  isAnchorHovered: boolean;
  onAnchorMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onAnchorHoverChange: (hovered: boolean) => void;
};

export default function PreviewAnchorControl({
  previewAnchor,
  anchorOpacity,
  isDraggingAnchor,
  isAnchorHovered,
  onAnchorMouseDown,
  onAnchorHoverChange,
}: PreviewAnchorControlProps) {
  return (
    <div
      onMouseDown={onAnchorMouseDown}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseEnter={() => onAnchorHoverChange(true)}
      onMouseLeave={() => onAnchorHoverChange(false)}
      style={{
        position: "absolute",
        left: previewAnchor.x,
        top: previewAnchor.y,
        width: 10,
        height: 10,
        marginLeft: -5,
        marginTop: -5,
        borderRadius: 999,
        border: "1px solid rgba(214, 238, 255, 0.98)",
        background: "rgba(118, 197, 255, 0.98)",
        boxSizing: "border-box",
        cursor: isDraggingAnchor ? "none" : "pointer",
        pointerEvents: "auto",
        opacity: anchorOpacity,
        transition: "opacity 140ms ease, box-shadow 120ms ease",
        boxShadow: isAnchorHovered
          ? "0 0 0 3px rgba(118, 197, 255, 0.2)"
          : "0 0 0 1px rgba(8, 10, 14, 0.4)",
      }}
    />
  );
}
