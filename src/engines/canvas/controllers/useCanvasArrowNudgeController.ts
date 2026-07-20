import { useEffect, useEffectEvent } from "react";
import { getTransformEditMode } from "@/engines/animation";
import type { UseCanvasTransformControllerOptions } from "@/engines/canvas/models/canvasTransformControllerModel";

export function useCanvasArrowNudgeController(
  options: UseCanvasTransformControllerOptions
) {
  const handleArrowNudge = useEffectEvent((event: KeyboardEvent) => {
    if (!options.selectedTarget) return;
    const target = event.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable
    ) return;
    const step = event.shiftKey ? 10 : 1;
    const delta =
      event.key === "ArrowLeft" ? { x: -step, y: 0 }
        : event.key === "ArrowRight" ? { x: step, y: 0 }
          : event.key === "ArrowUp" ? { x: 0, y: -step }
            : event.key === "ArrowDown" ? { x: 0, y: step }
              : null;
    if (!delta) return;
    event.preventDefault();
    options.history.push();
    const next = {
      x: options.resolvedPosition.x + delta.x,
      y: options.resolvedPosition.y + delta.y,
    };
    options.drafts.setPosition(next);
    options.commands.applyPosition(
      next,
      getTransformEditMode(options.selectedPropertyState.position)
    );
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleArrowNudge(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
