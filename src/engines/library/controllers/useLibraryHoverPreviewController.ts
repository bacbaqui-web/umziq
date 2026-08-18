import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryHoverPreviewViewModel } from "@/engines/library/models/libraryModel";
import {
  measureLayerHoverPreview,
  positionLayerHoverPreview,
} from "@/shared/helpers/layerHoverPreviewHelpers";

type HoverPreviewState = {
  preview: LibraryHoverPreviewViewModel;
  x: number;
  y: number;
} | null;

export function useLibraryHoverPreviewController(projectIdentity: string) {
  const [preview, setPreview] = useState<HoverPreviewState>(null);
  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<HoverPreviewState>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
    setPreview(null);
  }, []);

  useEffect(() => clear, [clear, projectIdentity]);

  const move = useCallback(
    (
      nextPreview: LibraryHoverPreviewViewModel,
      clientX: number,
      clientY: number
    ) => {
      const cardHeight =
        nextPreview.kind === "audio"
          ? 154
          : measureLayerHoverPreview({
              hasVisual:
                nextPreview.status === "ready" &&
                Boolean(nextPreview.surface),
              width: nextPreview.width,
              height: nextPreview.height,
            }).cardHeight;
      const position = positionLayerHoverPreview({
        clientX,
        clientY,
        cardHeight,
      });
      const next = {
        preview: nextPreview,
        x: position.x,
        y: position.y,
      };
      pendingRef.current = next;
      if (preview) {
        setPreview(next);
        return;
      }
      if (timerRef.current !== null) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setPreview(pendingRef.current);
      }, 180);
    },
    [preview]
  );

  return { preview, move, clear };
}
