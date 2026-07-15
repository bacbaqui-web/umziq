import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Position } from "@/editor/types/types";

type PreviewPanDragState = {
  source: "space" | "middle";
  startClientX: number;
  startClientY: number;
  startPan: Position;
};

type UsePreviewPanInteractionsOptions = {
  previewZoom: number;
  previewPan: Position;
  previewPanDragRef: MutableRefObject<PreviewPanDragState | null>;
  previewPanModifierRef: MutableRefObject<boolean>;
  setPreviewPan: Dispatch<SetStateAction<Position>>;
  setIsPreviewPanning: Dispatch<SetStateAction<boolean>>;
  setIsPreviewPanModifierActive: Dispatch<SetStateAction<boolean>>;
  applyPreviewZoom: (nextZoom: number, clientX?: number, clientY?: number) => void;
};

export function usePreviewPanInteractions({
  previewZoom,
  previewPan,
  previewPanDragRef,
  previewPanModifierRef,
  setPreviewPan,
  setIsPreviewPanning,
  setIsPreviewPanModifierActive,
  applyPreviewZoom,
}: UsePreviewPanInteractionsOptions) {
  const startPreviewPan = useCallback(
    (source: "space" | "middle", clientX: number, clientY: number) => {
      previewPanDragRef.current = {
        source,
        startClientX: clientX,
        startClientY: clientY,
        startPan: previewPan,
      };
      setIsPreviewPanning(true);
    },
    [previewPan, previewPanDragRef, setIsPreviewPanning]
  );

  useEffect(() => {
    const stopPreviewPan = (source?: "space" | "middle") => {
      if (!previewPanDragRef.current) {
        return;
      }

      if (!source || previewPanDragRef.current.source === source) {
        previewPanDragRef.current = null;
        setIsPreviewPanning(false);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!previewPanDragRef.current) {
        return;
      }

      const { source, startClientX, startClientY, startPan } = previewPanDragRef.current;
      const requiredButtonMask = source === "middle" ? 4 : 1;

      if (
        (event.buttons & requiredButtonMask) === 0 ||
        (source === "space" && !previewPanModifierRef.current)
      ) {
        stopPreviewPan();
        return;
      }

      setPreviewPan({
        x: startPan.x + (event.clientX - startClientX),
        y: startPan.y + (event.clientY - startClientY),
      });
    };

    const handleMouseUp = () => {
      stopPreviewPan();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [previewPanDragRef, previewPanModifierRef, setIsPreviewPanning, setPreviewPan]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element?.isContentEditable
      );
    };

    const clearPreviewPanModifier = () => {
      previewPanModifierRef.current = false;
      setIsPreviewPanModifierActive(false);
    };

    const stopPreviewPan = (source?: "space" | "middle") => {
      if (!previewPanDragRef.current) {
        return;
      }

      if (!source || previewPanDragRef.current.source === source) {
        previewPanDragRef.current = null;
        setIsPreviewPanning(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTypingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      previewPanModifierRef.current = true;
      setIsPreviewPanModifierActive(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      clearPreviewPanModifier();
      stopPreviewPan("space");
    };

    const handleBlur = () => {
      clearPreviewPanModifier();
      stopPreviewPan();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        clearPreviewPanModifier();
        stopPreviewPan();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    previewPanDragRef,
    previewPanModifierRef,
    setIsPreviewPanModifierActive,
    setIsPreviewPanning,
  ]);

  const handlePreviewViewportWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      applyPreviewZoom(previewZoom * zoomFactor, event.clientX, event.clientY);
    },
    [applyPreviewZoom, previewZoom]
  );

  const handlePreviewViewportMouseDownCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const panSource =
        event.button === 1
          ? "middle"
          : event.button === 0 && previewPanModifierRef.current
            ? "space"
            : null;

      if (!panSource) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      startPreviewPan(panSource, event.clientX, event.clientY);
    },
    [previewPanModifierRef, startPreviewPan]
  );

  return {
    handlePreviewViewportWheel,
    handlePreviewViewportMouseDownCapture,
  };
}
