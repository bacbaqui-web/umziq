import { useSyncExternalStore } from "react";
import type { CanvasFpsRuntime } from "@/engines/canvas";

function resolveFpsColor(fps: number | null): string {
  if (fps === null) return "#7f8a95";
  if (fps >= 50) return "#8ce0b0";
  if (fps >= 30) return "#ffd27a";
  return "#ff8e8e";
}

export default function PreviewCanvasFpsBadge({
  runtime,
}: {
  runtime: CanvasFpsRuntime;
}) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot
  );
  const text = snapshot.status === "idle"
    ? "FPS 대기"
    : snapshot.status === "measuring"
      ? "FPS 측정 중"
      : `FPS ${snapshot.fps}`;

  return (
    <div
      aria-label={`캔버스 ${text}`}
      style={{
        position: "absolute",
        top: 54,
        right: 12,
        zIndex: 39,
        minWidth: 58,
        padding: "5px 8px",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 6,
        background: "rgba(12,15,18,0.78)",
        color: resolveFpsColor(snapshot.fps),
        fontSize: 11,
        fontWeight: 650,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
        textAlign: "center",
        pointerEvents: "none",
        userSelect: "none",
        backdropFilter: "blur(6px)",
      }}
    >
      {text}
    </div>
  );
}
