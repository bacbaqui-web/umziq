import {
  TIMELINE_GROUP_GAP_PX,
  type TimelineTrackOverlayViewModel,
} from "@/engines/timeline";

export default function TimelineTrackOverlays({ viewModel, contentWidth }: {
  viewModel: TimelineTrackOverlayViewModel;
  contentWidth: number;
}) {
  const grid = [
    `repeating-linear-gradient(to right, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent ${viewModel.frameGridMinorStep}px)`,
    `repeating-linear-gradient(to right, rgba(255,255,255,0.09) 0, rgba(255,255,255,0.09) 1px, transparent 1px, transparent ${viewModel.frameGridMajorStep}px)`,
  ].join(", ");
  return (
    <>
      {viewModel.totalTrackGridRows > 0 && <>
        <div style={{ gridColumn: 2, gridRow: `2 / span ${viewModel.totalTrackGridRows}`, position: "relative", zIndex: 0, width: contentWidth, minWidth: contentWidth, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 0, backgroundColor: "#22252a", backgroundImage: grid }} />
        </div>
        <div style={{ gridColumn: 2, gridRow: `2 / span ${viewModel.totalTrackGridRows}`, position: "relative", zIndex: 3, width: contentWidth, minWidth: contentWidth, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: viewModel.playheadLeft, top: 0, bottom: 0, width: 2, background: "rgba(245,165,36,0.95)", boxShadow: "0 0 0 1px rgba(245,165,36,0.18)" }} />
        </div>
      </>}
      {viewModel.selectedBlocks.map((block) => (
        <div key={block.key} style={{ gridColumn: "1 / span 2", gridRow: `${block.startRow} / span ${block.span}`, position: "relative", pointerEvents: "none", zIndex: 4 }}>
          <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(214, 78, 61, 0.96)", borderRadius: 6, background: "transparent", boxShadow: "0 0 0 1px rgba(214, 78, 61, 0.12)" }} />
        </div>
      ))}
      {viewModel.groupGaps.map((gap) => <div key={gap.key} style={{ gridColumn: "1 / span 2", gridRow: gap.row, height: TIMELINE_GROUP_GAP_PX, pointerEvents: "none" }} />)}
    </>
  );
}
