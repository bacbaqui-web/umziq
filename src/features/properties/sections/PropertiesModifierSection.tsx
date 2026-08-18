import type {
  AnimatableProperty,
  AccelerationCurve,
} from "@/models";
import type {
  PropertiesCommand,
  PropertiesModifierViewModel,
} from "@/engines/properties";

const ACCELERATION_PROPERTIES: readonly { id: AnimatableProperty; label: string }[] = [
  { id: "position", label: "위치" },
  { id: "scale", label: "크기" },
  { id: "rotation", label: "회전" },
  { id: "opacity", label: "투명도" },
];

const ACCELERATION_CURVES: readonly { id: AccelerationCurve; title: string; detail: string; path: string }[] = [
  { id: "ease-out-soft", title: "빠르게 시작", detail: "부드럽게 감속", path: "M3 41 C22 9 42 4 61 3" },
  { id: "ease-out-strong", title: "빠르게 시작", detail: "강하게 감속", path: "M3 41 C12 5 38 3 61 3" },
  { id: "ease-in-soft", title: "천천히 시작", detail: "부드럽게 가속", path: "M3 41 C22 40 42 35 61 3" },
  { id: "ease-in-strong", title: "천천히 시작", detail: "강하게 가속", path: "M3 41 C26 41 52 39 61 3" },
];

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
            alignItems: modifier.type === "acceleration" ? "stretch" : "center",
            flexDirection: modifier.type === "acceleration" ? "column" : "row",
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
          {modifier.type === "acceleration" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div>
                <div style={{ marginBottom: 5, color: "#94a4af", fontSize: 10 }}>적용할 속성</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }}>
                  {ACCELERATION_PROPERTIES.map((property) => {
                    const active = modifier.accelerationProperties?.includes(property.id) ?? false;
                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => commands.toggleAccelerationProperty(property.id)}
                        style={{ padding: "5px 2px", borderRadius: 5, border: `1px solid ${active ? "#6ca8d1" : "#394651"}`, background: active ? "#29465c" : "#182027", color: active ? "#dcefff" : "#8f9ca5", fontSize: 10, cursor: "pointer" }}
                      >
                        {property.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 5, color: "#94a4af", fontSize: 10 }}>변화 방식</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 5 }}>
                  {ACCELERATION_CURVES.map((curve) => {
                    const active = modifier.accelerationCurve === curve.id;
                    return (
                      <button
                        key={curve.id}
                        type="button"
                        onClick={() => commands.setAccelerationCurve(curve.id)}
                        style={{ display: "grid", gridTemplateColumns: "64px 1fr", alignItems: "center", gap: 5, minWidth: 0, padding: "5px", borderRadius: 6, border: `1px solid ${active ? "#6ca8d1" : "#394651"}`, background: active ? "#233c50" : "#151d23", color: "#dce6ec", textAlign: "left", cursor: "pointer" }}
                      >
                        <svg viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">
                          <path d="M3 3 V41 H61" fill="none" stroke="#465762" strokeWidth="1" />
                          <path d={curve.path} fill="none" stroke={active ? "#86c5ee" : "#70a5c5"} strokeWidth="2" />
                        </svg>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 10, fontWeight: 700 }}>{curve.title}</span>
                          <span style={{ display: "block", marginTop: 2, color: "#91a0aa", fontSize: 9 }}>{curve.detail}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div
            style={{
              display: modifier.type === "acceleration" ? "none" : "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flex: "1 1 auto",
              minWidth: 0,
              gap: 5,
            }}
          >
            {modifier.type === "mouth-basic" && (
              <select
                className="ui-input"
                aria-label="입뻥긋 연결 오디오"
                value={modifier.audioLayerDocumentId ?? ""}
                onChange={(event) => commands.setMouthBasicAudioLayer(event.target.value)}
                style={{ minWidth: 120, maxWidth: 190, padding: "4px 7px", colorScheme: "dark", fontSize: 12 }}
              >
                <option value="">오디오 선택</option>
                {(modifier.audioOptions ?? []).map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            )}
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
