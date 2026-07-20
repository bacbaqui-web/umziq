import { useCallback } from "react";
import {
  evaluateCompositionBasePosition,
  evaluateLayerBasePosition,
  getTransformEditMode,
} from "@/engines/animation";
import {
  calculatePreviewPositionDragUpdate,
  formatPositionDeltaReadout,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
import { createPreviewPositionDragState } from "@/engines/canvas/helpers/canvasPointerHelpers";
import type {
  CanvasPointerContextResolver,
  CanvasTransformDraftRuntimePort,
  UseCanvasTransformControllerOptions,
} from "@/engines/canvas/models/canvasTransformControllerModel";
import type { Position } from "@/models";

export function useCanvasPositionDragController(
  options: UseCanvasTransformControllerOptions,
  getPointerContext: CanvasPointerContextResolver,
  draftRuntime: CanvasTransformDraftRuntimePort
) {
  return useCallback(
    (clientX: number, clientY: number) => {
      const context = getPointerContext(clientX, clientY);
      if (!context || !options.selectedOverlay) return;
      const localFrame = options.selectedTimelineTargetItem
        ? Math.max(0, options.playheadFrame - options.selectedTimelineTargetItem.startFrame)
        : options.playheadFrame;
      const startPosition =
        options.selectedTarget?.kind === "layer"
          ? evaluateLayerBasePosition(options.selectedTarget.layer, localFrame)
          : options.selectedTarget?.kind === "composition"
            ? evaluateCompositionBasePosition(
                options.selectedTarget.composition,
                localFrame
              )
            : options.resolvedPosition;
      const drag = createPreviewPositionDragState(
        context,
        options.selectedOverlay,
        startPosition
      );
      const mode = getTransformEditMode(options.selectedPropertyState.position);
      let latestPosition: Position | null = null;
      options.history.begin();
      options.state.setIsDraggingPosition(true);
      options.state.setPositionHandleReadout(formatPositionDeltaReadout({ x: 0, y: 0 }));
      options.pointer.start({
        onMove: (sample) => {
          const nextContext = getPointerContext(sample.clientX, sample.clientY);
          if (!nextContext) return;
          const result = calculatePreviewPositionDragUpdate(nextContext, drag);
          latestPosition = result.nextPosition;
          options.drafts.setPosition(result.nextPosition);
          options.state.setPositionHandleReadout(result.readout);
          draftRuntime.updateTransform(
            { position: result.nextPosition },
            localFrame
          );
        },
        onCommit: () => {
          if (latestPosition) {
            options.commands.applyPosition(latestPosition, mode);
            options.metrics?.increment("projectUpdate");
            options.history.markDirty();
          }
          options.drafts.setPosition(null);
          options.state.setIsDraggingPosition(false);
          options.state.setPositionHandleReadout(null);
          draftRuntime.reset();
          options.history.commit();
          options.metrics?.increment("historyCommit");
        },
        onCancel: () => {
          options.drafts.setPosition(null);
          options.state.setIsDraggingPosition(false);
          options.state.setPositionHandleReadout(null);
          draftRuntime.reset();
          options.history.cancel();
        },
      });
    },
    [draftRuntime, getPointerContext, options]
  );
}
