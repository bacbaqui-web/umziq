import type { PropertiesPanelProps } from "@/features/properties/types/propertiesPanelTypes";

type PropertiesKeyframeSectionProps = Pick<
  PropertiesPanelProps,
  | "selectedLayer"
  | "selectedTimelineComp"
  | "selectedPropertyState"
  | "selectedKeyframe"
  | "selectedMeta"
  | "defaultFrameRate"
  | "propertyLabels"
  | "formatCompactTime"
  | "onSavePositionKeyframe"
  | "onDeleteSelectedKeyframe"
>;

export default function PropertiesKeyframeSection({
  selectedLayer,
  selectedTimelineComp,
  selectedPropertyState,
  selectedKeyframe,
  selectedMeta,
  defaultFrameRate,
  propertyLabels,
  formatCompactTime,
  onSavePositionKeyframe,
  onDeleteSelectedKeyframe,
}: PropertiesKeyframeSectionProps) {
  if (!selectedLayer && !selectedTimelineComp) {
    return null;
  }

  return (
    <>
      <div style={{ fontWeight: 700, marginTop: 14, marginBottom: 8 }}>
        Keyframe Actions
      </div>
      {selectedLayer && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 7,
            border: "1px solid #313131",
            background: "#202020",
          }}
        >
          <div style={{ fontSize: 12, color: "#aab7c4" }}>
            수동 저장은 위치 키프레임만 지원합니다.
          </div>
          <button
            onClick={onSavePositionKeyframe}
            disabled={!selectedPropertyState.position}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #35556d",
              background: selectedPropertyState.position ? "#1e3344" : "#262a2e",
              color: selectedPropertyState.position ? "#fff" : "#79838d",
              cursor: selectedPropertyState.position ? "pointer" : "not-allowed",
            }}
          >
            위치 키프레임 저장
          </button>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: "#aab7c4" }}>
        선택된 키프레임:{" "}
        {selectedKeyframe
          ? `${propertyLabels[selectedKeyframe.property]} · ${formatCompactTime(
              selectedKeyframe.frame,
              selectedMeta?.frameRate ?? defaultFrameRate
            )}`
          : "없음"}
      </div>
      {selectedKeyframe && (
        <button
          onClick={onDeleteSelectedKeyframe}
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #6a3b3b",
            background: "#3a2222",
            color: "#fff",
          }}
        >
          선택된 키프레임 삭제
        </button>
      )}
    </>
  );
}
