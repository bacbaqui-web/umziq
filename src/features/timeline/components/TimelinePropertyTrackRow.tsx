import type { TimelineRow } from "@/editor/types/editorViewTypes";
import { getPropertyVisualTokens } from "@/features/propertyVisualTokens";
import { isTimelineItemSelected } from "@/features/timeline/timelineSelectionUtils";
import { TIMELINE_PROPERTY_ROW_HEIGHT } from "@/features/timeline/timelineUiConstants";
import type { TimelinePanelProps } from "@/features/timeline/types/timelineTypes";

type TimelinePropertyTrackRowProps = Pick<
  TimelinePanelProps,
  | "selectedMeta"
  | "timelinePxPerFrame"
  | "timelineContentWidth"
  | "selectedTimelineTarget"
  | "selectedKeyframe"
  | "draggingKeyframe"
  | "draggingKeyframeDisplayFrame"
  | "propertyLabels"
  | "allLayersById"
  | "allCompositionsById"
  | "formatCompactTime"
  | "onSelectKeyframe"
  | "onBeginMoveKeyframe"
> & {
  row: Extract<TimelineRow, { type: "property" }>;
  rowIndex: number;
};

export default function TimelinePropertyTrackRow({
  row,
  selectedMeta,
  timelinePxPerFrame,
  timelineContentWidth,
  selectedTimelineTarget,
  selectedKeyframe,
  draggingKeyframe,
  draggingKeyframeDisplayFrame,
  propertyLabels,
  allLayersById,
  allCompositionsById,
  formatCompactTime,
  onSelectKeyframe,
  onBeginMoveKeyframe,
  rowIndex,
}: TimelinePropertyTrackRowProps) {
  if (!selectedMeta) {
    return null;
  }

  const { item, property } = row;
  const layer = item.kind === "layer" ? allLayersById.get(item.sourceId) : null;
  const composition =
    item.kind === "subComp" ? allCompositionsById.get(item.sourceId) ?? null : null;
  const propertyKeyframes =
    property === "position"
      ? item.kind === "layer"
        ? layer?.positionKeyframes ?? []
        : composition?.positionKeyframes ?? []
      : property === "scale"
        ? item.kind === "layer"
          ? layer?.scaleKeyframes ?? []
          : composition?.scaleKeyframes ?? []
        : property === "rotation"
          ? item.kind === "layer"
            ? layer?.rotationKeyframes ?? []
            : composition?.rotationKeyframes ?? []
          : item.kind === "layer"
          ? layer?.opacityKeyframes ?? []
            : composition?.opacityKeyframes ?? [];
  const colors = getPropertyVisualTokens(property);
  const isSelectedTimelineItem = isTimelineItemSelected(selectedTimelineTarget, item);
  const draggedKeyframeOriginalFrame =
    draggingKeyframe?.targetId === item.sourceId && draggingKeyframe.property === property
      ? draggingKeyframe.originFrame ?? draggingKeyframe.frame
      : null;
  const isDraggingThisProperty =
    draggingKeyframe?.targetId === item.sourceId && draggingKeyframe.property === property;

  return (
    <div style={{ display: "contents" }}>
      <div
        style={{
          gridColumn: 1,
          gridRow: rowIndex,
          position: "relative",
          zIndex: 1,
          padding: "0 8px 0 4px",
          fontSize: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          minWidth: 0,
          textAlign: "right",
          color: isSelectedTimelineItem ? colors.label : colors.accentMuted,
          opacity: 0.95,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          lineHeight: 1,
          height: TIMELINE_PROPERTY_ROW_HEIGHT,
          backgroundColor: "transparent",
          border: "none",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            width: 5,
            height: 1,
            background: colors.accentMuted,
            marginRight: 6,
            flex: "0 0 auto",
          }}
        />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {propertyLabels[property]}
        </span>
      </div>

      <div
        style={{
          gridColumn: 2,
          gridRow: rowIndex,
          position: "relative",
          zIndex: isDraggingThisProperty ? 12 : 2,
          width: timelineContentWidth,
          minWidth: timelineContentWidth,
          height: TIMELINE_PROPERTY_ROW_HEIGHT,
          borderBottom: "1px solid transparent",
          overflow: "visible",
          backgroundColor: "transparent",
          cursor: isDraggingThisProperty ? "none" : "default",
          border: "none",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: item.startFrame * timelinePxPerFrame,
            top: 5,
            height: 2,
            width: item.durationFrames * timelinePxPerFrame,
            background: colors.accentMuted,
            pointerEvents: "none",
            opacity: 0.8,
          }}
        />

        {propertyKeyframes.map((keyframe) => {
          if (draggedKeyframeOriginalFrame !== null && keyframe.frame === draggedKeyframeOriginalFrame) {
            return null;
          }

          const targetKind = item.kind === "layer" ? "layer" : "composition";
          const isSelectedPropertyKeyframe =
            selectedKeyframe?.targetId === item.sourceId &&
            selectedKeyframe.frame === keyframe.frame &&
            selectedKeyframe.property === property;
          const isDraggingPropertyKeyframe =
            draggingKeyframe?.targetId === item.sourceId &&
            draggingKeyframe.frame === keyframe.frame &&
            draggingKeyframe.property === property;

          return (
            <button
              key={`${item.sourceId}-${property}-${keyframe.frame}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectKeyframe(targetKind, item.sourceId, keyframe.frame, property);
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectKeyframe(targetKind, item.sourceId, keyframe.frame, property);
                onBeginMoveKeyframe(event, targetKind, item.sourceId, keyframe.frame, property);
              }}
              title={formatCompactTime(keyframe.frame, selectedMeta.frameRate)}
              style={{
                position: "absolute",
                left: (item.startFrame + keyframe.frame) * timelinePxPerFrame - 7,
                top: -1,
                width: 14,
                height: 14,
                padding: 0,
                border: "none",
                background: "transparent",
                cursor: isDraggingPropertyKeyframe ? "none" : "pointer",
                zIndex: 3,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 4,
                  top: 4,
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  border: isSelectedPropertyKeyframe
                    ? "1px solid #ffd76b"
                    : `1px solid ${colors.accent}`,
                  background: isSelectedPropertyKeyframe ? "#ffd76b" : "#d7e4f2",
                  transform: isDraggingPropertyKeyframe
                    ? "rotate(45deg) scale(1.15)"
                    : "rotate(45deg)",
                  boxShadow: isSelectedPropertyKeyframe
                    ? "0 0 0 2px rgba(255, 215, 107, 0.18)"
                    : isDraggingPropertyKeyframe
                      ? "0 0 0 2px rgba(171, 212, 255, 0.18)"
                      : "none",
                  transition: "transform 60ms linear, box-shadow 60ms linear",
                  pointerEvents: "none",
                }}
              />
            </button>
          );
        })}

        {draggingKeyframeDisplayFrame !== null &&
          draggingKeyframe?.targetId === item.sourceId &&
          draggingKeyframe.property === property && (
            <div
              style={{
                position: "absolute",
                left: draggingKeyframeDisplayFrame * timelinePxPerFrame - 7,
                top: -1,
                width: 14,
                height: 14,
                zIndex: 5,
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 4,
                  top: 4,
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  border: "1px solid #ffd76b",
                  background: "#d7e4f2",
                  transform: "rotate(45deg) scale(1.15)",
                  boxShadow: "0 0 0 2px rgba(171, 212, 255, 0.18)",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}

        {draggingKeyframeDisplayFrame !== null &&
          draggingKeyframe?.targetId === item.sourceId &&
          draggingKeyframe.property === property && (
            <div
              style={{
                position: "absolute",
                left: draggingKeyframeDisplayFrame * timelinePxPerFrame + 10,
                top: -7,
                padding: "1px 6px",
                borderRadius: 999,
                border: "1px solid rgba(92, 106, 122, 0.88)",
                background: "rgba(17, 22, 29, 0.95)",
                color: "#dbe7f2",
                fontSize: 10,
                lineHeight: 1.3,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                zIndex: 20,
              }}
            >
              {formatCompactTime(draggingKeyframe.frame, selectedMeta.frameRate)}
            </div>
          )}

      </div>
    </div>
  );
}
