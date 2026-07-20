import { useCallback, useEffect, useRef } from "react";
import type {
  CanvasPointerController,
} from "@/engines/canvas/models/canvasInteractionModel";
import { createCanvasPointerFrameScheduler } from "@/engines/canvas/helpers/canvasPointerFrameHelpers";

export function useCanvasPointerController(): CanvasPointerController {
  const schedulerRef = useRef(
    createCanvasPointerFrameScheduler({
      requestFrame: (callback) => window.requestAnimationFrame(callback),
      cancelFrame: (frameId) => window.cancelAnimationFrame(frameId),
    })
  );
  const finish = useCallback(
    (mode: "commit" | "cancel") => schedulerRef.current.finish(mode),
    []
  );
  const start = useCallback<CanvasPointerController["start"]>(
    (session) => schedulerRef.current.start(session),
    []
  );

  useEffect(() => {
    const scheduler = schedulerRef.current;
    const handleMouseMove = (event: MouseEvent) => {
      scheduler.push({
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: event.shiftKey,
      });
    };
    const handleMouseUp = () => finish("commit");
    const handleCancel = () => finish("cancel");
    const handleVisibilityChange = () => {
      if (document.hidden) handleCancel();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("blur", handleCancel);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("blur", handleCancel);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      scheduler.dispose();
    };
  }, [finish]);

  return { start, cancel: () => finish("cancel") };
}
