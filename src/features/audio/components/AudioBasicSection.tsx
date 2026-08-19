import type { AudioBasicViewProps } from "@/engines/audio";

export default function AudioBasicSection({ readModel, commands }: AudioBasicViewProps) {
  return (
    <section aria-label="오디오 기본 속성" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ flex: 1 }}>오디오</strong>
        <button type="button" aria-pressed={readModel.muted} onClick={commands.toggleMuted}>
          {readModel.muted ? "음소거 켜짐" : "음소거"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0, 1fr)", gap: "6px 8px", alignItems: "center" }}>
        {readModel.fields.map((field) => (
          <div key={field.id} style={{ display: "contents" }}>
            <label htmlFor={`audio-basic:${field.id}`}>{field.label}</label>
            <div style={{ display: "flex" }}>
              <input
                id={`audio-basic:${field.id}`}
                value={field.value}
                onFocus={() => commands.focus(field.id)}
                onChange={(event) => commands.change(field.id, event.currentTarget.value)}
                onBlur={() => commands.commit(field.id)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") { event.preventDefault(); commands.cancel(); event.currentTarget.blur(); }
                  if (event.key === "Enter") { event.preventDefault(); commands.commit(field.id); event.currentTarget.blur(); }
                }}
                style={{ minWidth: 0, width: "100%" }}
              />
              {field.suffix && <span>{field.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
