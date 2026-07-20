import { useCallback } from "react";
import { getTransformEditMode } from "@/engines/animation";
import {
  calculateRotationDragUpdate,
  formatRotationHandleValue,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
import { createPreviewRotationDragState } from "@/engines/canvas/helpers/canvasPointerHelpers";
import type {
  CanvasPointerContextResolver,
  CanvasTransformDraftRuntimePort,
  UseCanvasTransformControllerOptions,
} from "@/engines/canvas/models/canvasTransformControllerModel";

export function useCanvasRotationDragController(
  options: UseCanvasTransformControllerOptions,
  getPointerContext: CanvasPointerContextResolver,
  draftRuntime: CanvasTransformDraftRuntimePort
) {
  return useCallback(
    (clientX: number, clientY: number) => {
      const context = getPointerContext(clientX, clientY);
      if (!context || !options.selectedOverlay) return;
      const drag = createPreviewRotationDragState(context, options.selectedOverlay);
      const mode = getTransformEditMode(options.selectedPropertyState.rotation);
      let latestRotation: number | null = null;
      options.history.begin();
      options.state.setIsDraggingRotation(true);
      options.state.setRotationHandleReadout(
        formatRotationHandleValue(options.selectedOverlay.rotation)
      );
      options.pointer.start({
        onMove: (sample) => {
          const nextContext = getPointerContext(sample.clientX, sample.clientY);
          if (!nextContext) return;
          const result = calculateRotationDragUpdate(nextContext, drag, sample.shiftKey);
          if (!result) return;
          latestRotation = result.nextRotation;
          options.drafts.setRotation(result.nextRotation);
          options.state.setRotationHandleReadout(result.readout);
          draftRuntime.updateTransform({
            rotation: result.nextRotation,
          });
        },
        onCommit: () => {
          if (latestRotation !== null) {
            options.commands.applyRotation(latestRotation, mode);
            options.metrics?.increment("projectUpdate");
            options.history.markDirty();
          }
          options.drafts.setRotation(null);
          options.state.setIsDraggingRotation(false);
          options.state.setRotationHandleReadout(null);
          draftRuntime.reset();
          options.history.commit();
          options.metrics?.increment("historyCommit");
        },
        onCancel: () => {
          options.drafts.setRotation(null);
          options.state.setIsDraggingRotation(false);
          options.state.setRotationHandleReadout(null);
          draftRuntime.reset();
          options.history.cancel();
        },
      });
    },
    [draftRuntime, getPointerContext, options]
  );
}
