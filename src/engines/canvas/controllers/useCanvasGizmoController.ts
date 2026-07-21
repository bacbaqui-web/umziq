import { useCallback, useEffect, useMemo } from "react";
import type { CompositionMeta, Scale } from "@/models";
import type { CanvasSelectionReadModel } from "@/engines/canvas/models/canvasEngineModel";
import type { PreviewMotionPathPoint, ScaleHandleDirection } from "@/engines/canvas/models/canvasViewModel";
import type {
  CanvasGizmoViewModel,
  CanvasInteractionCommands,
  CanvasInteractionStatePort,
} from "@/engines/canvas/models/canvasInteractionModel";
import {
  buildCanvasMotionPathPointViewModels,
  buildPreviewOverlayViewModel,
} from "@/engines/canvas/helpers/canvasGizmoHelpers";
import {
  getMoveHandleCursor,
  getOpacityHandleCursor,
  getRotationHandleCursor,
  getScaleHandleCursor,
} from "@/engines/canvas/helpers/canvasGizmoGeometryHelpers";

const DRAG_START_THRESHOLD = 4;

export type UseCanvasGizmoControllerOptions = {
  viewportScale: number;
  viewportOffset: { x: number; y: number };
  previewSize: { width: number; height: number };
  selectedMeta: CompositionMeta;
  selection: CanvasSelectionReadModel;
  motionPath: PreviewMotionPathPoint[];
  currentOpacity: number;
  currentRotation: number;
  currentScale: Scale;
  state: CanvasInteractionStatePort;
  transform: {
    startPositionDrag: (clientX: number, clientY: number) => void;
    startScaleDrag: (
      handle: ScaleHandleDirection,
      clientX: number,
      clientY: number
    ) => void;
    startRotationDrag: (clientX: number, clientY: number) => void;
    startOpacityDrag: () => void;
    startAnchorDrag: () => void;
  };
  pressTarget: (clientX: number, clientY: number) => void;
  motion: {
    selectPoint: (frame: number, isKeyframe: boolean) => void;
    startKeyframeDrag: (frame: number, clientX: number, clientY: number) => void;
  };
  directInput: {
    commitScale: (handle: ScaleHandleDirection, value: number) => void;
    commitRotation: (value: number) => void;
    commitOpacity: (value: number) => void;
  };
};

export function useCanvasGizmoController(options: UseCanvasGizmoControllerOptions): {
  viewModel: CanvasGizmoViewModel;
  commands: CanvasInteractionCommands;
} {
  const { state } = options;

  useEffect(() => {
    const pending = state.pendingHandleInteraction;
    if (!pending) return;
    const move = (event: MouseEvent) => {
      if (
        Math.hypot(
          event.clientX - pending.startClientX,
          event.clientY - pending.startClientY
        ) < DRAG_START_THRESHOLD
      ) return;
      if (pending.kind === "scale") {
        options.transform.startScaleDrag(
          pending.handle,
          pending.startClientX,
          pending.startClientY
        );
      }
      else if (pending.kind === "rotation") {
        options.transform.startRotationDrag(event.clientX, event.clientY);
      } else if (pending.kind === "opacity") options.transform.startOpacityDrag();
      else options.transform.startPositionDrag(event.clientX, event.clientY);
      state.setPendingHandleInteraction(null);
    };
    const up = () => state.setPendingHandleInteraction(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [options.transform, state, state.pendingHandleInteraction]);

  useEffect(() => {
    const pending = state.pendingMotionPathInteraction;
    if (!pending) return;
    const move = (event: MouseEvent) => {
      if (
        Math.hypot(
          event.clientX - pending.startClientX,
          event.clientY - pending.startClientY
        ) < DRAG_START_THRESHOLD ||
        !pending.isKeyframe
      ) return;
      options.motion.startKeyframeDrag(pending.frame, event.clientX, event.clientY);
      state.setSuppressedMotionPathClickFrame(pending.frame);
      state.setPendingMotionPathInteraction(null);
    };
    const up = () => state.setPendingMotionPathInteraction(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [options.motion, state, state.pendingMotionPathInteraction]);

  useEffect(() => {
    if (state.suppressedMotionPathClickFrame === null) return;
    const timeoutId = window.setTimeout(
      () => state.setSuppressedMotionPathClickFrame(null),
      120
    );
    return () => window.clearTimeout(timeoutId);
  }, [state, state.suppressedMotionPathClickFrame]);

  const base = useMemo(
    () =>
      buildPreviewOverlayViewModel({
        viewportScale: options.viewportScale,
        viewportOffset: options.viewportOffset,
        previewSize: options.previewSize,
        selectedMeta: options.selectedMeta,
        selection: options.selection,
        motionPath: options.motionPath,
        currentOpacity: options.currentOpacity,
      }),
    [
      options.currentOpacity,
      options.motionPath,
      options.previewSize,
      options.selectedMeta,
      options.selection,
      options.viewportOffset,
      options.viewportScale,
    ]
  );
  const currentMotionFrame =
    base.previewMotionPath.find((point) => point.isCurrent)?.frame ?? null;
  const motionPathInteractionLocked =
    state.hoveredHandle !== null ||
    state.isDraggingAnchor ||
    state.isDraggingPosition ||
    state.isDraggingScale ||
    state.isDraggingOpacity ||
    state.isDraggingRotation ||
    state.pendingHandleInteraction !== null ||
    state.directInput !== null;
  const activeScaleHandle = state.scaleHandleReadout
    ? base.previewScaleHandles.find(
        (handle) => handle.key === state.scaleHandleReadout?.handle
      ) ?? null
    : null;
  const viewModel: CanvasGizmoViewModel = {
    ...base,
    isVisible: Boolean(
      base.previewAnchor &&
        base.previewMoveHandle &&
        base.previewRotationHandle &&
        base.previewOpacityHandle
    ),
    cursors: {
      move: getMoveHandleCursor(),
      rotation: getRotationHandleCursor(),
      opacity: getOpacityHandleCursor(),
      scale: {
        x: getScaleHandleCursor("x"),
        y: getScaleHandleCursor("y"),
        xy: getScaleHandleCursor("xy"),
      },
    },
    motionPathPoints: buildCanvasMotionPathPointViewModels({
      previewMotionPath: base.previewMotionPath,
      protectedControlPoints: base.protectedControlPoints,
      currentMotionFrame,
      hoveredMotionFrame: state.hoveredMotionFrame,
      draggingMotionPathFrame: state.draggingMotionPathFrame,
      interactionLocked: motionPathInteractionLocked,
    }),
    currentMotionFrame,
    hoveredHandle: state.hoveredHandle,
    hoveredMotionFrame: state.hoveredMotionFrame,
    isDraggingAnchor: state.isDraggingAnchor,
    isDraggingPosition: state.isDraggingPosition,
    isDraggingScale: state.isDraggingScale,
    isDraggingOpacity: state.isDraggingOpacity,
    isDraggingRotation: state.isDraggingRotation,
    positionReadout: state.positionHandleReadout,
    opacityReadout: state.opacityHandleReadout,
    rotationReadout: state.rotationHandleReadout,
    scaleReadout: state.scaleHandleReadout,
    activeScaleHandle,
    directInput: state.directInput,
    anchorOpacity: state.isDraggingAnchor ? 1 : state.isAnchorHovered ? 0.96 : 0.82,
    isAnchorHovered: state.isAnchorHovered,
    motionPathInteractionLocked,
    draggingMotionPathFrame: state.draggingMotionPathFrame,
    motionPathDragReadout: state.motionPathKeyframeReadout,
  };

  const closeDirectInput = useCallback(() => state.setDirectInput(null), [state]);
  const commitDirectInput = useCallback(() => {
    const input = state.directInput;
    if (!input) return;
    const value = Number(input.value);
    if (Number.isFinite(value)) {
      if (input.kind === "rotation") options.directInput.commitRotation(value);
      else if (input.kind === "opacity") options.directInput.commitOpacity(value);
      else options.directInput.commitScale(input.handle, value);
    }
    state.setDirectInput(null);
  }, [options.directInput, state]);

  const commands: CanvasInteractionCommands = {
    pressMove: (clientX, clientY) =>
      state.setPendingHandleInteraction({ kind: "move", startClientX: clientX, startClientY: clientY }),
    pressRotation: (clientX, clientY) =>
      state.setPendingHandleInteraction({ kind: "rotation", startClientX: clientX, startClientY: clientY }),
    pressOpacity: (clientX, clientY) =>
      state.setPendingHandleInteraction({ kind: "opacity", startClientX: clientX, startClientY: clientY }),
    pressScale: (handle, clientX, clientY) =>
      state.setPendingHandleInteraction({ kind: "scale", handle, startClientX: clientX, startClientY: clientY }),
    pressTarget: options.pressTarget,
    pressAnchor: options.transform.startAnchorDrag,
    hoverHandle: state.setHoveredHandle,
    hoverAnchor: state.setIsAnchorHovered,
    hoverMotionFrame: state.setHoveredMotionFrame,
    pressMotionPathPoint: (frame, isKeyframe, clientX, clientY) =>
      state.setPendingMotionPathInteraction({ frame, isKeyframe, startClientX: clientX, startClientY: clientY }),
    selectMotionPathPoint: (frame, isKeyframe) => {
      if (state.suppressedMotionPathClickFrame === frame) {
        state.setSuppressedMotionPathClickFrame(null);
        return;
      }
      options.motion.selectPoint(frame, isKeyframe);
    },
    openRotationInput: () => {
      if (!base.previewRotationHandle) return;
      state.setPendingHandleInteraction(null);
      state.setDirectInput({ kind: "rotation", x: base.previewRotationHandle.point.x + 10, y: base.previewRotationHandle.point.y - 12, value: `${Math.round(options.currentRotation)}` });
    },
    openOpacityInput: () => {
      if (!base.previewOpacityHandle) return;
      state.setPendingHandleInteraction(null);
      state.setDirectInput({ kind: "opacity", x: base.previewOpacityHandle.point.x + 10, y: base.previewOpacityHandle.point.y - 12, value: `${Math.round(options.currentOpacity)}` });
    },
    openScaleInput: (handle, x, y) => {
      state.setPendingHandleInteraction(null);
      const value = handle === "y" ? options.currentScale.y : options.currentScale.x;
      state.setDirectInput({ kind: "scale", handle, x: x + 10, y: y - 12, value: `${Math.round(value)}` });
    },
    changeDirectInput: (value) =>
      state.setDirectInput((current) => current ? { ...current, value } : current),
    commitDirectInput,
    closeDirectInput,
  };

  return { viewModel, commands };
}
