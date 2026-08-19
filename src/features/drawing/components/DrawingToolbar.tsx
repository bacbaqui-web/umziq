import type { DrawingEngineViewProps, DrawingTool } from "@/engines/drawing";
import LayerDocumentIcon from "@/shared/components/LayerDocumentIcon";

function ToolIcon({ tool }: { readonly tool: DrawingTool }) {
  const common = {
    width: 21,
    height: 21,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (tool === "brush") {
    return (
      <svg {...common}>
        <path d="m12.8 13.3 6.9-6.9a1.9 1.9 0 0 0-2.7-2.7l-6.9 6.9" />
        <path d="m9.3 9.8 3.7 3.7" />
        <path d="M11.7 14.5c-.4 3.8-2.7 6.1-7.4 6.2 1.7-1.3 1.1-3.2 2.3-4.7 1.2-1.4 3.1-1.9 5.1-1.5Z" />
        <path d="M4.3 20.7c1.3-.2 2.4-.8 3.1-1.8" />
      </svg>
    );
  }

  if (tool === "eraser") {
    return (
      <svg {...common}>
        <path d="m7.8 19.5-4.3-4.3a2.2 2.2 0 0 1 0-3.1l8.2-8.2a2.2 2.2 0 0 1 3.1 0l5.3 5.3a2.2 2.2 0 0 1 0 3.1l-7.2 7.2H7.8Z" />
        <path d="m7.3 8.3 8.4 8.4" />
        <path d="M12.8 19.5h8.7" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m4.2 12.3 7.7-7.7 7.3 7.3-7.7 7.7a2 2 0 0 1-2.8 0l-4.5-4.5a2 2 0 0 1 0-2.8Z" />
      <path d="m7.7 8.8 7.5 7.5" />
      <path d="M3.6 15.1h16.2" />
      <path d="M20.1 17.1s1.9 2.1 1.9 3.1a1.9 1.9 0 0 1-3.8 0c0-1 1.9-3.1 1.9-3.1Z" />
      <path d="M10.1 4.7h3.6" />
    </svg>
  );
}

function ToolButton({
  drawing,
  tool,
  label,
}: {
  readonly drawing: DrawingEngineViewProps;
  readonly tool: DrawingTool;
  readonly label: string;
}) {
  const button = (
    <button
      className="drawing-tool-button"
      data-active={drawing.tool === tool}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={drawing.tool === tool}
      onClick={() => drawing.setTool(tool)}
    >
      <ToolIcon tool={tool} />
    </button>
  );

  if (tool === "fill") return button;

  return (
    <div className="drawing-size-control">
      {button}
      <div className="drawing-size-popover">
        <div className="drawing-size-track-wrap">
          <input
            className="drawing-size-slider"
            aria-label={`${label} 크기`}
            type="range"
            min={1}
            max={200}
            value={drawing.size}
            onChange={(event) => drawing.setSize(Number(event.target.value))}
          />
        </div>
        <span className="drawing-size-value">{drawing.size}px</span>
      </div>
    </div>
  );
}

export default function DrawingToolbar({ drawing }: { drawing: DrawingEngineViewProps }) {
  return (
    <div className="drawing-toolbar">
      {drawing.modeEnabled && (
        <div className="preview-toolbar drawing-tools-panel">
          <ToolButton drawing={drawing} tool="brush" label="브러시" />
          <ToolButton drawing={drawing} tool="eraser" label="지우개" />
          <ToolButton drawing={drawing} tool="fill" label="페인트통" />
          <label className="drawing-color-control" title="드로잉 색상">
            <span className="drawing-color-swatch" style={{ background: drawing.color }} />
            <input
              aria-label="드로잉 색상"
              type="color"
              value={drawing.color}
              onChange={(event) => drawing.setColor(event.target.value)}
            />
          </label>
        </div>
      )}
      <button
        className="preview-toolbar drawing-mode-button"
        data-active={drawing.modeEnabled}
        type="button"
        disabled={!drawing.canEnableMode}
        aria-pressed={drawing.modeEnabled}
        title={drawing.canEnableMode ? "드로잉 모드 켜기/끄기" : "드로잉 레이어를 선택해 주세요"}
        onClick={drawing.toggleMode}
      >
        <LayerDocumentIcon kind="drawing" size={20} />
      </button>
    </div>
  );
}
