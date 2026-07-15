import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { applyPositionValueToComps } from "@/editor/actions/editorActions";
import {
  evaluateCompositionPosition,
  evaluateLayerPosition,
  formatPositionDeltaReadout,
} from "@/editor/preview/previewEngine";
import type { SelectedKeyframe, TimelineSelection } from "@/editor/types/editorViewTypes";
import type {
  Composition,
  CompositionMeta,
  Position,
  Scale,
  TimelineItem,
} from "@/editor/types/types";
import {
  calculatePreviewPositionDragUpdate,
} from "@/features/preview/interaction/previewInteractionMath";
import { createMotionPathKeyframeDragState } from "@/features/preview/interaction/previewPointerMath";
import type { TransformTargetSelection } from "@/features/preview/types/previewControllerTypes";

type UsePreviewMotionPathInteractionsOptions = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedCompId: string;
  selectedTransformTarget: TransformTargetSelection;
  selectedTimelineTargetItem: TimelineItem | null;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setCurrentFrame: Dispatch<SetStateAction<number>>;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  setSelectedKeyframe: Dispatch<SetStateAction<SelectedKeyframe>>;
  setIsDraggingMotionPathKeyframe: Dispatch<SetStateAction<boolean>>;
  setMotionPathKeyframeReadout: Dispatch<SetStateAction<string | null>>;
  setDraggingMotionPathFrame: Dispatch<SetStateAction<number | null>>;
  applySelectionForComposition: (compId: string, nextSelection: TimelineSelection) => void;
};

export function usePreviewMotionPathInteractions({
  previewOverlayRef,
  selectedMeta,
  previewSize,
  previewZoom,
  previewViewportOffset,
  selectedCompId,
  selectedTransformTarget,
  selectedTimelineTargetItem,
  setComps,
  setCurrentFrame,
  setPositionDraft,
  setScaleDraft,
  setRotationDraft,
  setOpacityDraft,
  setSelectedKeyframe,
  setIsDraggingMotionPathKeyframe,
  setMotionPathKeyframeReadout,
  setDraggingMotionPathFrame,
  applySelectionForComposition,
}: UsePreviewMotionPathInteractionsOptions) {
  const previewDragFrameRef = useRef<number | null>(null);
  const previewDragPointerRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const previewMotionPathKeyframeDragRef = useRef<{
    absoluteFrame: number;
    localFrame: number;
    startPointer: Position;
    startPosition: Position;
    targetKind: "layer" | "composition";
    targetId: string;
  } | null>(null);

  const handleSelectMotionPathFrame = useCallback(
    (frame: number, isKeyframe: boolean) => {
      setPositionDraft(null);
      setScaleDraft(null);
      setRotationDraft(null);
      setOpacityDraft(null);
      setCurrentFrame(frame);

      if (!isKeyframe || !selectedTransformTarget || !selectedTimelineTargetItem) {
        return;
      }

      const localFrame = frame - selectedTimelineTargetItem.startFrame;

      if (localFrame < 0 || localFrame >= selectedTimelineTargetItem.durationFrames) {
        return;
      }

      const nextSelection = {
        sourceId:
          selectedTransformTarget.kind === "layer"
            ? selectedTransformTarget.layer.id
            : selectedTransformTarget.composition.id,
        kind: selectedTransformTarget.kind === "layer" ? ("layer" as const) : ("subComp" as const),
      };

      applySelectionForComposition(selectedCompId, nextSelection);
      setSelectedKeyframe({
        targetKind: selectedTransformTarget.kind,
        targetId: nextSelection.sourceId,
        frame: localFrame,
        property: "position",
      });
    },
    [
      applySelectionForComposition,
      selectedCompId,
      selectedTimelineTargetItem,
      selectedTransformTarget,
      setCurrentFrame,
      setOpacityDraft,
      setPositionDraft,
      setRotationDraft,
      setScaleDraft,
      setSelectedKeyframe,
    ]
  );

  const handleStartMotionPathKeyframeDrag = useCallback(
    (frame: number, clientX: number, clientY: number) => {
      if (
        !selectedTransformTarget ||
        !selectedTimelineTargetItem ||
        !selectedMeta ||
        !previewOverlayRef.current
      ) {
        return;
      }

      const localFrame = frame - selectedTimelineTargetItem.startFrame;

      if (localFrame < 0 || localFrame >= selectedTimelineTargetItem.durationFrames) {
        return;
      }

      const startPosition =
        selectedTransformTarget.kind === "layer"
          ? selectedTransformTarget.layer.positionKeyframes.find(
              (keyframe) => keyframe.frame === localFrame
            )?.value ?? evaluateLayerPosition(selectedTransformTarget.layer, localFrame)
          : selectedTransformTarget.composition.positionKeyframes.find(
              (keyframe) => keyframe.frame === localFrame
            )?.value ??
            evaluateCompositionPosition(selectedTransformTarget.composition, localFrame);

      previewMotionPathKeyframeDragRef.current = createMotionPathKeyframeDragState(
        {
          overlayBounds: previewOverlayRef.current.getBoundingClientRect(),
          selectedMeta,
          previewSize,
          previewZoom,
          previewViewportOffset,
          clientX,
          clientY,
        },
        {
          absoluteFrame: frame,
          localFrame,
          startPosition,
          targetKind: selectedTransformTarget.kind,
          targetId:
            selectedTransformTarget.kind === "layer"
              ? selectedTransformTarget.layer.id
              : selectedTransformTarget.composition.id,
        }
      );
      setSelectedKeyframe({
        targetKind: selectedTransformTarget.kind,
        targetId:
          selectedTransformTarget.kind === "layer"
            ? selectedTransformTarget.layer.id
            : selectedTransformTarget.composition.id,
        frame: localFrame,
        property: "position",
      });
      setIsDraggingMotionPathKeyframe(true);
      setDraggingMotionPathFrame(frame);
      setMotionPathKeyframeReadout(formatPositionDeltaReadout({ x: 0, y: 0 }));
    },
    [
      previewOverlayRef,
      previewSize,
      previewViewportOffset,
      previewZoom,
      selectedMeta,
      selectedTimelineTargetItem,
      selectedTransformTarget,
      setDraggingMotionPathFrame,
      setIsDraggingMotionPathKeyframe,
      setMotionPathKeyframeReadout,
      setSelectedKeyframe,
    ]
  );

  const handlePreviewMotionPathKeyframeDrag = useEffectEvent((clientX: number, clientY: number) => {
    if (!previewMotionPathKeyframeDragRef.current || !previewOverlayRef.current || !selectedMeta) {
      return;
    }

    const { delta, nextPosition } = calculatePreviewPositionDragUpdate(
      {
        overlayBounds: previewOverlayRef.current.getBoundingClientRect(),
        selectedMeta,
        previewSize,
        previewZoom,
        previewViewportOffset,
        clientX,
        clientY,
      },
      previewMotionPathKeyframeDragRef.current
    );
    const { localFrame, targetKind, targetId } =
      previewMotionPathKeyframeDragRef.current;

    setComps((prev) =>
      applyPositionValueToComps(prev, targetKind, targetId, nextPosition, localFrame, true)
    );

    setSelectedKeyframe({
      targetKind,
      targetId,
      frame: localFrame,
      property: "position",
    });
    setMotionPathKeyframeReadout(formatPositionDeltaReadout(delta));
  });

  const flushPreviewDragPointer = useEffectEvent(() => {
    previewDragFrameRef.current = null;

    const pointer = previewDragPointerRef.current;

    if (!pointer || !previewMotionPathKeyframeDragRef.current) {
      return;
    }

    handlePreviewMotionPathKeyframeDrag(pointer.clientX, pointer.clientY);
  });

  useEffect(() => {
    const stopMotionPathKeyframeDrag = () => {
      previewMotionPathKeyframeDragRef.current = null;
      previewDragPointerRef.current = null;
      if (previewDragFrameRef.current !== null) {
        window.cancelAnimationFrame(previewDragFrameRef.current);
        previewDragFrameRef.current = null;
      }
      setIsDraggingMotionPathKeyframe(false);
      setDraggingMotionPathFrame(null);
      setMotionPathKeyframeReadout(null);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!previewMotionPathKeyframeDragRef.current) {
        return;
      }

      previewDragPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };

      if (previewDragFrameRef.current === null) {
        previewDragFrameRef.current = window.requestAnimationFrame(() => {
          flushPreviewDragPointer();
        });
      }
    };

    const handleMouseUp = () => {
      stopMotionPathKeyframeDrag();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (previewDragFrameRef.current !== null) {
        window.cancelAnimationFrame(previewDragFrameRef.current);
        previewDragFrameRef.current = null;
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    setDraggingMotionPathFrame,
    setIsDraggingMotionPathKeyframe,
    setMotionPathKeyframeReadout,
  ]);

  return {
    handleSelectMotionPathFrame,
    handleStartMotionPathKeyframeDrag,
  };
}
