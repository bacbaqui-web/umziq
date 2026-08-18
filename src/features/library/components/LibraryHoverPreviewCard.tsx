import type { LibraryHoverPreviewViewModel } from "@/engines/library";
import LayerHoverPreviewCard from "@/shared/components/LayerHoverPreviewCard";

export default function LibraryHoverPreviewCard({
  state,
}: {
  readonly state: {
    readonly preview: LibraryHoverPreviewViewModel;
    readonly x: number;
    readonly y: number;
  };
}) {
  if (state.preview.kind === "visual") {
    return (
      <LayerHoverPreviewCard
        name={state.preview.name}
        width={state.preview.width}
        height={state.preview.height}
        surface={state.preview.surface}
        status={state.preview.status === "ready" ? "ready" : "empty"}
        x={state.x}
        y={state.y}
      />
    );
  }
  return (
    <LibraryAudioHoverPreviewCard
      preview={state.preview}
      x={state.x}
      y={state.y}
    />
  );
}

function LibraryAudioHoverPreviewCard({
  preview,
  x,
  y,
}: {
  readonly preview: Extract<LibraryHoverPreviewViewModel, { kind: "audio" }>;
  readonly x: number;
  readonly y: number;
}) {
  const statusText =
    preview.status === "missing"
      ? "원본 파일을 찾을 수 없습니다"
      : preview.status === "empty"
        ? "파형이 없는 오디오"
        : null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        zIndex: 1100,
        left: x,
        top: y,
        width: 110,
        pointerEvents: "none",
        overflow: "hidden",
        border: "1px solid #50677b",
        borderRadius: 8,
        background: "#11161a",
        boxShadow: "0 14px 34px rgba(0,0,0,.58)",
      }}
    >
      <div style={{ padding: "3px 4px", display: "flex", gap: 4, justifyContent: "space-between", color: "#dce8f2", fontSize: 9 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview.name}</span>
        <span style={{ flex: "0 0 auto", color: "#8798a6", fontVariantNumeric: "tabular-nums" }}>
          {preview.durationSeconds !== null ? `${preview.durationSeconds.toFixed(1)}초` : ""}
        </span>
      </div>
      <div
        style={{
          minHeight: 56,
          padding: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#142019",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
        }}
      >
        {statusText ? (
          <span style={{ color: preview.status === "missing" ? "#d99a9a" : "#aebbc6", fontSize: 9, fontWeight: 650 }}>{statusText}</span>
        ) : (
          <svg width="102" height="46" viewBox="0 0 204 92" role="img" aria-label="오디오 파형">
            <line x1="0" y1="46" x2="204" y2="46" stroke="rgba(101,201,138,.28)" />
            {preview.waveform.map((peak, index) => {
              const xValue = (index / Math.max(1, preview.waveform.length - 1)) * 204;
              const height = Math.max(1, Math.min(42, Math.abs(peak) * 42));
              return <line key={index} x1={xValue} y1={46 - height} x2={xValue} y2={46 + height} stroke="#65c98a" strokeWidth="1.3" />;
            })}
          </svg>
        )}
      </div>
      {preview.status === "ready" && (
        <div style={{ padding: "2px 4px 3px", color: "#789184", fontSize: 8 }}>
          {preview.channelCount ? `${preview.channelCount}채널` : "채널 정보 없음"}
          {preview.sampleRate ? ` · ${(preview.sampleRate / 1000).toFixed(1)}kHz` : ""}
        </div>
      )}
    </div>
  );
}
