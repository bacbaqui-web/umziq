import { useCallback, useEffect, useRef } from "react";
import type {
  CanvasPointerController,
  CanvasPointerSample,
  CanvasPointerSession,
} from "@/engines/canvas/models/canvasInteractionModel";

export function useCanvasPointerController(): CanvasPointerController {
  const sessionRef = useRef<CanvasPointerSession | null>(null);
  const pendingSampleRef = useRef<CanvasPointerSample | null>(null);
  const frameRef = useRef<number | null>(null);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingSampleRef.current = null;
  }, []);

  const finish = useCallback(
    (mode: "commit" | "cancel") => {
      const session = sessionRef.current;
      sessionRef.current = null;
      cancelFrame();
      if (!session) return;
      if (mode === "commit") session.onCommit();
      else session.onCancel();
    },
    [cancelFrame]
  );

  const start = useCallback(
    (session: CanvasPointerSession) => {
      if (sessionRef.current) finish("cancel");
      sessionRef.current = session;
    },
    [finish]
  );

  useEffect(() => {
    const flush = () => {
      frameRef.current = null;
      const session = sessionRef.current;
      const sample = pendingSampleRef.current;
      pendingSampleRef.current = null;
      if (session && sample) session.onMove(sample);
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!sessionRef.current) return;
      pendingSampleRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        shiftKey: event.shiftKey,
      };
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(flush);
      }
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
      finish("cancel");
    };
  }, [finish]);

  return { start, cancel: () => finish("cancel") };
}
