import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { formatScaleHandleReadout } from "@/editor/preview/previewEngine";
import type { CompositionMeta, Position, Scale } from "@/editor/types/types";
import type {
  PreviewOverlay as PreviewOverlayData,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";
import type { TransformEditMode } from "@/editor/types/transformActionTypes";
import { calculateScaleDragUpdate } from "@/features/preview/interaction/previewInteractionMath";

type UsePreviewScaleInteractionOptions = {
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedPreviewOverlay: PreviewOverlayData;
  scaleEditMode: TransformEditMode;
  setScaleDraft: Dispatch<SetStateAction<Scale | null>>;
  setScaleHandleReadout: Dispatch<
    SetStateAction<{
      handle: ScaleHandleDirection;
      text: string;
    } | null>
  >;
  beginTransformHistoryCapture: () => void;
  markTransformHistoryCaptureDirty: () => void;
  commitTransformHistoryCapture: () => void;
  applyScaleValue: (nextScale: Scale, editMode: TransformEditMode) => void;
};

export function usePreviewScaleInteraction({
  previewOverlayRef,
  selectedMeta,
  previewSize,
  previewZoom,
  previewViewportOffset,
  selectedPreviewOverlay,
  scaleEditMode,
  setScaleDraft,
  setScaleHandleReadout,
  beginTransformHistoryCapture,
  markTransformHistoryCaptureDirty,
  commitTransformHistoryCapture,
  applyScaleValue,
}: UsePreviewScaleInteractionOptions) {
  const previewDragFrameRef = useRef<number | null>(null);
  const previewDragPointerRef = useRef<{
    clientX: number;
    clientY: number;
    shiftKey: boolean;
  } | null>(null);
  const previewScaleDragRef = useRef<{
    overlay: NonNullable<PreviewOverlayData>;
    handle: ScaleHandleDirection;
    initialScale: Scale;
  } | null>(null);

  const startPreviewScaleDrag = useCallback(
    (handle: ScaleHandleDirection) => {
      if (!selectedPreviewOverlay) {
        return;
      }

      previewScaleDragRef.current = {
        overlay: selectedPreviewOverlay,
        handle,
        initialScale: {
          x: selectedPreviewOverlay.scaleX,
          y: selectedPreviewOverlay.scaleY,
        },
      };
      beginTransformHistoryCapture();
      setScaleHandleReadout({
        handle,
        text: formatScaleHandleReadout(handle, {
          x: selectedPreviewOverlay.scaleX,
          y: selectedPreviewOverlay.scaleY,
        }),
      });
    },
    [beginTransformHistoryCapture, selectedPreviewOverlay, setScaleHandleReadout]
  );

  const handlePreviewScaleDrag = useEffectEvent((
    clientX: number,
    clientY: number,
    snapToTenPercent: boolean
  ) => {
    if (!previewScaleDragRef.current || !previewOverlayRef.current || !selectedMeta) {
      return;
    }

    const result = calculateScaleDragUpdate(
      {
        overlayBounds: previewOverlayRef.current.getBoundingClientRect(),
        selectedMeta,
        previewSize,
        previewZoom,
        previewViewportOffset,
        clientX,
        clientY,
      },
      previewScaleDragRef.current,
      snapToTenPercent
    );

    if (!result) {
      return;
    }

    const handle = previewScaleDragRef.current.handle;
    setScaleDraft(result.nextScale);
    setScaleHandleReadout({
      handle,
      text: result.readout,
    });
    markTransformHistoryCaptureDirty();
    applyScaleValue(result.nextScale, scaleEditMode);
  });

  const flushPreviewDragPointer = useEffectEvent(() => {
    previewDragFrameRef.current = null;

    const pointer = previewDragPointerRef.current;

    if (!pointer) {
      return;
    }

    handlePreviewScaleDrag(pointer.clientX, pointer.clientY, pointer.shiftKey);
  });

  useEffect(() => {
    const stopPreviewScaleDrag = () => {
      const wasDragging = !!previewScaleDragRef.current;
      previewScaleDragRef.current = null;
      previewDragPointerRef.current = null;
      if (previewDragFrameRef.current !== null) {
        window.cancelAnimationFrame(previewDragFrameRef.current);
        previewDragFrameRef.current = null;
      }
      setScaleHandleReadout(null);
      if (wasDragging) {
        commitTransformHistoryCapture();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!previewScaleDragRef.current) {
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
      stopPreviewScaleDrag();
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
  }, [commitTransformHistoryCapture, setScaleHandleReadout]);

  return {
    startPreviewScaleDrag,
  };
}
