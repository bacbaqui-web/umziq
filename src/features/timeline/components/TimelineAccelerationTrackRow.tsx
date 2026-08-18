import {
  type TimelineFormulaRowViewModel,
  type TimelineInteractionCommands,
} from "@/engines/timeline";
import TimelineFormulaClip from "@/features/timeline/components/TimelineFormulaClip";

type AccelerationClipDraft = {
  readonly startFrame: number;
  readonly durationFrames: number;
};

type AccelerationClipDragKind = "move" | "start" | "end";

const CURVE_PATHS = {
  "ease-out-soft": "M2 12 C15 2 31 1 46 1",
  "ease-out-strong": "M2 12 C8 1 27 1 46 1",
  "ease-in-soft": "M2 12 C17 12 33 11 46 1",
  "ease-in-strong": "M2 12 C21 12 40 12 46 1",
} as const;

export default function TimelineAccelerationTrackRow({ viewModel, contentWidth, interactions }: {
  viewModel: TimelineFormulaRowViewModel;
  contentWidth: number;
  interactions: TimelineInteractionCommands;
}) {
  const propertyLabel = (viewModel.accelerationProperties ?? []).map((property) => ({
    position: "위치", scale: "크기", rotation: "회전", opacity: "투명도",
  })[property]).join("+");
  const curve = viewModel.accelerationCurve ?? "ease-out-soft";

  return (
    <TimelineFormulaClip<AccelerationClipDraft, AccelerationClipDragKind>
      rowIndex={viewModel.rowIndex}
      contentWidth={contentWidth}
      itemStartFrame={viewModel.item.startFrame}
      itemSourceOffsetFrames={viewModel.item.sourceOffsetFrames}
      pxPerFrame={viewModel.pxPerFrame}
      timelineOriginLeft={viewModel.timelineOriginLeft}
      initialDraft={{ startFrame: viewModel.startFrame, durationFrames: viewModel.durationFrames }}
      moveKind="move"
      startKind="start"
      endKind="end"
      label={`가속·감속 · ${propertyLabel}`}
      labelColor="#b9daf0"
      accentColor="#64a8d2"
      ariaLabel="가속 감속 범위 이동"
      clipStyle={{ background: "rgba(45,92,121,.72)" }}
      updateDraft={(initial, kind, delta) => {
        if (kind === "move") return { ...initial, startFrame: initial.startFrame + delta };
        if (kind === "start") {
          const applied = Math.min(initial.durationFrames - 1, delta);
          return { startFrame: initial.startFrame + applied, durationFrames: initial.durationFrames - applied };
        }
        return { ...initial, durationFrames: Math.max(1, initial.durationFrames + delta) };
      }}
      changed={(initial, latest) => initial.startFrame !== latest.startFrame || initial.durationFrames !== latest.durationFrames}
      select={() => interactions.selectTimelineItem(viewModel.item.id)}
      commit={(latest) => interactions.setAccelerationClip(viewModel.item.id, latest)}
      renderContent={({ width }) => (
        <>
          {width >= 24 && (
            <svg viewBox="0 0 48 14" preserveAspectRatio="none" width="100%" height="12" style={{ display: "block", pointerEvents: "none" }}>
              <path d={CURVE_PATHS[curve]} fill="none" stroke="rgba(211,239,255,.9)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </>
      )}
    />
  );
}
