import type { ChangeEvent } from "react";
import type { RendererMode } from "@/engines/canvas";

type PreviewRendererModeControlProps = {
  rendererMode: RendererMode;
  setRendererMode: (mode: RendererMode) => void;
};

const RENDERER_MODE_OPTIONS = [
  {
    value: "fast-render",
    label: "작업용",
    description: "빠르게 작업할 때 추천",
  },
  {
    value: "full-render",
    label: "완성본",
    description: "최종 결과 그대로 표시",
  },
] as const satisfies ReadonlyArray<{
  value: RendererMode;
  label: string;
  description: string;
}>;

export default function PreviewRendererModeControl({
  rendererMode,
  setRendererMode,
}: PreviewRendererModeControlProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setRendererMode(event.currentTarget.value as RendererMode);
  };

  return (
    <fieldset className="preview-renderer-mode-control">
      <legend className="preview-renderer-mode-control__legend">표시 모드</legend>
      <div className="preview-renderer-mode-control__options">
        {RENDERER_MODE_OPTIONS.map((option) => (
          <label
            className="preview-renderer-mode-control__option"
            key={option.value}
          >
            <input
              className="preview-renderer-mode-control__radio"
              type="radio"
              name="preview-renderer-mode"
              value={option.value}
              checked={rendererMode === option.value}
              onChange={handleChange}
            />
            <span className="preview-renderer-mode-control__copy">
              <span className="preview-renderer-mode-control__label">
                {option.label}
              </span>
              <span className="preview-renderer-mode-control__description">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
