import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  TIMELINE_DURATION_EDITOR_HEIGHT,
  TIMELINE_DURATION_EDITOR_INPUT_WIDTH,
} from "@/features/timeline/timelineUiConstants";

type TimelineDurationSplitEditorProps = {
  valueFrames: number;
  frameRate: number;
  title: string;
  accent: "range" | "timeline";
  onCommit: (nextDurationFrames: number) => void;
};

function splitCompositionDuration(durationFrames: number, frameRate: number) {
  const safeFrameRate = Math.max(frameRate, 1);
  return {
    seconds: Math.floor(durationFrames / safeFrameRate),
    frames: durationFrames % safeFrameRate,
  };
}

export default function TimelineDurationSplitEditor({
  valueFrames,
  frameRate,
  title,
  accent,
  onCommit,
}: TimelineDurationSplitEditorProps) {
  const hiddenCaretInputStyle = {
    caretColor: "transparent" as const,
    WebkitTextFillColor: "transparent",
  };
  const [isEditing, setIsEditing] = useState(false);
  const [secondsInput, setSecondsInput] = useState("0");
  const [framesInput, setFramesInput] = useState("0");
  const secondsInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    secondsInputRef.current?.focus();
    secondsInputRef.current?.select();
  }, [isEditing]);

  const beginEditing = () => {
    const durationParts = splitCompositionDuration(Math.max(valueFrames, 1), frameRate);
    setSecondsInput(String(durationParts.seconds));
    setFramesInput(String(durationParts.frames));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    const durationParts = splitCompositionDuration(Math.max(valueFrames, 1), frameRate);
    setSecondsInput(String(durationParts.seconds));
    setFramesInput(String(durationParts.frames));
    setIsEditing(false);
  };

  const commitEditing = () => {
    const nextSeconds = Number(secondsInput.trim());
    const nextFrames = Number(framesInput.trim());

    if (
      !Number.isFinite(nextSeconds) ||
      !Number.isFinite(nextFrames) ||
      nextSeconds < 0 ||
      nextFrames < 0
    ) {
      cancelEditing();
      return;
    }

    const parsedDuration = Math.max(
      1,
      Math.floor(nextSeconds) * frameRate + Math.floor(nextFrames)
    );

    if (parsedDuration !== valueFrames) {
      onCommit(parsedDuration);
    }

    setIsEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitEditing();
      return;
    }

    if (event.key === "Escape") {
      cancelEditing();
    }
  };

  const handleEditorBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    commitEditing();
  };

  const handleSelectFullValue = (
    event: ReactMouseEvent<HTMLInputElement> | ReactFocusEvent<HTMLInputElement>
  ) => {
    event.currentTarget.select();
  };

  const fieldStyles =
    accent === "range"
      ? {
          border: "1px solid rgba(245,165,36,0.38)",
          background: "rgba(245,165,36,0.12)",
          color: "#f8deb0",
        }
      : {
          border: "1px solid #3a3a3a",
          background: "#242424",
          color: "#d8e1ea",
        };
  const compactDisplayValue = splitCompositionDuration(Math.max(valueFrames, 1), frameRate);
  const valueColor = accent === "range" ? "#f6e4be" : "#eef5fc";
  const unitColor =
    accent === "range" ? "rgba(248, 222, 176, 0.68)" : "rgba(216, 225, 234, 0.62)";
  const inputBackground =
    accent === "range" ? "rgba(42, 33, 25, 0.92)" : "rgba(30, 34, 39, 0.94)";
  const inputBorder =
    accent === "range"
      ? "1px solid rgba(245,165,36,0.24)"
      : "1px solid rgba(255,255,255,0.12)";

  return (
    <div
      onClick={() => {
        if (!isEditing) {
          beginEditing();
        }
      }}
      style={{
        height: TIMELINE_DURATION_EDITOR_HEIGHT,
        borderRadius: 5,
        display: "flex",
        alignItems: "center",
        padding: "0 7px",
        fontSize: 10,
        minWidth: 0,
        cursor: isEditing ? "default" : "pointer",
        ...fieldStyles,
      }}
    >
      {isEditing ? (
        <div
          onBlur={handleEditorBlur}
          style={{
            width: "auto",
            display: "flex",
            alignItems: "center",
            gap: 2,
            color: valueColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <input
            ref={secondsInputRef}
            value={secondsInput}
            onChange={(event) => setSecondsInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleSelectFullValue}
            onClick={(event) => {
              event.stopPropagation();
              event.currentTarget.select();
            }}
            onMouseUp={(event) => {
              event.preventDefault();
              event.currentTarget.select();
            }}
            style={{
              width: TIMELINE_DURATION_EDITOR_INPUT_WIDTH,
              minWidth: TIMELINE_DURATION_EDITOR_INPUT_WIDTH,
              padding: "0 2px",
              height: 16,
              borderRadius: 3,
              border: inputBorder,
              background: inputBackground,
              color: valueColor,
              textShadow: `0 0 0 ${valueColor}`,
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1,
              textAlign: "right",
              outline: "none",
              boxSizing: "border-box",
              ...hiddenCaretInputStyle,
            }}
          />
          <span style={{ color: unitColor, fontSize: 9, lineHeight: 1 }}>s</span>
          <input
            value={framesInput}
            onChange={(event) => setFramesInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleSelectFullValue}
            onClick={(event) => {
              event.stopPropagation();
              event.currentTarget.select();
            }}
            onMouseUp={(event) => {
              event.preventDefault();
              event.currentTarget.select();
            }}
            style={{
              width: TIMELINE_DURATION_EDITOR_INPUT_WIDTH,
              minWidth: TIMELINE_DURATION_EDITOR_INPUT_WIDTH,
              padding: "0 2px",
              height: 16,
              borderRadius: 3,
              border: inputBorder,
              background: inputBackground,
              color: valueColor,
              textShadow: `0 0 0 ${valueColor}`,
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1,
              textAlign: "right",
              outline: "none",
              boxSizing: "border-box",
              ...hiddenCaretInputStyle,
            }}
          />
          <span style={{ color: unitColor, fontSize: 9, lineHeight: 1 }}>f</span>
        </div>
      ) : (
        <div
          title={title}
          style={{
            width: "100%",
            color: "inherit",
            textAlign: "left",
            pointerEvents: "none",
            fontVariantNumeric: "tabular-nums",
            display: "flex",
            alignItems: "baseline",
            gap: 1,
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: valueColor }}>
            {compactDisplayValue.seconds}
          </span>
          <span style={{ fontSize: 9, color: unitColor }}>s</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: valueColor }}>
            {compactDisplayValue.frames}
          </span>
          <span style={{ fontSize: 9, color: unitColor }}>f</span>
        </div>
      )}
    </div>
  );
}
