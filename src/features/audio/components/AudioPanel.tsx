import type { AudioBasicViewProps, AudioEffectsViewProps } from "@/engines/audio";
import { useRef } from "react";
import AudioBasicSection from "@/features/audio/components/AudioBasicSection";

export type AudioPanelProps = {
  readonly effects: AudioEffectsViewProps;
  readonly basic: AudioBasicViewProps | null;
};

function EffectParameterInput({ effectId, parameter, value, commands }: {
  effectId: string;
  parameter: AudioEffectsViewProps["readModel"]["items"][number]["parameters"][number];
  value: string;
  commands: AudioEffectsViewProps["commands"];
}) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  return (
    <div style={{ display: "flex", border: "1px solid #3b4650", borderRadius: 5, background: "#101519" }}>
      <input
        id={`${effectId}:${parameter.key}`}
        value={value}
        onFocus={() => commands.focusParameter(effectId, parameter.key)}
        onChange={(event) => commands.changeParameter(effectId, parameter.key, event.currentTarget.value)}
        onBlur={() => commands.commitParameter(effectId, parameter.key)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); commands.cancelParameter(); }
          if (event.key === "Enter") { event.preventDefault(); commands.commitParameter(effectId, parameter.key); }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || !Number.isFinite(Number(value))) return;
          drag.current = { y: event.clientY, value: Number(value) };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const next = drag.current.value + (drag.current.y - event.clientY) * parameter.step;
          commands.changeParameter(effectId, parameter.key, String(Math.round(next * 1000) / 1000));
        }}
        onPointerUp={(event) => {
          if (!drag.current) return;
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          commands.commitParameter(effectId, parameter.key);
        }}
        onPointerCancel={() => { drag.current = null; commands.cancelParameter(); }}
        style={{ width: "100%", minWidth: 0, padding: "4px 6px", border: 0, outline: 0, background: "transparent", color: "#eef3f6", cursor: "ns-resize" }}
      />
      {parameter.suffix && <span style={{ padding: "4px 6px 4px 0", color: "#72808b" }}>{parameter.suffix}</span>}
    </div>
  );
}

export default function AudioPanel({ effects: { readModel, commands }, basic }: AudioPanelProps) {
  if (!readModel.visible) return null;
  return (
    <section aria-label="오디오 이펙트" className="editor-panel-scroll" style={{ minHeight: 150, height: "100%", padding: 10, borderTop: "1px solid #303840" }}>
      {basic && <AudioBasicSection {...basic} />}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <strong style={{ flex: 1, color: "#e3ece6" }}>오디오 이펙트</strong>
        <select aria-label="이펙트 추가" defaultValue="" onChange={(event) => {
          if (event.currentTarget.value) commands.add(event.currentTarget.value as typeof readModel.catalog[number]["type"]);
          event.currentTarget.value = "";
        }} style={{ maxWidth: 120 }}>
          <option value="">+ 추가</option>
          {readModel.catalog.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
        </select>
      </div>
      {readModel.items.length === 0 && <div style={{ color: "#7f8b93", fontSize: 12 }}>적용된 이펙트가 없습니다.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {readModel.items.map((effect, index) => (
          <article key={effect.effectId} style={{ border: "1px solid #38424a", borderRadius: 8, padding: 8, background: "#171c21", opacity: effect.enabled ? 1 : 0.62 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <button type="button" aria-pressed={effect.enabled} onClick={() => commands.toggle(effect.effectId)}>{effect.enabled ? "켜짐" : "꺼짐"}</button>
              <strong style={{ flex: 1 }}>{effect.label}</strong>
              <button type="button" aria-label="위로" disabled={index === 0} onClick={() => commands.move(effect.effectId, -1)}>↑</button>
              <button type="button" aria-label="아래로" disabled={index === readModel.items.length - 1} onClick={() => commands.move(effect.effectId, 1)}>↓</button>
              <button type="button" aria-label="삭제" onClick={() => commands.remove(effect.effectId)}>×</button>
            </div>
            <div style={{ marginTop: 7, display: "grid", gridTemplateColumns: "62px minmax(0,1fr)", gap: "5px 7px", alignItems: "center" }}>
              {effect.parameters.map((parameter) => {
                const active = readModel.draft?.effectId === effect.effectId && readModel.draft.key === parameter.key;
                const value = active ? readModel.draft!.value : String(parameter.value);
                return (
                  <div key={parameter.key} style={{ display: "contents" }}>
                    <label htmlFor={`${effect.effectId}:${parameter.key}`} style={{ color: "#98a6af" }}>{parameter.label}</label>
                    <EffectParameterInput effectId={effect.effectId} parameter={parameter} value={value} commands={commands} />
                  </div>
                );
              })}
            </div>
            {effect.type === "noise-gate" && <div style={{ marginTop: 6, color: "#77858e", fontSize: 10.5 }}>말이 없는 구간의 작은 소리를 줄입니다.</div>}
          </article>
        ))}
      </div>
    </section>
  );
}
