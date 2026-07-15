import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { formatRotationHandleValue } from "@/editor/preview/previewEngine";
import type { CompositionMeta, Position } from "@/editor/types/types";
import type { PreviewOverlay as PreviewOverlayData } from "@/editor/types/editorViewTypes";
import type { TransformEditMode } from "@/editor/types/transformActionTypes";
import {
  calculateRotationDragUpdate,
} from "@/features/preview/interaction/previewInteractionMath";
import { createPreviewRotationDragState } from "@/features/preview/interaction/previewPointerMath";

type UsePreviewRotationInteractionOptions = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedPreviewOverlay: PreviewOverlayData;
  rotationEditMode: TransformEditMode;
  setRotationDraft: Dispatch<SetStateAction<number | null>>;
  setIsDraggingRotation: Dispatch<SetStateAction<boolean>>;
  setRotationHandleReadout: Dispatch<SetStateAction<string | null>>;
  beginTransformHistoryCapture: () => void;
  markTransformHistoryCaptureDirty: () => void;
  commitTransformHistoryCapture: () => void;
  applyRotationValue: (nextRotation: number, editMode: TransformEditMode) => void;
};

export function usePreviewRotationInteraction({
  previewOverlayRef,
  selectedMeta,
  previewSize,
  previewZoom,
  previewViewportOffset,
  selectedPreviewOverlay,
  rotationEditMode,
  setRotationDraft,
  setIsDraggingRotation,
  setRotationHandleReadout,
  beginTransformHistoryCapture,
  markTransformHistoryCaptureDirty,
  commitTransformHistoryCapture,
  applyRotationValue,
}: UsePreviewRotationInteractionOptions) {
  const previewDragFrameRef = useRef<number | null>(null);
  const previewDragPointerRef = useRef<{
    clientX: number;
    clientY: number;
    shiftKey: boolean;
  } | null>(null);
  const previewRotationDragRef = useRef<{
    overlay: NonNullable<PreviewOverlayData>;
    startPointerAngle: number;
    startRotation: number;
  } | null>(null);

  const startPreviewRotationDrag = useCallback(
    (clientX: number, clientY: number) => {
      const overlayBounds = previewOverlayRef.current?.getBoundingClientRect();

      if (!overlayBounds || !selectedPreviewOverlay || !selectedMeta) {
        return;
      }

      previewRotationDragRef.current = createPreviewRotationDragState(
        {
          overlayBounds,
          selectedMeta,
          previewSize,
          previewZoom,
          previewViewportOffset,
          clientX,
          clientY,
        },
        selectedPreviewOverlay
      );
      beginTransformHistoryCapture();
      setIsDraggingRotation(true);
      setRotationHandleReadout(formatRotationHandleValue(selectedPreviewOverlay.rotation));
    },
    [
      beginTransformHistoryCapture,
      previewOverlayRef,
      previewSize,
      previewViewportOffset,
      previewZoom,
      selectedMeta,
      selectedPreviewOverlay,
      setIsDraggingRotation,
      setRotationHandleReadout,
    ]
  );

  const handlePreviewRotationDrag = useEffectEvent((
    clientX: number,
    clientY: number,
    snapToFifteenDegrees: boolean
  ) => {
    if (!previewRotationDragRef.current || !previewOverlayRef.current || !selectedMeta) {
      return;
    }

    const result = calculateRotationDragUpdate(
      {
        overlayBounds: previewOverlayRef.current.getBoundingClientRect(),
        selectedMeta,
        previewSize,
        previewZoom,
        previewViewportOffset,
        clientX,
        clientY,
      },
      previewRotationDragRef.current,
      snapToFifteenDegrees
    );

    if (!result) {
      return;
    }

    setRotationDraft(result.nextRotation);
    setRotationHandleReadout(result.readout);
    markTransformHistoryCaptureDirty();
    applyRotationValue(result.nextRotation, rotationEditMode);
  });

  const flushPreviewDragPointer = useEffectEvent(() => {
    previewDragFrameRef.current = null;

    const pointer = previewDragPointerRef.current;

    if (!pointer) {
      return;
    }

    handlePreviewRotationDrag(pointer.clientX, pointer.clientY, pointer.shiftKey);
  });

  useEffect(() => {
    const stopPreviewRotationDrag = () => {
      const wasDragging = !!previewRotationDragRef.current;
      previewRotationDragRef.current = null;
      previewDragPointerRef.current = null;
      if (previewDragFrameRef.current !== null) {
        window.cancelAnimationFrame(previewDragFrameRef.current);
        previewDragFrameRef.current = null;
      }
      setIsDraggingRotation(false);
      setRotationHandleReadout(null);
      if (wasDragging) {
        commitTransformHistoryCapture();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!previewRotationDragRef.current) {
        return;
      }

      previewDragPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: event.shiftKey,
      };

      if (previewDragFrameRef.current === null) {
        previewDragFrameRef.current = window.requestAnimationFrame(() => {
          flushPreviewDragPointer();
        });
      }
    };

    const handleMouseUp = () => {
      stopPreviewRotationDrag();
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
  }, [commitTransformHistoryCapture, setIsDraggingRotation, setRotationHandleReadout]);

  return {
    startPreviewRotationDrag,
  };
}
