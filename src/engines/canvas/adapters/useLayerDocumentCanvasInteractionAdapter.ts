import {
  useCallback,
  type RefObject,
} from "react";
import {
  calculateOpacityDragUpdate,
  calculatePreviewPositionDragUpdate,
  calculateRotationDragUpdate,
  calculateScaleDragUpdate,
  formatPositionDeltaReadout,
  formatRotationHandleValue,
  formatScaleHandleReadout,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
import {
  getCompensatedTransformOffset,
  resolveAnchorFromWorldPoint,
} from "@/engines/canvas/helpers/canvasCoordinateHelpers";
import {
  createMotionPathKeyframeDragState,
  createPreviewPositionDragState,
  createPreviewRotationDragState,
  resolvePreviewPointer,
  type PreviewPointerContext,
} from "@/engines/canvas/helpers/canvasPointerHelpers";
import type {
  CanvasInteractionStatePort,
  CanvasPointerController,
} from "@/engines/canvas/models/canvasInteractionModel";
import type {
  LayerDocumentCanvasCommands,
  LayerDocumentCanvasReadModel,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";
import type {
  ScaleHandleDirection,
} from "@/engines/canvas/models/canvasViewModel";

export function useLayerDocumentCanvasInteractionAdapter<
  TCommitResult,
  TSelectionResult,
  TKeyframeResult,
>(options: {
  overlayRef: RefObject<HTMLDivElement | null>;
  readModel: LayerDocumentCanvasReadModel;
  commands: LayerDocumentCanvasCommands<
    TCommitResult,
    TSelectionResult,
    TKeyframeResult
  >;
  state: CanvasInteractionStatePort;
  pointer: CanvasPointerController;
}) {
  const pointerContext = useCallback(
    (
      clientX: number,
      clientY: number
    ): PreviewPointerContext | null => {
      const bounds =
        options.overlayRef.current
          ?.getBoundingClientRect();
      if (!bounds) return null;
      return {
        overlayBounds: bounds,
        selectedMeta: {
          width: options.readModel.activeScene.width,
          height: options.readModel.activeScene.height,
        },
        previewSize:
          options.readModel.viewport.previewSize,
        previewZoom:
          options.readModel.viewport.viewportScale,
        previewViewportOffset:
          options.readModel.viewport.viewportOffset,
        clientX,
        clientY,
      };
    },
    [options.overlayRef, options.readModel]
  );

  const startPositionDrag = useCallback(
    (clientX: number, clientY: number) => {
      const context = pointerContext(clientX, clientY);
      const overlay =
        options.readModel.selection.overlay;
      const transform =
        options.readModel.selectedTarget?.gizmo
          .evaluatedTransform;
      if (!context || !overlay || !transform) return;
      const drag = createPreviewPositionDragState(
        context,
        overlay,
        transform.position
      );
      let changed = false;
      options.state.setIsDraggingPosition(true);
      options.state.setPositionHandleReadout(
        formatPositionDeltaReadout({ x: 0, y: 0 })
      );
      options.pointer.start({
        onMove: (sample) => {
          const next = pointerContext(
            sample.clientX,
            sample.clientY
          );
          if (!next) return;
          const update =
            calculatePreviewPositionDragUpdate(
              next,
              drag
            );
          changed = Boolean(
            options.commands.updateHandleDraft({
              handle: "position",
              value: update.nextPosition,
            })
          ) || changed;
          options.state.setPositionHandleReadout(
            update.readout
          );
        },
        onCommit: () => {
          if (changed) options.commands.commitDraft();
          options.state.setIsDraggingPosition(false);
          options.state.setPositionHandleReadout(null);
        },
        onCancel: () => {
          options.commands.cancelDraft();
          options.state.setIsDraggingPosition(false);
          options.state.setPositionHandleReadout(null);
        },
      });
    },
    [options, pointerContext]
  );

  const startScaleDrag = useCallback(
    (
      handle: ScaleHandleDirection,
      clientX: number,
      clientY: number
    ) => {
      const context = pointerContext(clientX, clientY);
      const overlay =
        options.readModel.selection.overlay;
      if (!context || !overlay) return;
      const drag = {
        overlay,
        handle,
        initialScale: {
          x: overlay.scaleX,
          y: overlay.scaleY,
        },
        startPointer: resolvePreviewPointer(context),
      };
      let changed = false;
      options.state.setIsDraggingScale(true);
      options.state.setScaleHandleReadout({
        handle,
        text: formatScaleHandleReadout(
          handle,
          drag.initialScale
        ),
      });
      options.pointer.start({
        onMove: (sample) => {
          const next = pointerContext(
            sample.clientX,
            sample.clientY
          );
          if (!next) return;
          const update = calculateScaleDragUpdate(
            next,
            drag,
            sample.shiftKey
          );
          if (!update) return;
          changed = Boolean(
            options.commands.updateHandleDraft({
              handle:
                handle === "x"
                  ? "scale-x"
                  : handle === "y"
                    ? "scale-y"
                    : "scale-xy",
              value: update.nextScale,
            })
          ) || changed;
          options.state.setScaleHandleReadout({
            handle,
            text: update.readout,
          });
        },
        onCommit: () => {
          if (changed) options.commands.commitDraft();
          options.state.setIsDraggingScale(false);
          options.state.setScaleHandleReadout(null);
        },
        onCancel: () => {
          options.commands.cancelDraft();
          options.state.setIsDraggingScale(false);
          options.state.setScaleHandleReadout(null);
        },
      });
    },
    [options, pointerContext]
  );

  const startRotationDrag = useCallback(
    (clientX: number, clientY: number) => {
      const context = pointerContext(clientX, clientY);
      const overlay =
        options.readModel.selection.overlay;
      if (!context || !overlay) return;
      const drag = createPreviewRotationDragState(
        context,
        overlay
      );
      let changed = false;
      options.state.setIsDraggingRotation(true);
      options.state.setRotationHandleReadout(
        formatRotationHandleValue(overlay.rotation)
      );
      options.pointer.start({
        onMove: (sample) => {
          const next = pointerContext(
            sample.clientX,
            sample.clientY
          );
          if (!next) return;
          const update = calculateRotationDragUpdate(
            next,
            drag,
            sample.shiftKey
          );
          if (!update) return;
          changed = Boolean(
            options.commands.updateHandleDraft({
              handle: "rotation",
              value: update.nextRotation,
            })
          ) || changed;
          options.state.setRotationHandleReadout(
            update.readout
          );
        },
        onCommit: () => {
          if (changed) options.commands.commitDraft();
          options.state.setIsDraggingRotation(false);
          options.state.setRotationHandleReadout(null);
        },
        onCancel: () => {
          options.commands.cancelDraft();
          options.state.setIsDraggingRotation(false);
          options.state.setRotationHandleReadout(null);
        },
      });
    },
    [options, pointerContext]
  );

  const startOpacityDrag = useCallback(() => {
    const overlay = options.readModel.selection.overlay;
    if (!overlay) return;
    let changed = false;
    options.state.setIsDraggingOpacity(true);
    options.state.setOpacityHandleReadout(
      `${Math.round(
        options.readModel.selectedTarget?.gizmo
          .opacity ?? 100
      )}%`
    );
    options.pointer.start({
      onMove: (sample) => {
        const context = pointerContext(
          sample.clientX,
          sample.clientY
        );
        if (!context) return;
        const update = calculateOpacityDragUpdate(
          context,
          overlay,
          sample.shiftKey
        );
        changed = Boolean(
          options.commands.updateHandleDraft({
            handle: "opacity",
            value: update.nextOpacity,
          })
        ) || changed;
        options.state.setOpacityHandleReadout(
          update.readout
        );
      },
      onCommit: () => {
        if (changed) options.commands.commitDraft();
        options.state.setIsDraggingOpacity(false);
        options.state.setOpacityHandleReadout(null);
      },
      onCancel: () => {
        options.commands.cancelDraft();
        options.state.setIsDraggingOpacity(false);
        options.state.setOpacityHandleReadout(null);
      },
    });
  }, [options, pointerContext]);

  const startAnchorDrag = useCallback(() => {
    const overlay = options.readModel.selection.overlay;
    const transform =
      options.readModel.selectedTarget?.gizmo
        .evaluatedTransform;
    if (!overlay || !transform) return;
    let changed = false;
    options.state.setIsDraggingAnchor(true);
    options.pointer.start({
      onMove: (sample) => {
        const context = pointerContext(
          sample.clientX,
          sample.clientY
        );
        if (!context) return;
        const nextAnchor = resolveAnchorFromWorldPoint(
          resolvePreviewPointer(context),
          transform.position,
          transform.transformOffset,
          transform.anchor,
          transform.scale,
          transform.rotation,
          overlay.sourceWidth,
          overlay.sourceHeight
        );
        const transformOffset =
          getCompensatedTransformOffset(
            transform.transformOffset,
            transform.anchor,
            nextAnchor,
            transform.scale,
            transform.rotation
          );
        changed = Boolean(
          options.commands.updateHandleDraft({
            handle: "anchor",
            value: {
              anchor: nextAnchor,
              transformOffset,
            },
          })
        ) || changed;
      },
      onCommit: () => {
        if (changed) options.commands.commitDraft();
        options.state.setIsDraggingAnchor(false);
      },
      onCancel: () => {
        options.commands.cancelDraft();
        options.state.setIsDraggingAnchor(false);
      },
    });
  }, [options, pointerContext]);

  const selectPoint = useCallback(
    (frame: number, isKeyframe: boolean) => {
      const target = options.readModel.selectedTarget;
      if (!target) return;
      const localFrame =
        target.localFrame +
        (frame - target.globalFrame);
      options.commands.seekFrame(frame);
      if (!isKeyframe || localFrame < 0) return;
      options.commands.selectMotionPathKeyframe({
        layerDocumentId: target.layerDocumentId,
        globalFrame: frame,
        localFrame,
      });
    },
    [options]
  );

  const startKeyframeDrag = useCallback(
    (
      frame: number,
      clientX: number,
      clientY: number
    ) => {
      const target = options.readModel.selectedTarget;
      const sample = target?.motionPath.samples.find(
        (candidate) => candidate.frame === frame
      );
      const context = pointerContext(clientX, clientY);
      if (!target || !sample || !context) return;
      const localFrame =
        target.localFrame +
        (frame - target.globalFrame);
      if (localFrame < 0) return;
      const drag = createMotionPathKeyframeDragState(
        context,
        {
          absoluteFrame: frame,
          localFrame,
          startPosition: sample.position,
          targetKind: "layer",
          targetId: target.layerDocumentId,
        }
      );
      let changed = false;
      options.commands.selectMotionPathKeyframe({
        layerDocumentId: target.layerDocumentId,
        globalFrame: frame,
        localFrame,
      });
      options.state.setIsDraggingMotionPathKeyframe(
        true
      );
      options.state.setDraggingMotionPathFrame(frame);
      options.state.setMotionPathKeyframeReadout(
        formatPositionDeltaReadout({ x: 0, y: 0 })
      );
      options.pointer.start({
        onMove: (pointerSample) => {
          const next = pointerContext(
            pointerSample.clientX,
            pointerSample.clientY
          );
          if (!next) return;
          const update =
            calculatePreviewPositionDragUpdate(
              next,
              drag
            );
          const preparation =
            options.commands
              .publishMotionPathKeyframeDraft({
                kind: "upsert-position-keyframe",
                layerDocumentId:
                  target.layerDocumentId,
                globalFrame: frame,
                localFrame,
                value: update.nextPosition,
              });
          changed = Boolean(preparation) || changed;
          options.state.setMotionPathKeyframeReadout(
            update.readout
          );
        },
        onCommit: () => {
          if (changed) {
            options.commands
              .commitMotionPathKeyframeDraft();
          }
          options.state
            .setIsDraggingMotionPathKeyframe(false);
          options.state.setDraggingMotionPathFrame(null);
          options.state.setMotionPathKeyframeReadout(null);
        },
        onCancel: () => {
          options.commands
            .cancelMotionPathKeyframeDraft();
          options.state
            .setIsDraggingMotionPathKeyframe(false);
          options.state.setDraggingMotionPathFrame(null);
          options.state.setMotionPathKeyframeReadout(null);
        },
      });
    },
    [options, pointerContext]
  );

  const directInput = {
    commitScale: (
      handle: ScaleHandleDirection,
      value: number
    ) => {
      const scale =
        options.readModel.selectedTarget?.gizmo
          .evaluatedTransform.scale;
      if (!scale) return;
      options.commands.updateHandleDraft({
        handle:
          handle === "x"
            ? "scale-x"
            : handle === "y"
              ? "scale-y"
              : "scale-xy",
        value:
          handle === "x"
            ? { ...scale, x: value }
            : handle === "y"
              ? { ...scale, y: value }
              : { x: value, y: value },
      });
      options.commands.commitDraft();
    },
    commitRotation: (value: number) => {
      options.commands.updateHandleDraft({
        handle: "rotation",
        value,
      });
      options.commands.commitDraft();
    },
    commitOpacity: (value: number) => {
      options.commands.updateHandleDraft({
        handle: "opacity",
        value,
      });
      options.commands.commitDraft();
    },
  };

  return {
    transform: {
      startPositionDrag,
      startScaleDrag,
      startRotationDrag,
      startOpacityDrag,
      startAnchorDrag,
    },
    motion: { selectPoint, startKeyframeDrag },
    directInput,
  };
}
