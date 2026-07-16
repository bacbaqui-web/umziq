import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Position } from "@/models";
import {
  clampCanvasZoom,
  getCanvasZoomPan,
  getCenteredCanvasPan,
} from "@/engines/canvas/helpers/canvasViewportHelpers";
import type { CanvasSize } from "@/engines/canvas/models/canvasEngineModel";

export function useCanvasViewportController({
  viewportRef,
  baseOffset,
  previewSize,
  zoom,
  pan,
  fitZoom,
  setZoom,
  setPan,
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  baseOffset: Position;
  previewSize: CanvasSize;
  zoom: number;
  pan: Position;
  fitZoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  setPan: Dispatch<SetStateAction<Position>>;
}) {
  const recenterAtZoom = useCallback(
    (nextZoom: number) => {
      setPan(getCenteredCanvasPan(previewSize.width, previewSize.height, nextZoom));
    },
    [previewSize.height, previewSize.width, setPan]
  );

  const applyZoom = useCallback(
    (nextZoom: number, clientX?: number, clientY?: number) => {
      const viewport = viewportRef.current;
      const clampedZoom = clampCanvasZoom(nextZoom);
      if (!viewport) {
        setZoom(clampedZoom);
        recenterAtZoom(clampedZoom);
        return;
      }

      const bounds = viewport.getBoundingClientRect();
      const result = getCanvasZoomPan({
        pointer: {
          x: clientX !== undefined ? clientX - bounds.left : bounds.width / 2,
          y: clientY !== undefined ? clientY - bounds.top : bounds.height / 2,
        },
        baseOffset,
        pan,
        currentZoom: zoom,
        nextZoom,
      });
      setZoom(result.zoom);
      setPan(result.pan);
    },
    [baseOffset, pan, recenterAtZoom, setPan, setZoom, viewportRef, zoom]
  );

  const resetViewport = useCallback(() => {
    setZoom(fitZoom);
    recenterAtZoom(fitZoom);
  }, [fitZoom, recenterAtZoom, setZoom]);

  const centerViewport = useCallback(() => {
    recenterAtZoom(zoom);
  }, [recenterAtZoom, zoom]);

  const setActualSize = useCallback(() => {
    setZoom(1);
    recenterAtZoom(1);
  }, [recenterAtZoom, setZoom]);

  return { applyZoom, resetViewport, centerViewport, setActualSize };
}
