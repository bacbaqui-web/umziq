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
  updateCompositionNodeRecursively,
  updateLayerRecursively,
} from "@/editor/actions/editorActions";
import {
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
  getCompensatedTransformOffset,
  resolveAnchorFromWorldPoint,
} from "@/editor/preview/previewEngine";
import type {
  Composition,
  CompositionMeta,
  Layer,
  Position,
} from "@/editor/types/types";
import type { PreviewOverlay as PreviewOverlayData } from "@/editor/types/editorViewTypes";
import { resolvePreviewPointer } from "@/features/preview/interaction/previewPointerMath";

type UsePreviewAnchorInteractionOptions = {
  masterCompId: string;
  previewOverlayRef: RefObject<HTMLDivElement | null>;
  selectedMeta: CompositionMeta | null;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewViewportOffset: Position;
  selectedPreviewOverlay: PreviewOverlayData;
  selectedTransformLocalFrame: number;
  playheadFrame: number;
  allLayersById: Map<string, Layer>;
  allCompositionsById: Map<string, Composition>;
  metaByCompId: Record<string, CompositionMeta>;
  setComps: Dispatch<SetStateAction<Composition[]>>;
  setIsDraggingAnchor: Dispatch<SetStateAction<boolean>>;
  beginTransformHistoryCapture: () => void;
  markTransformHistoryCaptureDirty: () => void;
  commitTransformHistoryCapture: () => void;
};

export function usePreviewAnchorInteraction({
  masterCompId,
  previewOverlayRef,
  selectedMeta,
  previewSize,
  previewZoom,
  previewViewportOffset,
  selectedPreviewOverlay,
  selectedTransformLocalFrame,
  playheadFrame,
  allLayersById,
  allCompositionsById,
  metaByCompId,
  setComps,
  setIsDraggingAnchor,
  beginTransformHistoryCapture,
  markTransformHistoryCaptureDirty,
  commitTransformHistoryCapture,
}: UsePreviewAnchorInteractionOptions) {
  const previewDragFrameRef = useRef<number | null>(null);
  const previewDragPointerRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const previewAnchorDragRef = useRef<PreviewOverlayData>(null);

  const applyAnchorUpdateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!previewAnchorDragRef.current || !previewOverlayRef.current || !selectedMeta) {
        return;
      }

      const overlay = previewAnchorDragRef.current;
      const pointer = resolvePreviewPointer({
        overlayBounds: previewOverlayRef.current.getBoundingClientRect(),
        selectedMeta,
        previewSize: {
          width: previewSize.width,
          height: previewSize.height,
        },
        previewZoom,
        previewViewportOffset: {
          x: previewViewportOffset.x,
          y: previewViewportOffset.y,
        },
        clientX,
        clientY,
      });

      if (overlay.targetKind === "layer") {
        const layer = allLayersById.get(overlay.targetId);

        if (!layer) {
          return;
        }

        const layerScale = evaluateLayerScale(layer, selectedTransformLocalFrame);
        const layerRotation = evaluateLayerRotation(layer, selectedTransformLocalFrame);
        const layerPosition = evaluateLayerPosition(layer, playheadFrame);
        const nextAnchor = resolveAnchorFromWorldPoint(
          pointer,
          layerPosition,
          layer.transformOffset,
          layer.anchor,
          layerScale,
          layerRotation,
          overlay.sourceWidth,
          overlay.sourceHeight
        );
        const nextTransformOffset = getCompensatedTransformOffset(
          layer.transformOffset,
          layer.anchor,
          nextAnchor,
          layerScale,
          layerRotation
        );

        setComps((prev) =>
          prev.map((comp) =>
            updateLayerRecursively(comp, overlay.targetId, (targetLayer) => ({
              ...targetLayer,
              anchor: nextAnchor,
              transformOffset: nextTransformOffset,
            }))
          )
        );
        markTransformHistoryCaptureDirty();
        return;
      }

      if (overlay.targetId === masterCompId) {
        return;
      }

      const composition = allCompositionsById.get(overlay.targetId);

      if (!composition) {
        return;
      }

      const compositionMeta = metaByCompId[composition.id] ?? selectedMeta;
      const compositionScale = evaluateCompositionScale(composition, selectedTransformLocalFrame);
      const compositionRotation = evaluateCompositionRotation(
        composition,
        selectedTransformLocalFrame
      );
      const compositionPosition = evaluateCompositionPosition(
        composition,
        selectedTransformLocalFrame
      );
      const nextAnchor = resolveAnchorFromWorldPoint(
        pointer,
        compositionPosition,
        composition.transformOffset,
        composition.anchor,
        compositionScale,
        compositionRotation,
        compositionMeta.width,
        compositionMeta.height
      );
      const nextTransformOffset = getCompensatedTransformOffset(
        composition.transformOffset,
        composition.anchor,
        nextAnchor,
        compositionScale,
        compositionRotation
      );

      setComps((prev) =>
        prev.map((comp) =>
          updateCompositionNodeRecursively(comp, overlay.targetId, (target) => ({
            ...target,
            anchor: nextAnchor,
            transformOffset: nextTransformOffset,
          }))
        )
      );
      markTransformHistoryCaptureDirty();
    },
    [
      allCompositionsById,
      allLayersById,
      masterCompId,
      markTransformHistoryCaptureDirty,
      metaByCompId,
      playheadFrame,
      previewOverlayRef,
      previewSize.height,
      previewSize.width,
      previewViewportOffset.x,
      previewViewportOffset.y,
      previewZoom,
      selectedMeta,
      selectedTransformLocalFrame,
      setComps,
    ]
  );

  const flushPreviewDragPointer = useEffectEvent(() => {
    previewDragFrameRef.current = null;

    const pointer = previewDragPointerRef.current;

    if (!pointer) {
      return;
    }

    applyAnchorUpdateFromPointer(pointer.clientX, pointer.clientY);
  });

  useEffect(() => {
    const stopAnchorDrag = () => {
      const wasDragging = !!previewAnchorDragRef.current;
      previewAnchorDragRef.current = null;
      previewDragPointerRef.current = null;
      if (previewDragFrameRef.current !== null) {
        window.cancelAnimationFrame(previewDragFrameRef.current);
        previewDragFrameRef.current = null;
      }
      setIsDraggingAnchor(false);
      if (wasDragging) {
        commitTransformHistoryCapture();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!previewAnchorDragRef.current) {
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
      stopAnchorDrag();
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
  }, [commitTransformHistoryCapture, setIsDraggingAnchor]);

  const onAnchorMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedPreviewOverlay) {
        return;
      }
      beginTransformHistoryCapture();
      previewAnchorDragRef.current = selectedPreviewOverlay;
      setIsDraggingAnchor(true);
    },
    [
      beginTransformHistoryCapture,
      selectedPreviewOverlay,
      setIsDraggingAnchor,
    ]
  );

  return {
    onAnchorMouseDown,
  };
}
