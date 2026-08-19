import {
  layerDocumentPlacementEndFrame,
} from "@/models";
import type {
  LayerDocumentTimelineTimingDraft,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";

export type LayerDocumentTimelineTimingOperation =
  | "move"
  | "trim-start"
  | "trim-end";

export interface LayerDocumentTimelineTimingSession {
  readonly operation:
    LayerDocumentTimelineTimingOperation;
  readonly timelineDurationFrames: number;
  readonly sourceDurationFrames?: number | null;
  readonly initial:
    LayerDocumentTimelineTimingDraft;
}

export function resolveLayerDocumentTimelineTimingClickIntent(
  completion: {
    readonly layerDocumentId: string;
    readonly operation:
      LayerDocumentTimelineTimingOperation;
    readonly wasSelected: boolean;
    readonly didMove: boolean;
  } | null,
  layerDocumentId: string
): "toggle" | "keep" {
  if (
    !completion ||
    completion.layerDocumentId !==
      layerDocumentId
  ) {
    return "toggle";
  }
  return completion.operation !== "move" ||
    completion.didMove ||
    !completion.wasSelected
    ? "keep"
    : "toggle";
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Pure PointerMove calculation. It publishes only a Runtime UI draft; the
 * caller performs the single semantic set-timing transaction on PointerUp.
 */
export function resolveLayerDocumentTimelineTimingDraft(
  session: LayerDocumentTimelineTimingSession,
  deltaFrames: number
): LayerDocumentTimelineTimingDraft {
  const delta = Math.round(deltaFrames);
  const initial = session.initial;
  const initialEnd =
    layerDocumentPlacementEndFrame(initial);
  if (session.operation === "move") {
    return {
      ...initial,
      startFrame: clamp(
        initial.startFrame + delta,
        1 - initial.durationFrames,
        session.timelineDurationFrames - 1
      ),
    };
  }
  if (session.operation === "trim-start") {
    const startFrame = clamp(
      initial.startFrame + delta,
      Math.max(0, initial.startFrame - initial.sourceOffsetFrames),
      initialEnd - 1
    );
    const consumedFrames =
      startFrame - initial.startFrame;
    return {
      ...initial,
      startFrame,
      durationFrames: initialEnd - startFrame,
      sourceOffsetFrames:
        initial.sourceOffsetFrames +
        consumedFrames,
    };
  }
  const sourceMaximumDuration = session.sourceDurationFrames == null
    ? session.timelineDurationFrames
    : Math.max(1, session.sourceDurationFrames - initial.sourceOffsetFrames);
  const endFrame = clamp(
    initialEnd + delta,
    initial.startFrame + 1,
    initial.startFrame + sourceMaximumDuration
  );
  return {
    ...initial,
    durationFrames:
      endFrame - initial.startFrame,
  };
}

export function layerDocumentTimelineTimingChanged(
  before: LayerDocumentTimelineTimingDraft,
  after: LayerDocumentTimelineTimingDraft
) {
  return (
    before.startFrame !== after.startFrame ||
    before.durationFrames !==
      after.durationFrames ||
    before.sourceOffsetFrames !==
      after.sourceOffsetFrames
  );
}
