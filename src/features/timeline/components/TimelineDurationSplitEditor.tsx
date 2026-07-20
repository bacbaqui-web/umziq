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
  type TimelineDurationViewModel,
} from "@/engines/timeline";

type TimelineDurationSplitEditorProps = {
  viewModel: TimelineDurationViewModel;
  onCommit: (seconds: string, frames: string) => void;
};

export default function TimelineDurationSplitEditor({
  viewModel,
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
    setSecondsInput(String(viewModel.seconds));
    setFramesInput(String(viewModel.frames));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setSecondsInput(String(viewModel.seconds));
    setFramesInput(String(viewModel.frames));
    setIsEditing(false);
  };

  const commitEditing = () => {
    onCommit(secondsInput, framesInput);
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
    viewModel.accent === "range"
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
  const compactDisplayValue = viewModel;
  const valueColor = viewModel.accent === "range" ? "#f6e4be" : "#eef5fc";
  const unitColor =
    viewModel.accent === "range" ? "rgba(248, 222, 176, 0.68)" : "rgba(216, 225, 234, 0.62)";
  const inputBackground =
    viewModel.accent === "range" ? "rgba(42, 33, 25, 0.92)" : "rgba(30, 34, 39, 0.94)";
  const inputBorder =
    viewModel.accent === "range"
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
            className="ui-input ui-input--compact"
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
            className="ui-input ui-input--compact"
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
          title={viewModel.title}
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
