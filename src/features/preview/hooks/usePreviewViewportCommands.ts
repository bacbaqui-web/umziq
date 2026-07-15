import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react";
import { clampPreviewZoom, getCenteredPreviewPan } from "@/editor/preview/previewCamera";
import type { Position } from "@/editor/types/types";

type UsePreviewViewportCommandsOptions = {
  previewViewportRef: RefObject<HTMLDivElement | null>;
  previewBaseOffset: Position;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewPan: Position;
  previewFitZoom: number;
  setPreviewZoom: Dispatch<SetStateAction<number>>;
  setPreviewPan: Dispatch<SetStateAction<Position>>;
};

export function usePreviewViewportCommands({
  previewViewportRef,
  previewBaseOffset,
  previewSize,
  previewZoom,
  previewPan,
  previewFitZoom,
  setPreviewZoom,
  setPreviewPan,
}: UsePreviewViewportCommandsOptions) {
  const recenterPreviewAtZoom = useCallback(
    (zoom: number) => {
      setPreviewPan(getCenteredPreviewPan(previewSize.width, previewSize.height, zoom));
    },
    [previewSize.height, previewSize.width, setPreviewPan]
  );

  const applyPreviewZoom = useCallback(
    (nextZoom: number, clientX?: number, clientY?: number) => {
      const viewport = previewViewportRef.current;
      const clampedZoom = clampPreviewZoom(nextZoom);

      if (!viewport) {
        setPreviewZoom(clampedZoom);
        recenterPreviewAtZoom(clampedZoom);
        return;
      }

      const bounds = viewport.getBoundingClientRect();
      const pointerX =
        clientX !== undefined ? clientX - bounds.left : bounds.width / 2;
      const pointerY =
        clientY !== undefined ? clientY - bounds.top : bounds.height / 2;
      const localX =
        (pointerX - previewBaseOffset.x - previewPan.x) / previewZoom;
      const localY =
        (pointerY - previewBaseOffset.y - previewPan.y) / previewZoom;

      setPreviewZoom(clampedZoom);
      setPreviewPan({
        x: pointerX - previewBaseOffset.x - localX * clampedZoom,
        y: pointerY - previewBaseOffset.y - localY * clampedZoom,
      });
    },
    [
      previewBaseOffset.x,
      previewBaseOffset.y,
      previewPan.x,
      previewPan.y,
      previewViewportRef,
      previewZoom,
      recenterPreviewAtZoom,
      setPreviewPan,
      setPreviewZoom,
    ]
  );

  const resetPreviewView = useCallback(() => {
    setPreviewZoom(previewFitZoom);
    recenterPreviewAtZoom(previewFitZoom);
  }, [previewFitZoom, recenterPreviewAtZoom, setPreviewZoom]);

  const centerPreviewView = useCallback(() => {
    recenterPreviewAtZoom(previewZoom);
  }, [previewZoom, recenterPreviewAtZoom]);

  const setOneToOnePreviewView = useCallback(() => {
    setPreviewZoom(1);
    recenterPreviewAtZoom(1);
  }, [recenterPreviewAtZoom, setPreviewZoom]);

  return {
    applyPreviewZoom,
    resetPreviewView,
    centerPreviewView,
    setOneToOnePreviewView,
  };
}
