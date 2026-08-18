import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  TIMELINE_PROPERTY_ROW_HEIGHT,
  type TimelineFormulaRowViewModel,
  type TimelineInteractionCommands,
} from "@/engines/timeline";

type ClipDraft = Pick<TimelineFormulaRowViewModel, "startFrame" | "durationFrames" | "transitionFrames">;

function buildOpacitySegments(clip: ClipDraft) {
  const boundaries = [
    0,
    ...clip.transitionFrames.filter((frame) => frame >= 0 && frame < clip.durationFrames),
    clip.durationFrames,
  ];
  return boundaries.slice(0, -1).map((startFrame, index) => ({
    startFrame,
    durationFrames: Math.max(0, (boundaries[index + 1] ?? startFrame) - startFrame),
    visible: index % 2 === 0,
  }));
}

export default function TimelineFormulaTrackRow({ viewModel, contentWidth, interactions }: {
  viewModel: TimelineFormulaRowViewModel;
  contentWidth: number;
  interactions: TimelineInteractionCommands;
}) {
  const [draft, setDraft] = useState<ClipDraft | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);
  const current = draft ?? viewModel;
  const globalLeft = viewModel.item.startFrame + current.startFrame - viewModel.item.sourceOffsetFrames;
  const trackLeft = globalLeft * viewModel.pxPerFrame;
  const trackWidth = current.durationFrames * viewModel.pxPerFrame;
  const opacitySegments = buildOpacitySegments(current);

  const begin = (
    event: PointerEvent,
    kind: "move" | "start" | "end" | "transition",
    transitionIndex = -1
  ) => {
    event.preventDefault();
    event.stopPropagation();
    cleanupRef.current?.();
    const captureTarget = event.currentTarget;
    const pointerId = event.pointerId;
    captureTarget.setPointerCapture(pointerId);
    const initial: ClipDraft = {
      startFrame: viewModel.startFrame,
      durationFrames: viewModel.durationFrames,
      transitionFrames: [...viewModel.transitionFrames],
    };
    const startX = event.clientX;
    let latest = initial;
    const move = (pointer: globalThis.PointerEvent) => {
      if (pointer.buttons === 0) {
        end();
        return;
      }
      const delta = Math.round((pointer.clientX - startX) / Math.max(0.001, viewModel.pxPerFrame));
      if (kind === "move") {
        latest = { ...initial, startFrame: initial.startFrame + delta };
      } else if (kind === "start") {
        const applied = Math.min(initial.durationFrames - 1, delta);
        latest = {
          startFrame: initial.startFrame + applied,
          durationFrames: initial.durationFrames - applied,
          transitionFrames: initial.transitionFrames
            .map((frame) => frame - applied)
            .filter((frame) => frame >= 0 && frame < initial.durationFrames - applied),
        };
      } else if (kind === "end") {
        const durationFrames = Math.max(1, initial.durationFrames + delta);
        latest = {
          ...initial,
          durationFrames,
          transitionFrames: initial.transitionFrames.filter((frame) => frame < durationFrames),
        };
      } else {
        const transitionFrames = [...initial.transitionFrames];
        transitionFrames[transitionIndex] = Math.max(0, Math.min(initial.durationFrames - 1, (transitionFrames[transitionIndex] ?? 0) + delta));
        latest = { ...initial, transitionFrames: transitionFrames.sort((left, right) => left - right) };
      }
      setDraft(latest);
    };
    const end = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setDraft(null);
      interactions.setMouthBasicClip(viewModel.item.id, {
        startFrame: latest.startFrame,
        durationFrames: latest.durationFrames,
        transitionFrames: [...latest.transitionFrames],
      });
    };
    const cancel = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setDraft(null);
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
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end, true);
    document.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", end);
    document.documentElement.addEventListener("mouseleave", end);
    captureTarget.addEventListener("lostpointercapture", end);
  };

  return (
    <div style={{ display: "contents" }}>
      <div style={{ gridColumn: 1, gridRow: viewModel.rowIndex, height: TIMELINE_PROPERTY_ROW_HEIGHT, padding: "0 8px 0 4px", display: "flex", alignItems: "center", justifyContent: "flex-end", color: "#c9ead8", fontSize: 10, boxSizing: "border-box" }}>
        <span style={{ width: 5, height: 1, marginRight: 6, background: "#55b97c" }} />
        <span>수식 · {viewModel.label}</span>
      </div>
      <div style={{ gridColumn: 2, gridRow: viewModel.rowIndex, position: "relative", width: contentWidth, minWidth: contentWidth, height: TIMELINE_PROPERTY_ROW_HEIGHT, overflow: "visible" }}>
        <div
          role="button"
          aria-label="입뻥긋 수식 클립 이동"
          onPointerDown={(event) => begin(event, "move")}
          style={{ position: "absolute", left: trackLeft, top: 1, width: Math.max(2, trackWidth), height: 14, borderRadius: 3, border: "1px solid #57b77b", background: "transparent", boxSizing: "border-box", cursor: draft ? "grabbing" : "grab", overflow: "visible" }}
        >
          <span style={{ position: "absolute", inset: 0, borderRadius: 2, overflow: "hidden", pointerEvents: "none" }}>
            {opacitySegments.map((segment, index) => (
              <span
                key={`${index}-${segment.startFrame}`}
                style={{
                  position: "absolute",
                  left: segment.startFrame * viewModel.pxPerFrame,
                  top: 0,
                  width: segment.durationFrames * viewModel.pxPerFrame,
                  height: "100%",
                  background: segment.visible
                    ? "linear-gradient(90deg, rgba(43,108,70,.95), rgba(53,132,84,.95))"
                    : "rgba(53,132,84,.2)",
                }}
              />
            ))}
          </span>
          <span onPointerDown={(event) => begin(event, "start")} style={{ position: "absolute", left: -3, top: -1, width: 6, height: 14, cursor: "ew-resize", zIndex: 4 }} />
          <span onPointerDown={(event) => begin(event, "end")} style={{ position: "absolute", right: -3, top: -1, width: 6, height: 14, cursor: "ew-resize", zIndex: 4 }} />
          {current.transitionFrames.map((frame, index) => (
            <span
              key={`${index}-${frame}`}
              title={`${frame}f`}
              onPointerDown={(event) => begin(event, "transition", index)}
              style={{ position: "absolute", left: frame * viewModel.pxPerFrame - 2, top: 1, width: 4, height: 10, cursor: "ew-resize", zIndex: 3 }}
            >
              <span style={{ position: "absolute", left: 1, top: 0, width: 1, height: 10, background: "rgba(226,255,236,.86)" }} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
