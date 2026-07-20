import type {
  PropertiesCommand,
  PropertiesPropertyRowViewModel,
} from "@/engines/properties";
import PropertiesTransformRow from "@/features/properties/components/PropertiesTransformRow";

type PropertiesPropertyRowProps = {
  viewModel: PropertiesPropertyRowViewModel;
  commands: PropertiesCommand;
};

export default function PropertiesPropertyRow({
  viewModel,
  commands,
}: PropertiesPropertyRowProps) {
  return (
    <PropertiesTransformRow
      label={viewModel.label}
      active={viewModel.enabled}
      inputs={viewModel.inputs}
      tokens={viewModel.tokens}
      commands={commands}
      leadingControl={(
        <input
          type="checkbox"
          checked={viewModel.enabled}
          onChange={(event) =>
            commands.togglePropertyTrack(viewModel.property, event.target.checked)
          }
          style={{ margin: 0, accentColor: viewModel.tokens.accent }}
        />
      )}
      trailingControl={viewModel.scaleLinked !== null ? (
        <button
          className="ui-button ui-button--icon"
          type="button"
          onClick={commands.toggleScaleLink}
          disabled={!viewModel.editable}
          title={viewModel.scaleLinked ? "X/Y 연동 해제" : "X/Y 연동"}
          style={{
            width: 28,
            height: 28,
            border: `1px solid ${viewModel.scaleLinked ? "#5d7fa1" : "#3a4047"}`,
            background: viewModel.scaleLinked ? viewModel.tokens.accentSoft : "#1c1f22",
            color: viewModel.scaleLinked ? viewModel.tokens.label : "#8c96a1",
            fontSize: 12,
            cursor: viewModel.editable ? "pointer" : "default",
            opacity: viewModel.editable ? 1 : 0.55,
          }}
        >
          {viewModel.scaleLinked ? "⛓" : "⛓︎"}
        </button>
      ) : undefined}
    />
  );
}
