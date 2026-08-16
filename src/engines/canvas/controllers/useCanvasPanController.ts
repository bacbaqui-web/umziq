import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Position } from "@/models";
import { getCanvasWheelZoom } from "@/engines/canvas/helpers/canvasViewportHelpers";

export type CanvasPanDragState = {
  source: "space" | "middle";
  startClientX: number;
  startClientY: number;
  startPan: Position;
};

export function useCanvasPanController({
  zoom,
  pan,
  viewportRef,
  panDragRef,
  panModifierRef,
  setPan,
  applyZoom,
}: {
  zoom: number;
  pan: Position;
  viewportRef: RefObject<HTMLDivElement | null>;
  panDragRef: MutableRefObject<CanvasPanDragState | null>;
  panModifierRef: MutableRefObject<boolean>;
  setPan: Dispatch<SetStateAction<Position>>;
  applyZoom: (nextZoom: number, clientX?: number, clientY?: number) => void;
}) {
  const wheelFrameRef = useRef<number | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const pendingPanRef = useRef<Position | null>(null);
  const wheelZoomRef = useRef(zoom);
  const wheelPointerRef = useRef({ clientX: 0, clientY: 0 });

  useEffect(() => {
    if (wheelFrameRef.current === null) wheelZoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => () => {
    if (wheelFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
    }
    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    }
  }, []);

  const startPan = useCallback(
    (source: CanvasPanDragState["source"], clientX: number, clientY: number) => {
      panDragRef.current = { source, startClientX: clientX, startClientY: clientY, startPan: pan };
      viewportRef.current?.classList.add("preview-viewport--panning");
    },
    [pan, panDragRef, viewportRef]
  );

  useEffect(() => {
    const stopPan = (source?: CanvasPanDragState["source"]) => {
      if (!panDragRef.current) return;
      if (!source || panDragRef.current.source === source) {
        panDragRef.current = null;
        viewportRef.current?.classList.remove("preview-viewport--panning");
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
      pendingPanRef.current = {
        x: drag.startPan.x + event.clientX - drag.startClientX,
        y: drag.startPan.y + event.clientY - drag.startClientY,
      };
      if (panFrameRef.current !== null) return;
      panFrameRef.current = window.requestAnimationFrame(() => {
        panFrameRef.current = null;
        const nextPan = pendingPanRef.current;
        pendingPanRef.current = null;
        if (nextPan) setPan(nextPan);
      });
    };
    const handleMouseUp = () => stopPan();
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panDragRef, panModifierRef, setPan, viewportRef]);

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
      viewportRef.current?.classList.remove("preview-viewport--pan-modifier");
    };
    const stopPan = (source?: CanvasPanDragState["source"]) => {
      if (!panDragRef.current) return;
      if (!source || panDragRef.current.source === source) {
        panDragRef.current = null;
        viewportRef.current?.classList.remove("preview-viewport--panning");
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTypingTarget(event.target)) return;
      event.preventDefault();
      panModifierRef.current = true;
      viewportRef.current?.classList.add("preview-viewport--pan-modifier");
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
  }, [panDragRef, panModifierRef, viewportRef]);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      wheelPointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      if (wheelFrameRef.current !== null) return;
      wheelZoomRef.current = getCanvasWheelZoom(
        wheelZoomRef.current,
        event.deltaY
      );
      wheelFrameRef.current = window.requestAnimationFrame(() => {
        wheelFrameRef.current = null;
        const pointer = wheelPointerRef.current;
        applyZoom(
          wheelZoomRef.current,
          pointer.clientX,
          pointer.clientY
        );
      });
    },
    [applyZoom]
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
