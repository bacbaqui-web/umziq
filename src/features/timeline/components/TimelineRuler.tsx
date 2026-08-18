import type { RefObject } from "react";
import { TIMELINE_POST_ROLL_PX, type TimelineCommands, type TimelineRulerViewModel } from "@/engines/timeline";
import TimelineDurationSplitEditor from "@/features/timeline/components/TimelineDurationSplitEditor";

type Props = {
  viewModel: TimelineRulerViewModel;
  commands: TimelineCommands;
  rulerRef: RefObject<HTMLDivElement | null>;
};

export default function TimelineRuler({ viewModel, commands, rulerRef }: Props) {
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <TimelineDurationSplitEditor viewModel={viewModel.rangeDuration} onCommit={commands.commitRangeDuration} />
        <TimelineDurationSplitEditor viewModel={viewModel.timelineDuration} onCommit={commands.commitTimelineDuration} />
      </div>
      <div
        ref={rulerRef}
        onMouseMove={(event) => commands.setHoveredFrameFromPointer(event.clientX)}
        onMouseLeave={commands.leaveRuler}
        onPointerDown={(event) => commands.beginScrub({ clientX: event.clientX, pointerId: event.pointerId, captureTarget: event.currentTarget })}
        style={{ position: "relative", height: 30, overflow: "hidden", border: "1px solid #3a3a3a", borderLeft: "none", borderRadius: "0 6px 6px 0", background: "#202020", cursor: viewModel.hideCursor ? "none" : "crosshair" }}
      >
        <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: viewModel.timelineOriginLeft, borderRight: "2px solid rgba(255,255,255,0.24)", boxSizing: "border-box", background: "linear-gradient(to right, rgba(8,10,13,0.48), rgba(8,10,13,0))", zIndex: 4, pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: TIMELINE_POST_ROLL_PX, borderLeft: "2px solid rgba(255,255,255,0.24)", boxSizing: "border-box", background: "linear-gradient(to left, rgba(8,10,13,0.48), rgba(8,10,13,0))", zIndex: 4, pointerEvents: "none" }} />
        <div style={{ position: "absolute", left: viewModel.playbackRangeLeft, top: 3, height: 24, width: viewModel.playbackRangeWidth, borderRadius: 0, background: "rgba(245, 165, 36, 0.2)", border: "1px solid rgba(245, 165, 36, 0.7)", boxSizing: "border-box", pointerEvents: "none", zIndex: 2 }}>
          {(["start", "end"] as const).map((handle) => (
            <div key={handle} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); commands.beginRangeResize({ clientX: event.clientX, pointerId: event.pointerId, captureTarget: event.currentTarget }, handle); }}
              style={{ position: "absolute", [handle === "start" ? "left" : "right"]: -4, top: -1, bottom: -1, width: 10, background: "transparent", cursor: "ew-resize", pointerEvents: "auto" }}>
              <div style={{ position: "absolute", [handle === "start" ? "left" : "right"]: 4, top: 1, bottom: 1, width: 2, borderRadius: 999, background: "rgba(255, 218, 128, 0.95)", boxShadow: "0 0 0 1px rgba(0,0,0,0.14)" }} />
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: viewModel.timelineOriginLeft, top: 0, width: viewModel.frames.length * viewModel.pxPerFrame, height: "100%" }}>
          {viewModel.frames.map((frame) => (
            <div key={frame.frame} style={{ position: "absolute", left: frame.frame * viewModel.pxPerFrame, top: 0, width: viewModel.pxPerFrame, height: "100%" }}>
              <div style={{ position: "absolute", left: 0, top: frame.tickTop, height: frame.tickHeight, width: 1, background: frame.tickColor }} />
              {frame.label && <span style={{ position: "absolute", left: 4, top: 6, fontSize: 11, color: "#bbb" }}>{frame.label}</span>}
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: viewModel.indicator.left, top: 0, bottom: 0, width: viewModel.indicator.width, background: viewModel.indicator.background, boxShadow: viewModel.indicator.boxShadow, pointerEvents: "none", zIndex: viewModel.indicator.zIndex }} />
        {viewModel.hoverIndicator && (
          <div style={{ position: "absolute", left: viewModel.hoverIndicator.left, top: 0, bottom: 0, width: viewModel.hoverIndicator.width, background: viewModel.hoverIndicator.background, pointerEvents: "none", zIndex: viewModel.hoverIndicator.zIndex }} />
        )}
        {viewModel.activeReadout && (
          <div style={{ position: "absolute", left: Math.max(4, viewModel.activeReadout.left - 18), top: "50%", transform: "translateY(-50%)", padding: "2px 6px", borderRadius: 999, background: viewModel.activeReadout.mode === "hover" ? "rgba(18, 22, 28, 0.94)" : "rgba(55, 59, 66, 0.92)", border: viewModel.activeReadout.mode === "hover" ? "1px solid #3d4d5c" : "1px solid rgba(132, 138, 150, 0.55)", color: viewModel.activeReadout.mode === "hover" ? "#dbe7f2" : "#eef2f6", fontSize: 11, lineHeight: 1.2, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10 }}>
            {viewModel.activeReadout.text}
          </div>
        )}
      </div>
      {viewModel.showInteractionShield && (
        <div
          aria-hidden="true"
          style={{ position: "fixed", inset: 0, cursor: "none", background: "transparent", zIndex: 999 }}
        />
      )}
    </>
  );
}
