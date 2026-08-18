import {
  TIMELINE_GROUP_GAP_PX,
  TIMELINE_POST_ROLL_PX,
  type TimelineTrackOverlayViewModel,
} from "@/engines/timeline";
import { Fragment } from "react";

export default function TimelineTrackOverlays({ viewModel, contentWidth, nameColumnWidth }: {
  viewModel: TimelineTrackOverlayViewModel;
  contentWidth: number;
  nameColumnWidth: number;
}) {
  const grid = [
    `repeating-linear-gradient(to right, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent ${viewModel.frameGridMinorStep}px)`,
    `repeating-linear-gradient(to right, rgba(255,255,255,0.09) 0, rgba(255,255,255,0.09) 1px, transparent 1px, transparent ${viewModel.frameGridMajorStep}px)`,
  ].join(", ");
  return (
    <>
      {viewModel.totalTrackGridRows > 0 && <>
        <div style={{ gridColumn: 2, gridRow: `2 / span ${viewModel.totalTrackGridRows}`, position: "relative", zIndex: 0, width: contentWidth, minWidth: contentWidth, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "#22252a", backgroundImage: grid, backgroundPositionX: viewModel.timelineOriginLeft }} />
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: viewModel.timelineOriginLeft, borderRight: "2px solid rgba(255,255,255,0.24)", boxSizing: "border-box" }} />
        </div>
        <div style={{ gridColumn: 2, gridRow: `2 / span ${viewModel.totalTrackGridRows}`, position: "relative", zIndex: 3, width: contentWidth, minWidth: contentWidth, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: viewModel.timelineOriginLeft, background: "linear-gradient(to right, rgba(8,10,13,0.48), rgba(8,10,13,0))" }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: TIMELINE_POST_ROLL_PX, background: "linear-gradient(to left, rgba(8,10,13,0.48), rgba(8,10,13,0))", borderLeft: "2px solid rgba(255,255,255,0.24)", boxSizing: "border-box" }} />
          <div style={{ position: "absolute", left: viewModel.playheadLeft, top: 0, bottom: 0, width: 2, background: "rgba(245,165,36,0.95)", boxShadow: "0 0 0 1px rgba(245,165,36,0.18)" }} />
        </div>
      </>}
      {viewModel.selectedBlocks.map((block) => (
        <Fragment key={block.key}>
          <div style={{ gridColumn: "1 / span 2", gridRow: `${block.startRow} / span ${block.span}`, position: "relative", pointerEvents: "none", zIndex: 1 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: nameColumnWidth + 6 + contentWidth, borderRadius: 6, background: "rgba(196, 49, 42, 0.075)", boxSizing: "border-box" }} />
          </div>
          <div style={{ gridColumn: "1 / span 2", gridRow: `${block.startRow} / span ${block.span}`, position: "relative", pointerEvents: "none", zIndex: 4 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: nameColumnWidth + 6 + contentWidth, border: "1px solid rgba(224, 82, 66, 0.98)", borderRadius: 6, background: "transparent", boxShadow: "0 0 0 1px rgba(224, 82, 66, 0.18), 0 0 10px rgba(224, 82, 66, 0.24), inset 0 0 8px rgba(196, 49, 42, 0.08)", boxSizing: "border-box" }} />
          </div>
        </Fragment>
      ))}
      {viewModel.groupGaps.map((gap) => <div key={gap.key} style={{ gridColumn: "1 / span 2", gridRow: gap.row, height: TIMELINE_GROUP_GAP_PX, pointerEvents: "none" }} />)}
    </>
  );
}
