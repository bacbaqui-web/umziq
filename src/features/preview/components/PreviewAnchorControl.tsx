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
        border: "1px solid rgba(118, 197, 255, 0.98)",
        background: "rgba(12, 16, 22, 0.9)",
        boxSizing: "border-box",
        cursor: isDraggingAnchor ? "none" : "pointer",
        pointerEvents: "auto",
        opacity: anchorOpacity,
        transition: "opacity 140ms ease, box-shadow 120ms ease",
        boxShadow: isAnchorHovered
          ? "0 0 0 1px rgba(118, 197, 255, 0.18)"
          : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 1.5,
          height: 1.5,
          marginLeft: -0.75,
          marginTop: -0.75,
          borderRadius: 999,
          background: "#76c5ff",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 2,
          bottom: 2,
          width: 1,
          marginLeft: -0.5,
          background: "rgba(118, 197, 255, 0.55)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 2,
          right: 2,
          height: 1,
          marginTop: -0.5,
          background: "rgba(118, 197, 255, 0.55)",
        }}
      />
    </div>
  );
}
