import type {
  PropertiesCommand,
  PropertiesModifierViewModel,
} from "@/engines/properties";

type PropertiesModifierSectionProps = {
  modifiers: PropertiesModifierViewModel[];
  commands: PropertiesCommand;
};

export default function PropertiesModifierSection({
  modifiers,
  commands,
}: PropertiesModifierSectionProps) {
  if (modifiers.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
      {modifiers.map((modifier) => (
        <section
          className="ui-card"
          key={modifier.type}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 10px",
            borderRadius: 8,
            boxShadow: "none",
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              whiteSpace: "nowrap",
              fontSize: 13,
              fontWeight: 700,
              color: "#e5edf4",
            }}
          >
            {modifier.label}
          </div>
          <span aria-hidden="true" style={{ color: "#71808b" }}>-</span>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              flex: "1 1 auto",
              minWidth: 0,
              gap: 6,
            }}
          >
            {modifier.fields.map((field) => (
              <label
                key={field.id}
                style={{
                  position: "relative",
                  display: "block",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: 7,
                    zIndex: 1,
                    maxWidth: "calc(100% - 14px)",
                    overflow: "hidden",
                    color: "#82919c",
                    fontSize: 9,
                    lineHeight: 1.2,
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {field.label}
                </span>
                <input
                  className="ui-input"
                  type="text"
                  inputMode="decimal"
                  value={field.value}
                  onFocus={() => commands.focusModifierInput(field.id)}
                  onChange={(event) =>
                    commands.changeModifierInput(field.id, event.target.value)
                  }
                  onBlur={() => commands.blurModifierInput(field.id)}
                  onKeyDown={(event) => {
                    const intent = commands.keyDownModifierInput(field.id, event.key);
                    if (intent === "blur") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label={`${modifier.label} ${field.label}`}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
                    padding: "14px 7px 3px",
                    colorScheme: "dark",
                    fontSize: 12,
                  }}
                />
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
