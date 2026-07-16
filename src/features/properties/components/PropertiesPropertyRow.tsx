import type {
  PropertiesCommand,
  PropertiesPropertyRowViewModel,
} from "@/engines/properties";

type PropertiesPropertyRowProps = {
  viewModel: PropertiesPropertyRowViewModel;
  commands: PropertiesCommand;
};

export default function PropertiesPropertyRow({
  viewModel,
  commands,
}: PropertiesPropertyRowProps) {
  const rowTextColor = viewModel.enabled ? viewModel.tokens.label : "#73808d";
  const rowBackground = viewModel.enabled ? "rgba(255,255,255,0.018)" : "transparent";
  const rowBorder = viewModel.enabled
    ? viewModel.tokens.accentBorder
    : "rgba(255,255,255,0.06)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px minmax(40px, auto) 1fr",
        alignItems: "center",
        gap: 6,
        padding: "4px 7px",
        borderRadius: 5,
        borderBottom: `1px solid ${rowBorder}`,
        background: rowBackground,
        color: rowTextColor,
        opacity: viewModel.enabled ? 1 : 0.72,
        boxShadow: viewModel.enabled
          ? `inset 2px 0 0 ${viewModel.tokens.accentMuted}`
          : "none",
        transition: "background 120ms ease, border-color 120ms ease, opacity 120ms ease",
      }}
    >
      <input
        type="checkbox"
        checked={viewModel.enabled}
        onChange={(event) =>
          commands.togglePropertyTrack(viewModel.property, event.target.checked)
        }
        style={{ margin: 0, accentColor: viewModel.tokens.accent }}
      />
      <span style={{ fontSize: 12, fontWeight: 600 }}>{viewModel.label}</span>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 4,
          minWidth: 0,
        }}
      >
        {viewModel.inputs.map((input) => (
          <label
            key={input.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              color: rowTextColor,
              fontSize: 11,
            }}
          >
            <span style={{ minWidth: 12, textAlign: "right" }}>{input.axisLabel}</span>
            <input
              type="text"
              inputMode="decimal"
              value={input.value}
              readOnly={input.readOnly}
              onFocus={() => commands.focusNumericInput(input.id)}
              onChange={(event) => commands.changeNumericInput(input.id, event.target.value)}
              onBlur={() => commands.blurNumericInput(input.id)}
              onKeyDown={(event) => {
                const intent = commands.keyDownNumericInput(input.id, event.key);
                if (intent === "blur") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              style={{
                width: input.width,
                padding: "3px 5px",
                borderRadius: 4,
                border: `1px solid ${
                  viewModel.enabled ? viewModel.tokens.accentBorder : "#34383c"
                }`,
                background: viewModel.enabled ? "rgba(19, 24, 30, 0.92)" : "#1d1d1d",
                color: viewModel.enabled ? "#fff" : "#7f8790",
                colorScheme: "dark",
                fontSize: 11,
              }}
              title={input.title}
            />
          </label>
        ))}

        {viewModel.scaleLinked !== null && (
          <button
            type="button"
            onClick={commands.toggleScaleLink}
            disabled={!viewModel.editable}
            title={viewModel.scaleLinked ? "X/Y 연동 해제" : "X/Y 연동"}
            style={{
              width: 24,
              height: 24,
              padding: 0,
              borderRadius: 6,
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
        )}
      </div>
    </div>
  );
}
