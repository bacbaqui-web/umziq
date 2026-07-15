import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  evaluateCompositionPosition,
  evaluateLayerPosition,
  formatPositionDeltaReadout,
} from "@/editor/preview/previewEngine";
import type { CompositionMeta, Position } from "@/editor/types/types";
import type { PreviewOverlay as PreviewOverlayData } from "@/editor/types/editorViewTypes";
import type { TransformEditMode } from "@/editor/types/transformActionTypes";
import {
  calculatePreviewPositionDragUpdate,
} from "@/features/preview/interaction/previewInteractionMath";
import { createPreviewPositionDragState } from "@/features/preview/interaction/previewPointerMath";
import type { TransformTargetSelection } from "@/features/preview/types/previewControllerTypes";

type UsePreviewDirectMoveInteractionOptions = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedPreviewOverlay: PreviewOverlayData;
  selectedTransformTarget: TransformTargetSelection;
  selectedTimelineTargetItem: {
    startFrame: number;
  } | null;
  playheadFrame: number;
  resolvedPositionDraft: Position;
  positionEditMode: TransformEditMode;
  setPositionDraft: Dispatch<SetStateAction<Position | null>>;
  setIsDraggingPosition: Dispatch<SetStateAction<boolean>>;
  setPositionHandleReadout: Dispatch<SetStateAction<string | null>>;
  pushTransformHistorySnapshot: () => void;
  beginTransformHistoryCapture: () => void;
  markTransformHistoryCaptureDirty: () => void;
  commitTransformHistoryCapture: () => void;
  applyPositionValue: (nextPosition: Position, editMode: TransformEditMode) => void;
};

export function usePreviewDirectMoveInteraction({
  previewOverlayRef,
  selectedMeta,
  previewSize,
  previewZoom,
  previewViewportOffset,
  selectedPreviewOverlay,
  selectedTransformTarget,
  selectedTimelineTargetItem,
  playheadFrame,
  resolvedPositionDraft,
  positionEditMode,
  setPositionDraft,
  setIsDraggingPosition,
  setPositionHandleReadout,
  pushTransformHistorySnapshot,
  beginTransformHistoryCapture,
  markTransformHistoryCaptureDirty,
  commitTransformHistoryCapture,
  applyPositionValue,
}: UsePreviewDirectMoveInteractionOptions) {
  const previewDragFrameRef = useRef<number | null>(null);
  const previewDragPointerRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const previewPositionDragRef = useRef<{
    overlay: NonNullable<PreviewOverlayData>;
    startPointer: Position;
    startPosition: Position;
  } | null>(null);

  const startPreviewPositionDrag = useCallback(
    (clientX: number, clientY: number) => {
      const overlayBounds = previewOverlayRef.current?.getBoundingClientRect();

      if (!overlayBounds || !selectedPreviewOverlay || !selectedMeta) {
        return;
      }

      const startPosition =
        selectedTransformTarget?.kind === "layer"
          ? evaluateLayerPosition(
              selectedTransformTarget.layer,
              selectedTimelineTargetItem
                ? Math.max(0, playheadFrame - selectedTimelineTargetItem.startFrame)
                : playheadFrame
            )
          : selectedTransformTarget?.kind === "composition"
            ? evaluateCompositionPosition(
                selectedTransformTarget.composition,
                selectedTimelineTargetItem
                  ? Math.max(0, playheadFrame - selectedTimelineTargetItem.startFrame)
                  : playheadFrame
              )
            : resolvedPositionDraft;

      previewPositionDragRef.current = createPreviewPositionDragState(
        {
          overlayBounds,
          selectedMeta,
          previewSize,
          previewZoom,
          previewViewportOffset,
          clientX,
          clientY,
        },
        selectedPreviewOverlay,
        startPosition
      );
      beginTransformHistoryCapture();
      setIsDraggingPosition(true);
      setPositionHandleReadout(formatPositionDeltaReadout({ x: 0, y: 0 }));
    },
    [
      beginTransformHistoryCapture,
      playheadFrame,
      previewOverlayRef,
      previewSize,
      previewViewportOffset,
      previewZoom,
      resolvedPositionDraft,
      selectedMeta,
      selectedPreviewOverlay,
      selectedTimelineTargetItem,
      selectedTransformTarget,
      setIsDraggingPosition,
      setPositionHandleReadout,
    ]
  );

  const handlePreviewPositionDrag = useEffectEvent((clientX: number, clientY: number) => {
    if (!previewPositionDragRef.current || !previewOverlayRef.current || !selectedMeta) {
      return;
    }

    const { nextPosition, readout } = calculatePreviewPositionDragUpdate(
      {
        overlayBounds: previewOverlayRef.current.getBoundingClientRect(),
        selectedMeta,
        previewSize,
        previewZoom,
        previewViewportOffset,
        clientX,
        clientY,
      },
      previewPositionDragRef.current
    );

    setPositionDraft(nextPosition);
    setPositionHandleReadout(readout);
    markTransformHistoryCaptureDirty();
    applyPositionValue(nextPosition, positionEditMode);
  });

  const flushPreviewDragPointer = useEffectEvent(() => {
    previewDragFrameRef.current = null;

    const pointer = previewDragPointerRef.current;

    if (!pointer) {
      return;
    }

    handlePreviewPositionDrag(pointer.clientX, pointer.clientY);
  });

  useEffect(() => {
    const stopPreviewPositionDrag = () => {
      const wasDragging = !!previewPositionDragRef.current;
      previewPositionDragRef.current = null;
      previewDragPointerRef.current = null;
      if (previewDragFrameRef.current !== null) {
        window.cancelAnimationFrame(previewDragFrameRef.current);
        previewDragFrameRef.current = null;
      }
      setIsDraggingPosition(false);
      setPositionHandleReadout(null);
      if (wasDragging) {
        commitTransformHistoryCapture();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!previewPositionDragRef.current) {
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
      stopPreviewPositionDrag();
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
  }, [commitTransformHistoryCapture, setIsDraggingPosition, setPositionHandleReadout]);

  const handleArrowNudge = useEffectEvent((event: KeyboardEvent) => {
    if (!selectedTransformTarget) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const isTypingTarget =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable;

    if (isTypingTarget) {
      return;
    }

    const step = event.shiftKey ? 10 : 1;
    let delta: Position | null = null;

    if (event.key === "ArrowLeft") {
      delta = { x: -step, y: 0 };
    } else if (event.key === "ArrowRight") {
      delta = { x: step, y: 0 };
    } else if (event.key === "ArrowUp") {
      delta = { x: 0, y: -step };
    } else if (event.key === "ArrowDown") {
      delta = { x: 0, y: step };
    }

    if (!delta) {
      return;
    }

    event.preventDefault();
    pushTransformHistorySnapshot();
    const nextPosition = {
      x: resolvedPositionDraft.x + delta.x,
      y: resolvedPositionDraft.y + delta.y,
    };
    setPositionDraft(nextPosition);
    applyPositionValue(nextPosition, positionEditMode);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleArrowNudge(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const onTargetMouseDown = useCallback(
    (event: ReactMouseEvent<SVGPolygonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      startPreviewPositionDrag(event.clientX, event.clientY);
    },
    [startPreviewPositionDrag]
  );

  return {
    startPreviewPositionDrag,
    onTargetMouseDown,
  };
}
