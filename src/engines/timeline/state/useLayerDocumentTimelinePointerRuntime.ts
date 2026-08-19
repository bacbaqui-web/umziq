import { useCallback, type Dispatch, type SetStateAction } from "react";
import type {
  AnimatableProperty,
  LayerDocumentProject,
  LayerDocumentTransformProperty,
} from "@/models";
import {
  layerDocumentTimelineTimingChanged,
  resolveLayerDocumentTimelineTimingClickIntent,
  resolveLayerDocumentTimelineTimingDraft,
  type LayerDocumentTimelineTimingOperation,
} from "@/engines/timeline/helpers/layerDocumentTimelineInteractionHelpers";
import { resolveTimelineDragDelta } from "@/engines/timeline/helpers/timelineInteractionHelpers";
import type {
  LayerDocumentTimelineKeyframeDrag,
  LayerDocumentTimelineNexusPort,
  LayerDocumentTimelineTimingDraft,
} from "@/engines/timeline/models/layerDocumentTimelineEngineModel";
import type { TimelinePointerDragStart } from "@/engines/timeline/models/timelineEngineTypes";
import type { LayerDocumentTimelineTimingDraftRuntime } from "@/engines/timeline/state/layerDocumentTimelineTimingDraftRuntime";
import { useTimelinePointerDragSessionRuntime } from "@/engines/timeline/state/useTimelinePointerDragSessionRuntime";

type TimelinePointerSession =
  | {
      readonly type: "move-item" | "resize-start" | "resize-end";
      readonly operation: LayerDocumentTimelineTimingOperation;
      readonly layerDocumentId: string;
      readonly wasSelected: boolean;
      readonly startClientX: number;
      readonly timelineDurationFrames: number;
      readonly sourceDurationFrames: number | null;
      readonly initial: LayerDocumentTimelineTimingDraft;
      readonly draft: LayerDocumentTimelineTimingDraft | null;
    }
  | {
      readonly type: "move-keyframe";
      readonly layerDocumentId: string;
      readonly property: LayerDocumentTransformProperty;
      readonly originLocalFrame: number;
      readonly localFrame: number;
      readonly startClientX: number;
    };

export function useLayerDocumentTimelinePointerRuntime(options: {
  nexus: LayerDocumentTimelineNexusPort;
  project: LayerDocumentProject;
  timelineDurationFrames: number | null;
  pxPerFrame: number;
  timingDraftRuntime: LayerDocumentTimelineTimingDraftRuntime;
  setKeyframeDrag: Dispatch<
    SetStateAction<LayerDocumentTimelineKeyframeDrag | null>
  >;
}) {
  const {
    nexus,
    project,
    timelineDurationFrames,
    pxPerFrame,
    timingDraftRuntime,
    setKeyframeDrag,
  } = options;
  const move = useCallback((session: TimelinePointerSession, clientX: number) => {
    if (session.type === "move-keyframe") {
      const localFrame = Math.max(
        0,
        session.originLocalFrame +
          resolveTimelineDragDelta(clientX, session.startClientX, pxPerFrame)
      );
      setKeyframeDrag({
        layerDocumentId: session.layerDocumentId,
        property: session.property,
        originLocalFrame: session.originLocalFrame,
        localFrame,
      });
      return { ...session, localFrame };
    }
    const draft = resolveLayerDocumentTimelineTimingDraft(
      session,
      resolveTimelineDragDelta(clientX, session.startClientX, pxPerFrame)
    );
    const changed = layerDocumentTimelineTimingChanged(session.initial, draft);
    if (changed) timingDraftRuntime.publish(draft);
    else timingDraftRuntime.clear();
    return { ...session, draft: changed ? draft : null };
  }, [pxPerFrame, setKeyframeDrag, timingDraftRuntime]);

  const commit = useCallback((session: TimelinePointerSession) => {
    if (session.type === "move-keyframe") {
      if (session.localFrame !== session.originLocalFrame) {
        nexus.timeline.dispatchIntent({
          kind: "move-keyframe",
          layerDocumentId: session.layerDocumentId,
          property: session.property,
          fromLocalFrame: session.originLocalFrame,
          toLocalFrame: session.localFrame,
        });
      }
      setKeyframeDrag(null);
      return;
    }
    if (session.draft) {
      nexus.timeline.dispatchIntent({ kind: "set-timing", ...session.draft });
    }
    timingDraftRuntime.clear();
  }, [nexus.timeline, setKeyframeDrag, timingDraftRuntime]);

  const pointer = useTimelinePointerDragSessionRuntime({
    move,
    commit,
    cancel: (session) => {
      if (session.type === "move-keyframe") setKeyframeDrag(null);
      else timingDraftRuntime.clear();
    },
  });
  const begin = pointer.begin;
  const cancel = pointer.cancel;
  const consumeCompletion = pointer.consumeCompletion;

  const beginTiming = useCallback((
    start: TimelinePointerDragStart,
    layerDocumentId: string,
    operation: LayerDocumentTimelineTimingOperation,
    wasSelected: boolean
  ) => {
    const layer = project.payload.layerDocumentsById[layerDocumentId];
    if (!layer || timelineDurationFrames === null) return;
    const sourceId = layer.common.source?.sourceId;
    const source = sourceId
      ? project.payload.sourceRegistry.sourcesById[sourceId]
      : null;
    begin({
      type: operation === "move" ? "move-item" : operation === "trim-start" ? "resize-start" : "resize-end",
      operation,
      layerDocumentId,
      wasSelected,
      startClientX: start.clientX,
      timelineDurationFrames,
      sourceDurationFrames:
        layer.type === "group"
          ? layer.data.durationFrames
          : layer.type === "audio" && source?.kind === "audio"
            ? source.data.durationFrames
            : null,
      initial: {
        layerDocumentId,
        startFrame: layer.common.placement.startFrame,
        durationFrames: layer.common.placement.durationFrames,
        sourceOffsetFrames: layer.common.placement.sourceOffsetFrames,
      },
      draft: null,
    }, start);
  }, [begin, project, timelineDurationFrames]);

  const consumeTimingClick = useCallback((layerDocumentId: string) => {
    const completion = consumeCompletion();
    if (!completion || completion.session.type === "move-keyframe") {
      return "toggle" as const;
    }
    return resolveLayerDocumentTimelineTimingClickIntent({
      layerDocumentId: completion.session.layerDocumentId,
      operation: completion.session.operation,
      wasSelected: completion.session.wasSelected,
      didMove: completion.didMove,
    }, layerDocumentId);
  }, [consumeCompletion]);

  const beginKeyframeMove = useCallback((
    start: TimelinePointerDragStart,
    layerDocumentId: string,
    localFrame: number,
    property: AnimatableProperty
  ) => {
    setKeyframeDrag({
      layerDocumentId,
      property,
      originLocalFrame: localFrame,
      localFrame,
    });
    begin({
      type: "move-keyframe",
      layerDocumentId,
      property,
      originLocalFrame: localFrame,
      localFrame,
      startClientX: start.clientX,
    }, start);
  }, [begin, setKeyframeDrag]);

  return {
    beginTiming,
    consumeTimingClick,
    beginKeyframeMove,
    cancel,
  };
}
