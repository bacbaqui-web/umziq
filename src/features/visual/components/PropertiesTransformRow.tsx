import type { ReactNode } from "react";
import type {
  PropertiesCommand,
  PropertiesNumericInputViewModel,
  PropertiesPropertyRowViewModel,
} from "@/engines/visual";

type PropertiesTransformRowProps = {
  label: string;
  active: boolean;
  inputs: PropertiesNumericInputViewModel[];
  tokens: PropertiesPropertyRowViewModel["tokens"];
  leadingControl: ReactNode;
  trailingControl?: ReactNode;
  neutral?: boolean;
  commands: PropertiesCommand;
};

export default function PropertiesTransformRow({
  label,
  active,
  inputs,
  tokens,
  leadingControl,
  trailingControl,
  neutral = false,
  commands,
}: PropertiesTransformRowProps) {
  const rowTextColor = active
    ? neutral ? "#d7dde3" : tokens.label
    : "#73808d";
  const rowBackground = active ? "rgba(255,255,255,0.018)" : "transparent";
  const rowBorder = active && !neutral
    ? tokens.accentBorder
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
        opacity: active ? 1 : 0.72,
        boxShadow: active && !neutral
          ? `inset 2px 0 0 ${tokens.accentMuted}`
          : "none",
        transition: "background 120ms ease, border-color 120ms ease, opacity 120ms ease",
      }}
    >
      {leadingControl}
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 4,
          minWidth: 0,
        }}
      >
        {inputs.map((input) => (
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
              className="ui-input"
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
                border: `1px solid ${active && !neutral ? tokens.accentBorder : "#34383c"}`,
                background: active ? "rgba(19, 24, 30, 0.92)" : "#1d1d1d",
                color: active ? "#fff" : "#7f8790",
                colorScheme: "dark",
                fontSize: 11,
              }}
              title={input.title}
            />
          </label>
        ))}
        {trailingControl}
      </div>
    </div>
  );
}
