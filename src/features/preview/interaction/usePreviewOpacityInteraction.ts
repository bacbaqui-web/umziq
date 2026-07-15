import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { CompositionMeta, Position } from "@/editor/types/types";
import type { PreviewOverlay as PreviewOverlayData } from "@/editor/types/editorViewTypes";
import type { TransformEditMode } from "@/editor/types/transformActionTypes";
import { calculateOpacityDragUpdate } from "@/features/preview/interaction/previewInteractionMath";

type UsePreviewOpacityInteractionOptions = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedPreviewOverlay: PreviewOverlayData;
  resolvedOpacityDraft: number;
  opacityEditMode: TransformEditMode;
  setOpacityDraft: Dispatch<SetStateAction<number | null>>;
  setIsDraggingOpacity: Dispatch<SetStateAction<boolean>>;
  setOpacityHandleReadout: Dispatch<SetStateAction<string | null>>;
  beginTransformHistoryCapture: () => void;
  markTransformHistoryCaptureDirty: () => void;
  commitTransformHistoryCapture: () => void;
  applyOpacityValue: (nextOpacity: number, editMode: TransformEditMode) => void;
};

export function usePreviewOpacityInteraction({
  previewOverlayRef,
  selectedMeta,
  previewSize,
  previewZoom,
  previewViewportOffset,
  selectedPreviewOverlay,
  resolvedOpacityDraft,
  opacityEditMode,
  setOpacityDraft,
  setIsDraggingOpacity,
  setOpacityHandleReadout,
  beginTransformHistoryCapture,
  markTransformHistoryCaptureDirty,
  commitTransformHistoryCapture,
  applyOpacityValue,
}: UsePreviewOpacityInteractionOptions) {
  const previewDragFrameRef = useRef<number | null>(null);
  const previewDragPointerRef = useRef<{
    clientX: number;
    clientY: number;
    shiftKey: boolean;
  } | null>(null);
  const previewOpacityDragRef = useRef<NonNullable<PreviewOverlayData> | null>(null);

  const startPreviewOpacityDrag = useCallback(() => {
    if (!selectedPreviewOverlay) {
      return;
    }

    previewOpacityDragRef.current = selectedPreviewOverlay;
    beginTransformHistoryCapture();
    setIsDraggingOpacity(true);
    setOpacityHandleReadout(`${Math.round(resolvedOpacityDraft)}%`);
  }, [
    beginTransformHistoryCapture,
    resolvedOpacityDraft,
    selectedPreviewOverlay,
    setIsDraggingOpacity,
    setOpacityHandleReadout,
  ]);

  const handlePreviewOpacityDrag = useEffectEvent((
    clientX: number,
    clientY: number,
    snapToTenPercent: boolean
  ) => {
    if (!previewOpacityDragRef.current || !previewOverlayRef.current || !selectedMeta) {
      return;
    }

    const { nextOpacity, readout } = calculateOpacityDragUpdate(
      {
        overlayBounds: previewOverlayRef.current.getBoundingClientRect(),
        selectedMeta,
        previewSize,
        previewZoom,
        previewViewportOffset,
        clientX,
        clientY,
      },
      previewOpacityDragRef.current,
      snapToTenPercent
    );
    setOpacityDraft(nextOpacity);
    setOpacityHandleReadout(readout);
    markTransformHistoryCaptureDirty();
    applyOpacityValue(nextOpacity, opacityEditMode);
  });

  const flushPreviewDragPointer = useEffectEvent(() => {
    previewDragFrameRef.current = null;

    const pointer = previewDragPointerRef.current;

    if (!pointer) {
      return;
    }

    handlePreviewOpacityDrag(pointer.clientX, pointer.clientY, pointer.shiftKey);
  });

  useEffect(() => {
    const stopPreviewOpacityDrag = () => {
      const wasDragging = !!previewOpacityDragRef.current;
      previewOpacityDragRef.current = null;
      previewDragPointerRef.current = null;
      if (previewDragFrameRef.current !== null) {
        window.cancelAnimationFrame(previewDragFrameRef.current);
        previewDragFrameRef.current = null;
      }
      setIsDraggingOpacity(false);
      setOpacityHandleReadout(null);
      if (wasDragging) {
        commitTransformHistoryCapture();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!previewOpacityDragRef.current) {
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
      stopPreviewOpacityDrag();
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
  }, [commitTransformHistoryCapture, setIsDraggingOpacity, setOpacityHandleReadout]);

  return {
    startPreviewOpacityDrag,
  };
}
