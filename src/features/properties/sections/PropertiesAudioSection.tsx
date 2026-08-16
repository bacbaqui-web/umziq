import { useRef } from "react";
import type { PropertiesCommand, PropertiesAudioSectionViewModel } from "@/engines/properties";

export default function PropertiesAudioSection({
  viewModel,
  commands,
}: {
  viewModel: PropertiesAudioSectionViewModel;
  commands: PropertiesCommand;
}) {
  const drag = useRef<{ id: typeof viewModel.fields[number]["id"]; y: number; value: number; step: number } | null>(null);
  return (
    <section style={{ border: "1px solid #343d45", borderRadius: 9, padding: 10, background: "#171c21" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 9 }}>
        <strong style={{ flex: 1, color: "#dfe9e2" }}>오디오</strong>
        <button
          type="button"
          aria-pressed={viewModel.muted}
          onClick={commands.toggleAudioMuted}
          style={{ border: "1px solid #46515b", borderRadius: 6, padding: "4px 8px", background: viewModel.muted ? "#334139" : "#20262b", color: viewModel.muted ? "#8fd2a7" : "#cad3da" }}
        >
          {viewModel.muted ? "음소거 켜짐" : "음소거"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "82px minmax(0, 1fr)", gap: "7px 8px", alignItems: "center" }}>
        {viewModel.fields.map((field) => (
          <div key={field.id} style={{ display: "contents" }}>
            <label htmlFor={field.id} style={{ color: "#9eabb5", whiteSpace: "nowrap" }}>{field.label}</label>
            <div style={{ display: "flex", alignItems: "center", minWidth: 0, border: "1px solid #3c4650", borderRadius: 6, background: "#11161a" }}>
              <input
                id={field.id}
                type="text"
                inputMode={field.numeric ? "decimal" : "text"}
                value={field.value}
                onFocus={() => commands.focusAudioInput(field.id)}
                onChange={(event) => commands.changeAudioInput(field.id, event.currentTarget.value)}
                onBlur={() => commands.blurAudioInput(field.id)}
                onKeyDown={(event) => {
                  const action = commands.keyDownAudioInput(field.id, event.key);
                  if (action === "blur") event.preventDefault();
                }}
                onPointerDown={(event) => {
                  if (!field.numeric || event.button !== 0) return;
                  const value = Number(field.value);
                  if (!Number.isFinite(value)) return;
                  drag.current = { id: field.id, y: event.clientY, value, step: field.step ?? 1 };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const active = drag.current;
                  if (!active || active.id !== field.id || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const next = active.value + (active.y - event.clientY) * active.step;
                  commands.changeAudioInput(field.id, String(field.step === 1 ? Math.round(next) : Math.round(next * 100) / 100));
                }}
                onPointerUp={(event) => {
                  if (!drag.current || drag.current.id !== field.id) return;
                  drag.current = null;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  commands.blurAudioInput(field.id);
                }}
                onPointerCancel={() => {
                  drag.current = null;
                  commands.keyDownAudioInput(field.id, "Escape");
                }}
                style={{ width: "100%", minWidth: 0, padding: "5px 7px", border: 0, outline: 0, background: "transparent", color: "#eef3f6", cursor: field.numeric ? "ns-resize" : "text" }}
              />
              {field.suffix && <span style={{ paddingRight: 7, color: "#72808b" }}>{field.suffix}</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
