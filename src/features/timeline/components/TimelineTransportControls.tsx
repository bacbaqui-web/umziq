import type { ReactNode } from "react";

type TimelineTransportControlsProps = {
  isPlaying: boolean;
  onResetToStart: () => void;
  onStepBackward: () => void;
  onTogglePlayback: () => void;
  onStepForward: () => void;
};

type TransportButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  accentBorder?: string;
  accentBackground?: string;
};

function TransportButton({
  label,
  onClick,
  children,
  accentBorder = "rgba(255,255,255,0.1)",
  accentBackground = "rgba(255,255,255,0.04)",
}: TransportButtonProps) {
  return (
    <button
      className="ui-button ui-button--icon"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        border: `1px solid ${accentBorder}`,
        background: accentBackground,
        color: "#d8e0ea",
      }}
    >
      {children}
    </button>
  );
}

export default function TimelineTransportControls({
  isPlaying,
  onResetToStart,
  onStepBackward,
  onTogglePlayback,
  onStepForward,
}: TimelineTransportControlsProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flex: "0 0 auto",
      }}
    >
      <TransportButton label="처음으로" onClick={onResetToStart}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2 1H3.5V11H2zM10 2L4 6l6 4z" fill="currentColor" />
        </svg>
      </TransportButton>
      <TransportButton label="한 프레임 뒤로" onClick={onStepBackward}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M8.5 2L3 6l5.5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </TransportButton>
      <TransportButton
        label={isPlaying ? "일시정지" : "재생"}
        onClick={onTogglePlayback}
        accentBorder={isPlaying ? "rgba(148, 103, 103, 0.4)" : "rgba(83, 162, 221, 0.45)"}
        accentBackground={isPlaying ? "rgba(44, 36, 36, 0.82)" : "rgba(30, 51, 68, 0.82)"}
      >
        {isPlaying ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 2H4.5V10H2.5zM7.5 2H9.5V10H7.5z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 2L10 6L3 10z" fill="currentColor" />
          </svg>
        )}
      </TransportButton>
      <TransportButton label="한 프레임 앞으로" onClick={onStepForward}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3.5 2L9 6l-5.5 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </TransportButton>
    </div>
  );
}
