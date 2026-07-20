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

function getStatusText(viewModel: PreviewQualityControlViewModel) {
  if (viewModel.status === "building") {
    return `생성 중... ${viewModel.completedCount} / ${viewModel.totalCount}`;
  }
  if (viewModel.status === "error") {
    return "일부 Preview 생성 실패";
  }
  return "";
}

export default function PreviewQualityControl({
  viewModel,
  commands,
}: PreviewQualityControlProps) {
  const statusText = getStatusText(viewModel);
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
            {option.label} · {option.memoryLabel}
          </option>
        ))}
      </select>
      <span
        className={`preview-quality-control__status${
          viewModel.status === "error" ? " preview-quality-control__status--error" : ""
        }`}
        role="status"
        aria-live="polite"
      >
        {statusText}
      </span>
    </div>
  );
}
