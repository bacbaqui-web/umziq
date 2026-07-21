import { useCallback } from "react";
import { getTransformEditMode } from "@/engines/animation";
import {
  calculateScaleDragUpdate,
  formatScaleHandleReadout,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
import type {
  CanvasPointerContextResolver,
  CanvasTransformDraftRuntimePort,
  UseCanvasTransformControllerOptions,
} from "@/engines/canvas/models/canvasTransformControllerModel";
import type { ScaleHandleDirection } from "@/engines/canvas/models/canvasViewModel";
import { resolvePreviewPointer } from "@/engines/canvas/helpers/canvasPointerHelpers";
import type { Scale } from "@/models";

export function useCanvasScaleDragController(
  options: UseCanvasTransformControllerOptions,
  getPointerContext: CanvasPointerContextResolver,
  draftRuntime: CanvasTransformDraftRuntimePort
) {
  return useCallback(
    (handle: ScaleHandleDirection, clientX: number, clientY: number) => {
      if (!options.selectedOverlay) return;
      const startContext = getPointerContext(clientX, clientY);
      if (!startContext) return;
      const drag = {
        overlay: options.selectedOverlay,
        handle,
        initialScale: {
          x: options.selectedOverlay.scaleX,
          y: options.selectedOverlay.scaleY,
        },
        startPointer: resolvePreviewPointer(startContext),
      };
      const mode = getTransformEditMode(options.selectedPropertyState.scale);
      let latestScale: Scale | null = null;
      options.history.begin();
      options.state.setIsDraggingScale(true);
      options.state.setScaleHandleReadout({
        handle,
        text: formatScaleHandleReadout(handle, drag.initialScale),
      });
      options.pointer.start({
        onMove: (sample) => {
          const context = getPointerContext(sample.clientX, sample.clientY);
          if (!context) return;
          const result = calculateScaleDragUpdate(context, drag, sample.shiftKey);
          if (!result) return;
          const snapshot = draftRuntime.updateTransform({ scale: result.nextScale });
          if (!snapshot) return;
          latestScale = result.nextScale;
          options.drafts.setScale(result.nextScale);
          options.state.setScaleHandleReadout({ handle, text: result.readout });
        },
        onCommit: () => {
          if (latestScale) {
            options.commands.applyScale(latestScale, mode);
            options.metrics?.increment("projectUpdate");
            options.history.markDirty();
          }
          options.drafts.setScale(null);
          options.state.setIsDraggingScale(false);
          options.state.setScaleHandleReadout(null);
          draftRuntime.reset();
          options.history.commit();
          options.metrics?.increment("historyCommit");
        },
        onCancel: () => {
          options.drafts.setScale(null);
          options.state.setIsDraggingScale(false);
          options.state.setScaleHandleReadout(null);
          draftRuntime.reset();
          options.history.cancel();
        },
      });
    },
    [draftRuntime, getPointerContext, options]
  );
}
