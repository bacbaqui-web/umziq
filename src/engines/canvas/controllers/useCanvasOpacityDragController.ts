import { useCallback } from "react";
import { getTransformEditMode } from "@/engines/animation";
import { calculateOpacityDragUpdate } from "@/engines/canvas/helpers/canvasInteractionHelpers";
import type {
  CanvasPointerContextResolver,
  CanvasTransformDraftRuntimePort,
  UseCanvasTransformControllerOptions,
} from "@/engines/canvas/models/canvasTransformControllerModel";

export function useCanvasOpacityDragController(
  options: UseCanvasTransformControllerOptions,
  getPointerContext: CanvasPointerContextResolver,
  draftRuntime: CanvasTransformDraftRuntimePort
) {
  return useCallback(() => {
    if (!options.selectedOverlay) return;
    const overlay = options.selectedOverlay;
    const mode = getTransformEditMode(options.selectedPropertyState.opacity);
    let latestOpacity: number | null = null;
    options.history.begin();
    options.state.setIsDraggingOpacity(true);
    options.state.setOpacityHandleReadout(`${Math.round(options.resolvedOpacity)}%`);
    options.pointer.start({
      onMove: (sample) => {
        const context = getPointerContext(sample.clientX, sample.clientY);
        if (!context) return;
        const result = calculateOpacityDragUpdate(context, overlay, sample.shiftKey);
        latestOpacity = result.nextOpacity;
        options.drafts.setOpacity(result.nextOpacity);
        options.state.setOpacityHandleReadout(result.readout);
        draftRuntime.updateTransform({ opacity: result.nextOpacity });
      },
      onCommit: () => {
        if (latestOpacity !== null) {
          options.commands.applyOpacity(latestOpacity, mode);
          options.metrics?.increment("projectUpdate");
          options.history.markDirty();
        }
        options.drafts.setOpacity(null);
        options.state.setIsDraggingOpacity(false);
        options.state.setOpacityHandleReadout(null);
        draftRuntime.reset();
        options.history.commit();
        options.metrics?.increment("historyCommit");
      },
      onCancel: () => {
        options.drafts.setOpacity(null);
        options.state.setIsDraggingOpacity(false);
        options.state.setOpacityHandleReadout(null);
        draftRuntime.reset();
        options.history.cancel();
      },
    });
  }, [draftRuntime, getPointerContext, options]);
}
