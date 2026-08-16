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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flex: "1 1 auto",
              minWidth: 0,
              gap: 5,
            }}
          >
            {modifier.fields.map((field, index) => (
              <div key={field.id} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                {index > 0 && modifier.type === "swing" && (
                  <span aria-hidden="true" style={{ color: "#71808b" }}>-</span>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, color: "#aeb9c2", fontSize: 11 }}>
                  {field.prefix && <span style={{ whiteSpace: "nowrap" }}>{field.prefix}</span>}
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
                      width: 42,
                      minWidth: 0,
                      boxSizing: "border-box",
                      padding: "4px 6px",
                      textAlign: "right",
                      colorScheme: "dark",
                      fontSize: 12,
                    }}
                  />
                  {field.suffix && <span style={{ whiteSpace: "nowrap" }}>{field.suffix}</span>}
                </label>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
