import { useEffect, type RefObject } from "react";
import type { RenderFrame } from "@/engines/playback-render";
import { renderFrameToCanvas } from "@/engines/playback-render";

export function useCanvasRenderController({
  canvasRef,
  renderFrame,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  renderFrame: RenderFrame | null;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !renderFrame) return;
    renderFrameToCanvas(canvas, renderFrame);
  }, [canvasRef, renderFrame]);
}
