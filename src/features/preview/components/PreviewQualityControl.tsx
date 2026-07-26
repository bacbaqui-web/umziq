import type { ChangeEvent } from "react";
import type {
  PreviewQualityControlCommands,
  PreviewQualityControlViewModel,
  PreviewQualityPreference,
} from "@/engines/canvas";

type PreviewQualityControlProps = {
  viewModel: PreviewQualityControlViewModel;
  commands: PreviewQualityControlCommands;
};

export default function PreviewQualityControl({
  viewModel,
  commands,
}: PreviewQualityControlProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    commands.setPreference(event.currentTarget.value as PreviewQualityPreference);
  };

  return (
    <div className="preview-quality-control">
      <label className="preview-quality-control__label" htmlFor="preview-quality">
        미리보기
      </label>
      <select
        id="preview-quality"
        className="preview-quality-control__select"
        aria-label="Preview 품질"
        value={viewModel.preference}
        onChange={handleChange}
      >
        {viewModel.options.map((option) => (
          <option key={option.preference} value={option.preference}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
