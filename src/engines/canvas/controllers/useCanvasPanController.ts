import {
  useCallback,
  useEffect,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Position } from "@/models";

export type CanvasPanDragState = {
  source: "space" | "middle";
  startClientX: number;
  startClientY: number;
  startPan: Position;
};

export function useCanvasPanController({
  zoom,
  pan,
  panDragRef,
  panModifierRef,
  setPan,
  setIsPanning,
  setIsPanModifierActive,
  applyZoom,
}: {
  zoom: number;
  pan: Position;
  panDragRef: MutableRefObject<CanvasPanDragState | null>;
  panModifierRef: MutableRefObject<boolean>;
  setPan: Dispatch<SetStateAction<Position>>;
  setIsPanning: Dispatch<SetStateAction<boolean>>;
  setIsPanModifierActive: Dispatch<SetStateAction<boolean>>;
  applyZoom: (nextZoom: number, clientX?: number, clientY?: number) => void;
}) {
  const startPan = useCallback(
    (source: CanvasPanDragState["source"], clientX: number, clientY: number) => {
      panDragRef.current = { source, startClientX: clientX, startClientY: clientY, startPan: pan };
      setIsPanning(true);
    },
    [pan, panDragRef, setIsPanning]
  );

  useEffect(() => {
    const stopPan = (source?: CanvasPanDragState["source"]) => {
      if (!panDragRef.current) return;
      if (!source || panDragRef.current.source === source) {
        panDragRef.current = null;
        setIsPanning(false);
      }
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!panDragRef.current) return;
      const drag = panDragRef.current;
      const requiredButtonMask = drag.source === "middle" ? 4 : 1;
      if (
        (event.buttons & requiredButtonMask) === 0 ||
        (drag.source === "space" && !panModifierRef.current)
      ) {
        stopPan();
        return;
      }
      setPan({
        x: drag.startPan.x + event.clientX - drag.startClientX,
        y: drag.startPan.y + event.clientY - drag.startClientY,
      });
    };
    const handleMouseUp = () => stopPan();
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panDragRef, panModifierRef, setIsPanning, setPan]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element?.isContentEditable
      );
    };
    const clearModifier = () => {
      panModifierRef.current = false;
      setIsPanModifierActive(false);
    };
    const stopPan = (source?: CanvasPanDragState["source"]) => {
      if (!panDragRef.current) return;
      if (!source || panDragRef.current.source === source) {
        panDragRef.current = null;
        setIsPanning(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTypingTarget(event.target)) return;
      event.preventDefault();
      panModifierRef.current = true;
      setIsPanModifierActive(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      clearModifier();
      stopPan("space");
    };
    const handleBlur = () => {
      clearModifier();
      stopPan();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") handleBlur();
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
  }, [panDragRef, panModifierRef, setIsPanModifierActive, setIsPanning]);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      applyZoom(zoom * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    },
    [applyZoom, zoom]
  );
  const handleMouseDownCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const source =
        event.button === 1
          ? "middle"
          : event.button === 0 && panModifierRef.current
            ? "space"
            : null;
      if (!source) return;
      event.preventDefault();
      event.stopPropagation();
      startPan(source, event.clientX, event.clientY);
    },
    [panModifierRef, startPan]
  );

  return { handleWheel, handleMouseDownCapture };
}
