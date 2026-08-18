import {
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  TIMELINE_PROPERTY_ROW_HEIGHT,
  useTimelinePointerDragSessionRuntime,
} from "@/engines/timeline";

export type TimelineFormulaClipDraft = {
  readonly startFrame: number;
  readonly durationFrames: number;
};

type FormulaClipDragSession<TDraft extends TimelineFormulaClipDraft, TKind extends string> = {
  readonly type: "formula-clip";
  readonly kind: TKind;
  readonly startX: number;
  readonly pxPerFrame: number;
  readonly initial: TDraft;
  readonly latest: TDraft;
};

type FormulaClipContentProps<TDraft extends TimelineFormulaClipDraft, TKind extends string> = {
  readonly draft: TDraft;
  readonly width: number;
  readonly pxPerFrame: number;
  readonly beginInteraction: (
    event: PointerEvent<HTMLElement>,
    kind: TKind
  ) => void;
};

export default function TimelineFormulaClip<
  TDraft extends TimelineFormulaClipDraft,
  TKind extends string,
>({
  rowIndex,
  contentWidth,
  itemStartFrame,
  itemSourceOffsetFrames,
  pxPerFrame,
  initialDraft,
  moveKind,
  startKind,
  endKind,
  label,
  labelColor,
  accentColor,
  ariaLabel,
  clipStyle,
  updateDraft,
  changed,
  commit,
  select,
  renderContent,
}: {
  rowIndex: number;
  contentWidth: number;
  itemStartFrame: number;
  itemSourceOffsetFrames: number;
  pxPerFrame: number;
  initialDraft: TDraft;
  moveKind: TKind;
  startKind: TKind;
  endKind: TKind;
  label: string;
  labelColor: string;
  accentColor: string;
  ariaLabel: string;
  clipStyle?: CSSProperties;
  updateDraft: (initial: TDraft, kind: TKind, deltaFrames: number) => TDraft;
  changed: (initial: TDraft, latest: TDraft) => boolean;
  commit: (latest: TDraft) => void;
  select: () => void;
  renderContent?: (props: FormulaClipContentProps<TDraft, TKind>) => ReactNode;
}) {
  const [draft, setDraft] = useState<TDraft | null>(null);
  const current = draft ?? initialDraft;
  const globalLeft = itemStartFrame + current.startFrame - itemSourceOffsetFrames;
  const left = globalLeft * pxPerFrame;
  const width = current.durationFrames * pxPerFrame;

  const pointer = useTimelinePointerDragSessionRuntime<FormulaClipDragSession<TDraft, TKind>>({
    move: (session, clientX) => {
      const deltaFrames = Math.round(
        (clientX - session.startX) / Math.max(0.001, session.pxPerFrame)
      );
      const latest = updateDraft(session.initial, session.kind, deltaFrames);
      setDraft(latest);
      return { ...session, latest };
    },
    commit: (session) => {
      setDraft(null);
      if (changed(session.initial, session.latest)) commit(session.latest);
    },
    cancel: () => setDraft(null),
  });

  const beginInteraction = (
    event: PointerEvent<HTMLElement>,
    kind: TKind
  ) => {
    event.preventDefault();
    event.stopPropagation();
    select();
    pointer.begin(
      {
        type: "formula-clip",
        kind,
        startX: event.clientX,
        pxPerFrame,
        initial: initialDraft,
        latest: initialDraft,
      },
      {
        pointerId: event.pointerId,
        captureTarget: event.currentTarget,
      }
    );
  };

  return (
    <div style={{ display: "contents" }}>
      <div
        style={{
          gridColumn: 1,
          gridRow: rowIndex,
          height: TIMELINE_PROPERTY_ROW_HEIGHT,
          padding: "0 8px 0 4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          color: labelColor,
          fontSize: 10,
          boxSizing: "border-box",
        }}
      >
        <span style={{ width: 5, height: 1, marginRight: 6, background: accentColor }} />
        <span>{label}</span>
      </div>
      <div
        style={{
          gridColumn: 2,
          gridRow: rowIndex,
          position: "relative",
          width: contentWidth,
          minWidth: contentWidth,
          height: TIMELINE_PROPERTY_ROW_HEIGHT,
          overflow: "visible",
        }}
      >
        <div
          role="button"
          aria-label={ariaLabel}
          onPointerDown={(event) => beginInteraction(event, moveKind)}
          style={{
            position: "absolute",
            left,
            top: 1,
            width: Math.max(2, width),
            height: 14,
            borderRadius: 3,
            border: `1px solid ${accentColor}`,
            boxSizing: "border-box",
            cursor: draft ? "grabbing" : "grab",
            overflow: "visible",
            ...clipStyle,
          }}
        >
          {renderContent?.({
            draft: current,
            width,
            pxPerFrame,
            beginInteraction,
          })}
          <span
            onPointerDown={(event) => beginInteraction(event, startKind)}
            style={{
              position: "absolute",
              left: -3,
              top: -1,
              width: 6,
              height: 14,
              cursor: "ew-resize",
              zIndex: 4,
            }}
          />
          <span
            onPointerDown={(event) => beginInteraction(event, endKind)}
            style={{
              position: "absolute",
              right: -3,
              top: -1,
              width: 6,
              height: 14,
              cursor: "ew-resize",
              zIndex: 4,
            }}
          />
        </div>
      </div>
    </div>
  );
}
