import type {
  PropertiesCommand,
  PropertiesKeyframeViewModel,
} from "@/engines/visual";

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
      <div className="ui-section-title" style={{ marginTop: 14 }}>
        Keyframe Actions
      </div>
      {viewModel.showPositionSave && (
        <div
          className="ui-card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            boxShadow: "none",
          }}
        >
          <div style={{ fontSize: 12, color: "#aab7c4" }}>
            수동 저장은 위치 키프레임만 지원합니다.
          </div>
          <button
            className="ui-button ui-button--primary"
            onClick={commands.savePositionKeyframe}
            disabled={!viewModel.canSavePosition}
            style={{
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
          className="ui-button ui-button--danger"
          onClick={commands.deleteSelectedKeyframe}
          style={{
            marginTop: 8,
          }}
        >
          선택된 키프레임 삭제
        </button>
      )}
    </>
  );
}
