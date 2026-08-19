import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  TimelineInteractionCommands,
  TimelineItemRowViewModel,
} from "@/engines/timeline";

export default function TimelineItemTrackClip({
  viewModel,
  contentWidth,
  interactions,
  onContextMenu,
}: {
  viewModel: TimelineItemRowViewModel;
  contentWidth: number;
  interactions: TimelineInteractionCommands;
  onContextMenu: (
    event: ReactMouseEvent<HTMLElement>
  ) => void;
}) {
  const item = viewModel.item;
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={() =>
        interactions.reorderTimelineItem(item.id)
      }
      onClick={() =>
        interactions.toggleTimelineItemSelection(item.id)
      }
      onContextMenu={onContextMenu}
      style={{
        gridColumn: 2,
        gridRow: viewModel.rowIndex,
        position: "relative",
        zIndex: 2,
        width: contentWidth,
        minWidth: contentWidth,
        height: viewModel.rowHeight,
        border: "none",
        borderRadius: 0,
        overflow: "visible",
        clipPath: "inset(0 -10000px 0 0)",
        background: "transparent",
        boxSizing: "border-box",
      }}
    >
      {viewModel.source.isDeletePending && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(133, 46, 52, 0.18)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: viewModel.sourceTrackLeft,
          top: 5,
          height: viewModel.rowHeight - 10,
          width: viewModel.sourceTrackWidth,
          borderRadius: 2,
          background: viewModel.trackBackground,
          opacity: 0.22,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: viewModel.trackLeft,
          top: 5,
          height: viewModel.rowHeight - 10,
          width: viewModel.trackWidth,
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.12)",
          background: viewModel.trackBackground,
          opacity: viewModel.trackOpacity,
          display: "flex",
          alignItems: "center",
          paddingLeft: 0,
          paddingRight: 0,
          boxSizing: "border-box",
          color: "#fff",
          fontSize: 11,
          cursor: "grab",
          minWidth: 12,
          zIndex: 2,
          boxShadow: "inset 1px 0 0 rgba(0,0,0,0.26), inset -1px 0 0 rgba(0,0,0,0.26)",
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          interactions.beginMoveTimelineItem({
            clientX: event.clientX,
            pointerId: event.pointerId,
            captureTarget: event.currentTarget,
          }, item.id);
        }}
        onClick={(event) => {
          event.stopPropagation();
          interactions.activateTimelineItemTrack(item.id);
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(13, 18, 23, 0.62)",
            pointerEvents: "none",
          }}
        />
        {viewModel.visibleTrackWidth > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: viewModel.visibleTrackLeft,
              top: 0,
              bottom: 0,
              width: viewModel.visibleTrackWidth,
              background: viewModel.trackBackground,
              pointerEvents: "none",
            }}
          />
        )}
        {item.mediaKind === "audio" &&
          viewModel.waveform.length > 0 && (
            <svg
              viewBox={`0 0 ${viewModel.waveform.length} ${viewModel.rowHeight - 10}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                opacity: 0.82,
              }}
            >
              {viewModel.waveform.map((peak, index) => {
                const waveformHeight = viewModel.rowHeight - 10;
                const height = Math.max(
                  1,
                  Math.min(
                    waveformHeight - 2,
                    peak * (waveformHeight - 2)
                  )
                );
                return (
                  <line
                    key={index}
                    x1={index + 0.5}
                    x2={index + 0.5}
                    y1={waveformHeight / 2 - height / 2}
                    y2={waveformHeight / 2 + height / 2}
                    stroke="#d3f4df"
                    strokeWidth="0.7"
                  />
                );
              })}
            </svg>
          )}
        {(["start", "end"] as const).map((edge) => (
          <div
            key={edge}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              const start = {
                clientX: event.clientX,
                pointerId: event.pointerId,
                captureTarget: event.currentTarget,
              };
              if (edge === "start") {
                interactions.beginResizeTimelineItemStart(
                  start,
                  item.id
                );
              } else {
                interactions.beginResizeTimelineItemEnd(
                  start,
                  item.id
                );
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
              interactions.activateTimelineItemTrack(item.id);
            }}
            style={{
              position: "absolute",
              [edge === "start" ? "left" : "right"]: 0,
              top: 0,
              bottom: 0,
              width: 8,
              cursor: "ew-resize",
            }}
          />
        ))}
      </div>
    </div>
  );
}
