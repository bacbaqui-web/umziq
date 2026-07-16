import type {
  PropertiesCommand,
  PropertiesKeyframeViewModel,
} from "@/engines/properties";

type PropertiesKeyframeSectionProps = {
  viewModel: PropertiesKeyframeViewModel;
  commands: PropertiesCommand;
};

export default function PropertiesKeyframeSection({
  viewModel,
  commands,
}: PropertiesKeyframeSectionProps) {
  if (!viewModel.visible) return null;

  return (
    <>
      <div style={{ fontWeight: 700, marginTop: 14, marginBottom: 8 }}>
        Keyframe Actions
      </div>
      {viewModel.showPositionSave && (
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
            onClick={commands.savePositionKeyframe}
            disabled={!viewModel.canSavePosition}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #35556d",
              background: viewModel.canSavePosition ? "#1e3344" : "#262a2e",
              color: viewModel.canSavePosition ? "#fff" : "#79838d",
              cursor: viewModel.canSavePosition ? "pointer" : "not-allowed",
            }}
          >
            위치 키프레임 저장
          </button>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: "#aab7c4" }}>
        선택된 키프레임: {viewModel.selectedText}
      </div>
      {viewModel.canDeleteSelected && (
        <button
          onClick={commands.deleteSelectedKeyframe}
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
