import { useCallback, useMemo, type RefObject } from "react";
import {
  evaluateCompositionBasePosition,
  evaluateLayerBasePosition,
  type TransformTargetSelection,
} from "@/engines/animation";
import type { CompositionMeta, Position, Scale, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import type {
  CanvasInteractionStatePort,
  CanvasPointerController,
} from "@/engines/canvas/models/canvasInteractionModel";
import {
  buildCompositionMotionPath,
  buildLayerMotionPath,
} from "@/engines/canvas/helpers/canvasMotionPathHelpers";
import {
  isDraftTransformSnapshotForTargetAtFrame,
  type DraftTransformSnapshot,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import {
  calculatePreviewPositionDragUpdate,
  formatPositionDeltaReadout,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
import { createMotionPathKeyframeDragState } from "@/engines/canvas/helpers/canvasPointerHelpers";

export type UseCanvasMotionPathControllerOptions = {
  overlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: { width: number; height: number };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedCompId: string;
  selectedTarget: TransformTargetSelection;
  selectedTimelineTargetItem: TimelineItem | null;
  selectedTimelineItems: readonly TimelineItem[];
  playheadFrame: number;
  metaByCompId: Readonly<Record<string, CompositionMeta>>;
  renderItems: readonly RenderItem[];
  draftTransformSnapshot: DraftTransformSnapshot | null;
  seekFrame: (frame: number) => void;
  drafts: {
    setPosition: (value: Position | null) => void;
    setScale: (value: Scale | null) => void;
    setRotation: (value: number | null) => void;
    setOpacity: (value: number | null) => void;
  };
  commands: {
    upsertPositionKeyframe: (command: {
      target: { kind: "layer" | "composition"; id: string };
      property: "position";
      frame: number;
      value: Position;
    }) => void;
    selectPositionKeyframe: (
      target: { kind: "layer" | "composition"; id: string },
      property: "position",
      frame: number
    ) => void;
    applySelection: (
      compId: string,
      selection: { sourceId: string; kind: "layer" | "subComp" }
    ) => void;
  };
  history: {
    begin: () => void;
    markDirty: () => void;
    commit: () => void;
    cancel: () => void;
  };
  state: CanvasInteractionStatePort;
  pointer: CanvasPointerController;
};

export function useCanvasMotionPathController(
  options: UseCanvasMotionPathControllerOptions
) {
  const motionPathDraftSnapshot = useMemo<DraftTransformSnapshot | null>(() => {
    const target = options.selectedTarget;
    const item = options.selectedTimelineTargetItem;
    if (!target || !item) return null;

    const targetId = target.kind === "layer" ? target.layer.id : target.composition.id;
    const expectedItemKind = target.kind === "layer" ? "layer" : "subComp";
    if (item.kind !== expectedItemKind || item.sourceId !== targetId) return null;

    const localFrame = options.playheadFrame - item.startFrame;
    if (localFrame < 0 || localFrame >= item.durationFrames) return null;

    const snapshot = options.draftTransformSnapshot;
    if (!isDraftTransformSnapshotForTargetAtFrame(target, localFrame, snapshot)) {
      return null;
    }
    const changed = snapshot.draft.changed;
    if (
      !snapshot.draft.active ||
      (!changed.position && !changed.anchor && !changed.transformOffset)
    ) {
      return null;
    }

    return snapshot;
  }, [
    options.draftTransformSnapshot,
    options.playheadFrame,
    options.selectedTarget,
    options.selectedTimelineTargetItem,
  ]);

  const motionPath = useMemo(
    () =>
      options.selectedTarget?.kind === "layer" && options.selectedMeta
        ? buildLayerMotionPath(
            options.selectedTarget.layer,
            [...options.renderItems],
            [...options.selectedTimelineItems],
            options.selectedMeta.durationFrames,
            options.playheadFrame,
            options.selectedMeta.frameRate,
            motionPathDraftSnapshot
          )
        : options.selectedTarget?.kind === "composition" && options.selectedMeta
          ? buildCompositionMotionPath(
              options.selectedTarget.composition,
              [...options.selectedTimelineItems],
              { ...options.metaByCompId },
              options.selectedMeta.durationFrames,
              options.playheadFrame,
              motionPathDraftSnapshot
            )
          : [],
    [
      options.metaByCompId,
      options.playheadFrame,
      motionPathDraftSnapshot,
      options.renderItems,
      options.selectedMeta,
      options.selectedTarget,
      options.selectedTimelineItems,
    ]
  );

  const selectPoint = useCallback(
    (frame: number, isKeyframe: boolean) => {
      options.drafts.setPosition(null);
      options.drafts.setScale(null);
      options.drafts.setRotation(null);
      options.drafts.setOpacity(null);
      options.seekFrame(frame);
      if (!isKeyframe || !options.selectedTarget || !options.selectedTimelineTargetItem) {
        return;
      }
      const localFrame = frame - options.selectedTimelineTargetItem.startFrame;
      if (
        localFrame < 0 ||
        localFrame >= options.selectedTimelineTargetItem.durationFrames
      ) return;
      const sourceId =
        options.selectedTarget.kind === "layer"
          ? options.selectedTarget.layer.id
          : options.selectedTarget.composition.id;
      options.commands.applySelection(options.selectedCompId, {
        sourceId,
        kind: options.selectedTarget.kind === "layer" ? "layer" : "subComp",
      });
      options.commands.selectPositionKeyframe(
        { kind: options.selectedTarget.kind, id: sourceId },
        "position",
        localFrame
      );
    },
    [options]
  );

  const startKeyframeDrag = useCallback(
    (frame: number, clientX: number, clientY: number) => {
      const target = options.selectedTarget;
      const item = options.selectedTimelineTargetItem;
      const bounds = options.overlayRef.current?.getBoundingClientRect();
      if (!target || !item || !options.selectedMeta || !bounds) return;
      const localFrame = frame - item.startFrame;
      if (localFrame < 0 || localFrame >= item.durationFrames) return;
      const startPosition =
        target.kind === "layer"
          ? target.layer.positionKeyframes.find((keyframe) => keyframe.frame === localFrame)
              ?.value ?? evaluateLayerBasePosition(target.layer, localFrame)
          : target.composition.positionKeyframes.find(
                (keyframe) => keyframe.frame === localFrame
              )?.value ?? evaluateCompositionBasePosition(
                target.composition,
                localFrame
              );
      const targetId = target.kind === "layer" ? target.layer.id : target.composition.id;
      const drag = createMotionPathKeyframeDragState(
        {
          overlayBounds: bounds,
          selectedMeta: options.selectedMeta,
          previewSize: options.previewSize,
          previewZoom: options.previewZoom,
          previewViewportOffset: options.previewViewportOffset,
          clientX,
          clientY,
        },
        {
          absoluteFrame: frame,
          localFrame,
          startPosition,
          targetKind: target.kind,
          targetId,
        }
      );
      options.history.begin();
      options.commands.selectPositionKeyframe(
        { kind: target.kind, id: targetId },
        "position",
        localFrame
      );
      options.state.setIsDraggingMotionPathKeyframe(true);
      options.state.setDraggingMotionPathFrame(frame);
      options.state.setMotionPathKeyframeReadout(
        formatPositionDeltaReadout({ x: 0, y: 0 })
      );
      options.pointer.start({
        onMove: (sample) => {
          const nextBounds = options.overlayRef.current?.getBoundingClientRect();
          if (!nextBounds || !options.selectedMeta) return;
          const result = calculatePreviewPositionDragUpdate(
            {
              overlayBounds: nextBounds,
              selectedMeta: options.selectedMeta,
              previewSize: options.previewSize,
              previewZoom: options.previewZoom,
              previewViewportOffset: options.previewViewportOffset,
              clientX: sample.clientX,
              clientY: sample.clientY,
            },
            drag
          );
          options.commands.upsertPositionKeyframe({
            target: { kind: drag.targetKind, id: drag.targetId },
            property: "position",
            frame: drag.localFrame,
            value: result.nextPosition,
          });
          options.history.markDirty();
          options.state.setMotionPathKeyframeReadout(result.readout);
        },
        onCommit: () => {
          options.state.setIsDraggingMotionPathKeyframe(false);
          options.state.setDraggingMotionPathFrame(null);
          options.state.setMotionPathKeyframeReadout(null);
          options.history.commit();
        },
        onCancel: () => {
          options.state.setIsDraggingMotionPathKeyframe(false);
          options.state.setDraggingMotionPathFrame(null);
          options.state.setMotionPathKeyframeReadout(null);
          options.history.cancel();
        },
      });
    },
    [options]
  );

  return { motionPath, selectPoint, startKeyframeDrag };
}
