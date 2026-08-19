import type {
  PropertiesCommand,
  PropertiesTransformOriginViewModel,
} from "@/engines/visual";
import PropertiesTransformRow from "@/features/visual/components/PropertiesTransformRow";

type PropertiesTransformOriginRowProps = {
  viewModel: PropertiesTransformOriginViewModel;
  commands: PropertiesCommand;
};

export default function PropertiesTransformOriginRow({
  viewModel,
  commands,
}: PropertiesTransformOriginRowProps) {
  if (!viewModel.visible) return null;

  return (
    <PropertiesTransformRow
      label={viewModel.label}
      active={viewModel.editable}
      inputs={viewModel.inputs}
      tokens={viewModel.tokens}
      commands={commands}
      neutral
      leadingControl={(
        <span
          aria-hidden="true"
          style={{
            display: "block",
            width: 14,
            height: 14,
          }}
        />
      )}
    />
  );
}
