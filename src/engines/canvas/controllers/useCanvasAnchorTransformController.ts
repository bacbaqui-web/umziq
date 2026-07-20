import { useCallback } from "react";
import {
  resolveDraftAnchorTransformCommand,
  resolveDraftAnchorTransformCommandFromLocalAnchor,
  resolveDraftTransformSnapshot,
} from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import { resolvePreviewPointer } from "@/engines/canvas/helpers/canvasPointerHelpers";
import type {
  CanvasPointerContextResolver,
  CanvasTransformCommandPort,
  CanvasTransformDraftCommands,
  CanvasTransformDraftRuntimePort,
  UseCanvasTransformControllerOptions,
} from "@/engines/canvas/models/canvasTransformControllerModel";

export function useCanvasAnchorTransformController(
  options: UseCanvasTransformControllerOptions,
  getPointerContext: CanvasPointerContextResolver,
  draftRuntime: CanvasTransformDraftRuntimePort
) {
  const updateAnchorDraft = useCallback<CanvasTransformDraftCommands["updateAnchor"]>(
    (anchor) => {
      const overlay = options.selectedOverlay;
      if (!overlay) return null;
      const baseSnapshot = resolveDraftTransformSnapshot({
        target: options.selectedTarget,
        localFrame: options.selectedTransformLocalFrame,
        frameRate: options.selectedMeta?.frameRate,
        selectedMeta: options.selectedMeta,
        overlay,
        patch: {},
      });
      if (!baseSnapshot) return null;
      if (
        baseSnapshot.target.kind === "composition" &&
        baseSnapshot.target.id === options.masterCompId
      ) return null;

      const command = resolveDraftAnchorTransformCommandFromLocalAnchor(
        baseSnapshot,
        anchor
      );
      draftRuntime.updateTransform({
        anchor: command.anchor,
        transformOffset: command.transformOffset,
      });
      return command;
    },
    [draftRuntime, options]
  );

  const startAnchorDrag = useCallback(() => {
    const overlay = options.selectedOverlay;
    if (!overlay) return;
    const baseSnapshot = resolveDraftTransformSnapshot({
      target: options.selectedTarget,
      localFrame: options.selectedTransformLocalFrame,
      frameRate: options.selectedMeta?.frameRate,
      selectedMeta: options.selectedMeta,
      overlay,
      patch: {},
    });
    if (!baseSnapshot) return;
    if (
      baseSnapshot.target.kind === "composition" &&
      baseSnapshot.target.id === options.masterCompId
    ) return;
    let latestAnchorCommand:
      | Parameters<CanvasTransformCommandPort["applyAnchor"]>[0]
      | null = null;
    options.history.begin();
    options.state.setIsDraggingAnchor(true);
    options.pointer.start({
      onMove: (sample) => {
        const context = getPointerContext(sample.clientX, sample.clientY);
        if (!context) return;
        const pointer = resolvePreviewPointer(context);
        const command = resolveDraftAnchorTransformCommand(baseSnapshot, pointer);
        draftRuntime.updateTransform({
          anchor: command.anchor,
          transformOffset: command.transformOffset,
        });
        latestAnchorCommand = command;
      },
      onCommit: () => {
        if (latestAnchorCommand) {
          options.commands.applyAnchor(latestAnchorCommand);
          options.metrics?.increment("projectUpdate");
          options.history.markDirty();
        }
        options.state.setIsDraggingAnchor(false);
        draftRuntime.reset();
        options.history.commit();
        options.metrics?.increment("historyCommit");
      },
      onCancel: () => {
        options.state.setIsDraggingAnchor(false);
        draftRuntime.reset();
        options.history.cancel();
      },
    });
  }, [draftRuntime, getPointerContext, options]);

  return { startAnchorDrag, updateAnchorDraft };
}
