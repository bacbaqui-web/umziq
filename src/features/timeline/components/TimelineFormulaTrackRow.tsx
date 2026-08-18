import {
  type TimelineFormulaRowViewModel,
  type TimelineInteractionCommands,
} from "@/engines/timeline";
import TimelineFormulaClip from "@/features/timeline/components/TimelineFormulaClip";

type ClipDraft = Pick<TimelineFormulaRowViewModel, "startFrame" | "durationFrames" | "transitionFrames">;
type ClipDragKind = "move" | "start" | "end" | `transition-${number}`;

function clipChanged(left: ClipDraft, right: ClipDraft) {
  return left.startFrame !== right.startFrame ||
    left.durationFrames !== right.durationFrames ||
    left.transitionFrames.length !== right.transitionFrames.length ||
    left.transitionFrames.some((frame, index) => frame !== right.transitionFrames[index]);
}

function buildOpacitySegments(clip: ClipDraft, inverted: boolean) {
  const boundaries = [
    0,
    ...clip.transitionFrames.filter((frame) => frame >= 0 && frame < clip.durationFrames),
    clip.durationFrames,
  ];
  return boundaries.slice(0, -1).map((startFrame, index) => ({
    startFrame,
    durationFrames: Math.max(0, (boundaries[index + 1] ?? startFrame) - startFrame),
    visible: (index % 2 === 0) !== inverted,
  }));
}

export default function TimelineFormulaTrackRow({ viewModel, contentWidth, interactions }: {
  viewModel: TimelineFormulaRowViewModel;
  contentWidth: number;
  interactions: TimelineInteractionCommands;
}) {
  const initial: ClipDraft = {
    startFrame: viewModel.startFrame,
    durationFrames: viewModel.durationFrames,
    transitionFrames: [...viewModel.transitionFrames],
  };

  return (
    <TimelineFormulaClip<ClipDraft, ClipDragKind>
      rowIndex={viewModel.rowIndex}
      contentWidth={contentWidth}
      itemStartFrame={viewModel.item.startFrame}
      itemSourceOffsetFrames={viewModel.item.sourceOffsetFrames}
      pxPerFrame={viewModel.pxPerFrame}
      timelineOriginLeft={viewModel.timelineOriginLeft}
      initialDraft={initial}
      moveKind="move"
      startKind="start"
      endKind="end"
      label={`수식 · ${viewModel.label}`}
      labelColor="#c9ead8"
      accentColor="#57b77b"
      ariaLabel="입뻥긋 수식 클립 이동"
      clipHeight={10}
      clipTop={1.5}
      clipStyle={{ background: "transparent" }}
      updateDraft={(source, kind, delta) => {
        if (kind === "move") return { ...source, startFrame: source.startFrame + delta };
        if (kind === "start") {
          const applied = Math.min(source.durationFrames - 1, delta);
          const durationFrames = source.durationFrames - applied;
          return {
            startFrame: source.startFrame + applied,
            durationFrames,
            transitionFrames: source.transitionFrames
              .map((frame) => frame - applied)
              .filter((frame) => frame >= 0 && frame < durationFrames),
          };
        }
        if (kind === "end") {
          const durationFrames = Math.max(1, source.durationFrames + delta);
          return {
            ...source,
            durationFrames,
            transitionFrames: source.transitionFrames.filter((frame) => frame < durationFrames),
          };
        }
        const transitionIndex = Number(kind.slice("transition-".length));
        const transitionFrames = [...source.transitionFrames];
        transitionFrames[transitionIndex] = Math.max(
          0,
          Math.min(
            source.durationFrames - 1,
            (transitionFrames[transitionIndex] ?? 0) + delta
          )
        );
        return { ...source, transitionFrames: transitionFrames.sort((left, right) => left - right) };
      }}
      changed={clipChanged}
      select={() => interactions.selectTimelineItem(viewModel.item.id)}
      commit={(latest) => interactions.setMouthBasicClip(viewModel.item.id, {
        ...latest,
        transitionFrames: [...latest.transitionFrames],
      })}
      renderContent={({ draft, pxPerFrame, beginInteraction }) => (
        <>
          <span style={{ position: "absolute", inset: 0, borderRadius: 2, overflow: "hidden", pointerEvents: "none" }}>
            {buildOpacitySegments(draft, viewModel.inverted).map((segment, index) => (
              <span
                key={`${index}-${segment.startFrame}`}
                style={{
                  position: "absolute",
                  left: segment.startFrame * pxPerFrame,
                  top: 0,
                  width: segment.durationFrames * pxPerFrame,
                  height: "100%",
                  background: segment.visible
                    ? "linear-gradient(90deg, rgba(43,108,70,.95), rgba(53,132,84,.95))"
                    : "rgba(53,132,84,.2)",
                }}
              />
            ))}
          </span>
          {draft.transitionFrames.map((frame, index) => (
            <span
              key={`${index}-${frame}`}
              title={`${frame}f`}
              onPointerDown={(event) => beginInteraction(event, `transition-${index}`)}
              style={{ position: "absolute", left: frame * pxPerFrame - 2, top: 0, width: 4, height: 8, cursor: "ew-resize", zIndex: 3 }}
            >
              <span style={{ position: "absolute", left: 1, top: 0, width: 1, height: 8, background: "rgba(226,255,236,.86)" }} />
            </span>
          ))}
        </>
      )}
    />
  );
}
