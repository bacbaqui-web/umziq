import { useEffect, useRef } from "react";

import { measureLayerHoverPreview } from "@/shared/helpers/layerHoverPreviewHelpers";

export default function LayerHoverPreviewCard({
  name,
  width,
  height,
  imageUrl,
  surface,
  status = "ready",
  x,
  y,
  zIndex = 1100,
}: {
  name: string;
  width?: number | null;
  height?: number | null;
  imageUrl?: string | null;
  surface?: CanvasImageSource | null;
  status?: "ready" | "empty" | "missing";
  x: number;
  y: number;
  zIndex?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasVisual = status === "ready" && Boolean(imageUrl || surface);
  const measurement = measureLayerHoverPreview({ hasVisual, width, height });
  const ratio = width && height ? width / height : 1;
  const renderWidth = ratio >= 1
    ? 208
    : Math.max(1, measurement.imageHeight * ratio);
  const renderHeight = ratio >= 1
    ? measurement.imageHeight
    : measurement.imageHeight;

  useEffect(() => {
    if (!surface || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    try {
      context.drawImage(surface, 0, 0, canvas.width, canvas.height);
    } catch {
      // Runtime resources may be invalidated between hover and paint.
    }
  }, [surface, renderHeight, renderWidth]);

  return (
    <div aria-hidden="true" style={{
      position: "fixed", zIndex, left: x, top: y, width: 220,
      pointerEvents: "none", overflow: "hidden", border: "1px solid #50677b",
      borderRadius: 8, background: "#11161a", boxShadow: "0 14px 34px rgba(0,0,0,.58)",
    }}>
      <div style={{
        padding: "5px 7px", display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 8, overflow: "hidden",
        color: "#dce8f2", fontSize: 11,
      }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        {width !== undefined && width !== null && height !== undefined && height !== null && (
          <span style={{ flex: "0 0 auto", color: "#8798a6", fontVariantNumeric: "tabular-nums" }}>
            {width} × {height}px
          </span>
        )}
      </div>
      <div style={{
        height: measurement.imageHeight,
        boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 6,
        backgroundColor: "#20262b",
        backgroundImage: "linear-gradient(45deg,#2b3238 25%,transparent 25%),linear-gradient(-45deg,#2b3238 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2b3238 75%),linear-gradient(-45deg,transparent 75%,#2b3238 75%)",
        backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
      }}>
        {hasVisual ? (
          imageUrl ? (
            <img src={imageUrl} alt="" style={{ display: "block", maxWidth: "100%", maxHeight: 200, objectFit: "contain" }} />
          ) : (
            <canvas
              ref={canvasRef}
              width={Math.max(1, Math.round(renderWidth))}
              height={Math.max(1, Math.round(renderHeight))}
              style={{ display: "block", width: renderWidth, height: renderHeight, objectFit: "contain" }}
            />
          )
        ) : (
          <span style={{ padding: "36px 12px", color: status === "missing" ? "#d99a9a" : "#aebbc6", fontSize: 12, fontWeight: 600 }}>
            {status === "missing" ? "원본 파일을 찾을 수 없습니다" : "빈 레이어"}
          </span>
        )}
      </div>
    </div>
  );
}
