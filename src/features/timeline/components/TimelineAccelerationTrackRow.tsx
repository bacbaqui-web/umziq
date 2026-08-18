import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  TIMELINE_PROPERTY_ROW_HEIGHT,
  type TimelineFormulaRowViewModel,
  type TimelineInteractionCommands,
} from "@/engines/timeline";

const CURVE_PATHS = {
  "ease-out-soft": "M2 12 C15 2 31 1 46 1",
  "ease-out-strong": "M2 12 C8 1 27 1 46 1",
  "ease-in-soft": "M2 12 C17 12 33 11 46 1",
  "ease-in-strong": "M2 12 C21 12 40 12 46 1",
} as const;

export default function TimelineAccelerationTrackRow({ viewModel, contentWidth, interactions }: {
  viewModel: TimelineFormulaRowViewModel;
  contentWidth: number;
  interactions: TimelineInteractionCommands;
}) {
  const [draft, setDraft] = useState<{ startFrame: number; durationFrames: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);
  const current = draft ?? viewModel;
  const globalLeft = viewModel.item.startFrame + current.startFrame - viewModel.item.sourceOffsetFrames;
  const left = globalLeft * viewModel.pxPerFrame;
  const width = current.durationFrames * viewModel.pxPerFrame;

  const begin = (event: PointerEvent, kind: "move" | "start" | "end") => {
    event.preventDefault();
    event.stopPropagation();
    cleanupRef.current?.();
    const captureTarget = event.currentTarget;
    const pointerId = event.pointerId;
    captureTarget.setPointerCapture(pointerId);
    const initial = { startFrame: viewModel.startFrame, durationFrames: viewModel.durationFrames };
    const startX = event.clientX;
    let latest = initial;
    const move = (pointer: globalThis.PointerEvent) => {
      if (pointer.buttons === 0) {
        end();
        return;
      }
      const delta = Math.round((pointer.clientX - startX) / Math.max(0.001, viewModel.pxPerFrame));
      if (kind === "move") latest = { ...initial, startFrame: initial.startFrame + delta };
      if (kind === "start") {
        const applied = Math.min(initial.durationFrames - 1, delta);
        latest = { startFrame: initial.startFrame + applied, durationFrames: initial.durationFrames - applied };
      }
      if (kind === "end") latest = { ...initial, durationFrames: Math.max(1, initial.durationFrames + delta) };
      setDraft(latest);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end, true);
      document.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", end);
      document.documentElement.removeEventListener("mouseleave", end);
      captureTarget.removeEventListener("lostpointercapture", end);
      if (captureTarget.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId);
    };
    const end = () => {
      cleanup();
      cleanupRef.current = null;
      setDraft(null);
      interactions.setAccelerationClip(viewModel.item.id, latest);
    };
    const cancel = () => {
      cleanup();
      cleanupRef.current = null;
      setDraft(null);
    };
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", end);
    document.documentElement.addEventListener("mouseleave", end);
    captureTarget.addEventListener("lostpointercapture", end);
  };

  const propertyLabel = (viewModel.accelerationProperties ?? []).map((property) => ({
    position: "위치", scale: "크기", rotation: "회전", opacity: "투명도",
  })[property]).join("+");
  const curve = viewModel.accelerationCurve ?? "ease-out-soft";

  return (
    <div style={{ display: "contents" }}>
      <div style={{ gridColumn: 1, gridRow: viewModel.rowIndex, height: TIMELINE_PROPERTY_ROW_HEIGHT, padding: "0 8px 0 4px", display: "flex", alignItems: "center", justifyContent: "flex-end", color: "#b9daf0", fontSize: 10, boxSizing: "border-box" }}>
        <span style={{ width: 5, height: 1, marginRight: 6, background: "#64a8d2" }} />
        <span>가속·감속 · {propertyLabel}</span>
      </div>
      <div style={{ gridColumn: 2, gridRow: viewModel.rowIndex, position: "relative", width: contentWidth, minWidth: contentWidth, height: TIMELINE_PROPERTY_ROW_HEIGHT }}>
        <div role="button" aria-label="가속 감속 범위 이동" onPointerDown={(event) => begin(event, "move")} style={{ position: "absolute", left, top: 1, width: Math.max(2, width), height: 14, borderRadius: 3, border: "1px solid #64a8d2", background: "rgba(45,92,121,.72)", boxSizing: "border-box", cursor: draft ? "grabbing" : "grab", overflow: "visible" }}>
          <span onPointerDown={(event) => begin(event, "start")} style={{ position: "absolute", left: -3, top: -1, width: 6, height: 14, cursor: "ew-resize", zIndex: 3 }} />
          <span onPointerDown={(event) => begin(event, "end")} style={{ position: "absolute", right: -3, top: -1, width: 6, height: 14, cursor: "ew-resize", zIndex: 3 }} />
          {width >= 24 && (
            <svg viewBox="0 0 48 14" preserveAspectRatio="none" width="100%" height="12" style={{ display: "block", pointerEvents: "none" }}>
              <path d={CURVE_PATHS[curve]} fill="none" stroke="rgba(211,239,255,.9)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
