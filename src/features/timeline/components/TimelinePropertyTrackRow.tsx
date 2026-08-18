import {
  TIMELINE_PROPERTY_ROW_HEIGHT,
  type TimelineInteractionCommands,
  type TimelinePropertyRowViewModel,
} from "@/engines/timeline";

export default function TimelinePropertyTrackRow({ viewModel, contentWidth, interactions }: {
  viewModel: TimelinePropertyRowViewModel;
  contentWidth: number;
  interactions: TimelineInteractionCommands;
}) {
  const { item, property, colors } = viewModel;
  return (
    <div style={{ display: "contents" }}>
      <div style={{ gridColumn: 1, gridRow: viewModel.rowIndex, position: "relative", zIndex: 1, padding: "0 8px 0 4px", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", minWidth: 0, textAlign: "right", color: viewModel.selectedTimelineItem ? colors.label : colors.accentMuted, opacity: 0.95, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", lineHeight: 1, height: TIMELINE_PROPERTY_ROW_HEIGHT, backgroundColor: "transparent", border: "none", boxSizing: "border-box" }}>
        <span style={{ width: 5, height: 1, background: colors.accentMuted, marginRight: 6, flex: "0 0 auto" }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewModel.label}</span>
      </div>
      <div style={{ gridColumn: 2, gridRow: viewModel.rowIndex, position: "relative", zIndex: viewModel.dragging ? 12 : 2, width: contentWidth, minWidth: contentWidth, height: TIMELINE_PROPERTY_ROW_HEIGHT, overflow: "visible", backgroundColor: "transparent", cursor: viewModel.dragging ? "none" : "default", border: "none", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", left: viewModel.trackLeft, top: 5, height: 2, width: viewModel.trackWidth, background: colors.accentMuted, pointerEvents: "none", opacity: 0.8 }} />
        {viewModel.keyframes.map((keyframe) => (
          <button key={`${item.id}-${property}-${keyframe.frame}`}
            onClick={(event) => { event.stopPropagation(); interactions.selectKeyframe(item.id, keyframe.frame, property); }}
            onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); interactions.selectKeyframe(item.id, keyframe.frame, property); interactions.beginMoveKeyframe({ clientX: event.clientX, pointerId: event.pointerId, captureTarget: event.currentTarget }, item.id, keyframe.frame, property); }}
            title={keyframe.title}
            style={{ position: "absolute", left: keyframe.left, top: -1, width: 14, height: 14, padding: 0, border: "none", background: "transparent", cursor: keyframe.dragging ? "none" : "pointer", zIndex: 3 }}>
            <span style={{ position: "absolute", left: 4, top: 4, width: 6, height: 6, borderRadius: 1, border: keyframe.selected ? "1px solid #ffd76b" : `1px solid ${colors.accent}`, background: keyframe.selected ? "#ffd76b" : "#d7e4f2", transform: keyframe.dragging ? "rotate(45deg) scale(1.15)" : "rotate(45deg)", boxShadow: keyframe.selected ? "0 0 0 2px rgba(255, 215, 107, 0.18)" : keyframe.dragging ? "0 0 0 2px rgba(171, 212, 255, 0.18)" : "none", transition: "transform 60ms linear, box-shadow 60ms linear", pointerEvents: "none" }} />
          </button>
        ))}
        {viewModel.draggingDisplayLeft !== null && <div style={{ position: "absolute", left: viewModel.draggingDisplayLeft, top: -1, width: 14, height: 14, zIndex: 5, pointerEvents: "none" }}><span style={{ position: "absolute", left: 4, top: 4, width: 6, height: 6, borderRadius: 1, border: "1px solid #ffd76b", background: "#d7e4f2", transform: "rotate(45deg) scale(1.15)", boxShadow: "0 0 0 2px rgba(171, 212, 255, 0.18)" }} /></div>}
        {viewModel.draggingReadoutLeft !== null && viewModel.draggingReadoutText && <div style={{ position: "absolute", left: viewModel.draggingReadoutLeft, top: -7, padding: "1px 6px", borderRadius: 999, border: "1px solid rgba(92, 106, 122, 0.88)", background: "rgba(17, 22, 29, 0.95)", color: "#dbe7f2", fontSize: 10, lineHeight: 1.3, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 20 }}>{viewModel.draggingReadoutText}</div>}
      </div>
    </div>
  );
}
