import {
  normalizeDegrees,
  projectOntoAxis,
} from "@/engines/canvas/helpers/canvasCoordinateHelpers";
import type {
  PreviewOverlay,
  ScaleHandleDirection,
} from "@/engines/canvas/models/canvasViewModel";
import type { Position, Scale } from "@/models";
import type { PropertyTrackState } from "@/models";
import { getTransformEditMode } from "@/engines/animation";
import {
  getScaleHandleDescriptors,
} from "@/engines/canvas/helpers/canvasGizmoGeometryHelpers";
import { worldPointToCanvasPoint } from "@/engines/canvas/helpers/canvasViewportHelpers";
import {
  resolvePreviewPointer,
  type PreviewPointerContext,
  type PreviewPositionDragState,
  type PreviewRotationDragState,
  type PreviewScaleDragState,
} from "@/engines/canvas/helpers/canvasPointerHelpers";

export function formatRotationHandleValue(value: number) {
  return `${Math.round(value)}°`;
}

export function formatScaleHandleReadout(
  handle: ScaleHandleDirection,
  scale: Scale
) {
  const format = (value: number) => `${Math.round(value)}%`;
  if (handle === "x") return `X ${format(scale.x)}`;
  if (handle === "y") return `Y ${format(scale.y)}`;
  return `X ${format(scale.x)} / Y ${format(scale.y)}`;
}

export function formatPositionDeltaReadout(delta: Position) {
  const format = (value: number) => `${value >= 0 ? "+" : ""}${Math.round(value)}`;
  return `ΔX ${format(delta.x)} / ΔY ${format(delta.y)}`;
}

export function getCanvasTransformEditModes(state: PropertyTrackState) {
  return {
    position: getTransformEditMode(state.position),
    scale: getTransformEditMode(state.scale),
    rotation: getTransformEditMode(state.rotation),
    opacity: getTransformEditMode(state.opacity),
  };
}

export function isCanvasTransformDragActive(state: {
  isDraggingAnchor: boolean;
  isDraggingPosition: boolean;
  isDraggingScale: boolean;
  isDraggingOpacity: boolean;
  isDraggingRotation: boolean;
}) {
  return state.isDraggingAnchor || state.isDraggingPosition ||
    state.isDraggingScale || state.isDraggingOpacity || state.isDraggingRotation;
}

export function shouldRunCanvasDirectSelectionHover(options: {
  isPreviewPanning: boolean;
  isPreviewPanModifierActive: boolean;
  isTransformDragging: boolean;
  isExcludedTarget: boolean;
}) {
  return !options.isPreviewPanning && !options.isPreviewPanModifierActive &&
    !options.isTransformDragging && !options.isExcludedTarget;
}

export function calculatePreviewPositionDragUpdate(
  context: PreviewPointerContext,
  dragState: Pick<PreviewPositionDragState, "startPointer" | "startPosition">
) {
  const pointer = resolvePreviewPointer(context);
  const delta = {
    x: Math.round(pointer.x - dragState.startPointer.x),
    y: Math.round(pointer.y - dragState.startPointer.y),
  };
  const nextPosition = {
    x: dragState.startPosition.x + delta.x,
    y: dragState.startPosition.y + delta.y,
  };

  return {
    pointer,
    delta,
    nextPosition,
    readout: formatPositionDeltaReadout(delta),
  };
}

export function calculateScaleDragUpdate(
  context: PreviewPointerContext,
  dragState: PreviewScaleDragState,
  snapToTenPercent: boolean
) {
  const pointer = resolvePreviewPointer(context);
  const { overlay, handle, initialScale } = dragState;
  const descriptor = getScaleHandleDescriptors(overlay).find((target) => target.key === handle);

  if (!descriptor) {
    return null;
  }

  const handleVector = {
    x: descriptor.x - overlay.anchorX,
    y: descriptor.y - overlay.anchorY,
  };
  const axisLength = Math.max(1, Math.hypot(handleVector.x, handleVector.y));
  const axis = {
    x: handleVector.x / axisLength,
    y: handleVector.y / axisLength,
  };
  const pointerVector = {
    x: pointer.x - overlay.anchorX,
    y: pointer.y - overlay.anchorY,
  };
  const startPointerVector = {
    x: dragState.startPointer.x - overlay.anchorX,
    y: dragState.startPointer.y - overlay.anchorY,
  };
  const startDistance = projectOntoAxis(startPointerVector, axis);

  if (Math.abs(startDistance) < 0.0001) return null;

  const currentDistance = projectOntoAxis(pointerVector, axis);
  const relativeFactor = currentDistance / startDistance;

  if (Math.abs(relativeFactor - 1) < 0.0001) {
    return {
      nextScale: { ...initialScale },
      readout: formatScaleHandleReadout(handle, initialScale),
    };
  }

  let nextScale = { ...initialScale };

  if (handle === "x") {
    nextScale.x = initialScale.x * relativeFactor;
  } else if (handle === "y") {
    nextScale.y = initialScale.y * relativeFactor;
  } else {
    nextScale = {
      x: initialScale.x * relativeFactor,
      y: initialScale.y * relativeFactor,
    };
  }

  if (snapToTenPercent) {
    if (handle === "x") {
      nextScale.x = Math.round(nextScale.x / 10) * 10;
    } else if (handle === "y") {
      nextScale.y = Math.round(nextScale.y / 10) * 10;
    } else {
      nextScale = {
        x: Math.round(nextScale.x / 10) * 10,
        y: Math.round(nextScale.y / 10) * 10,
      };
    }
  }

  return {
    nextScale,
    readout: formatScaleHandleReadout(handle, nextScale),
  };
}

export function calculateOpacityDragUpdate(
  context: PreviewPointerContext,
  overlay: NonNullable<PreviewOverlay>,
  snapToTenPercent: boolean
) {
  const anchor = worldPointToCanvasPoint(
    {
      meta: context.selectedMeta,
      previewSize: context.previewSize,
      viewportScale: context.previewZoom,
      viewportOffset: context.previewViewportOffset,
    },
    { x: overlay.anchorX, y: overlay.anchorY }
  );
  const pointerRadius = Math.hypot(
    context.clientX - context.overlayBounds.left - anchor.x,
    context.clientY - context.overlayBounds.top - anchor.y
  );
  let nextOpacity = Math.min(
    100,
    Math.max(0, ((pointerRadius - 25) / 25) * 100)
  );

  if (snapToTenPercent) {
    nextOpacity = Math.round(nextOpacity / 10) * 10;
  }

  return {
    nextOpacity,
    readout: `${Math.round(nextOpacity)}%`,
  };
}

export function calculateRotationDragUpdate(
  context: PreviewPointerContext,
  dragState: PreviewRotationDragState,
  snapToFifteenDegrees: boolean
) {
  const pointer = resolvePreviewPointer(context);
  const { overlay, startPointerAngle, startRotation } = dragState;
  const deltaX = pointer.x - overlay.anchorX;
  const deltaY = pointer.y - overlay.anchorY;

  if (Math.hypot(deltaX, deltaY) < 1) {
    return null;
  }

  const currentPointerAngle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
  const deltaAngle = normalizeDegrees(currentPointerAngle - startPointerAngle);
  let nextRotation = normalizeDegrees(startRotation + deltaAngle);

  if (snapToFifteenDegrees) {
    nextRotation = normalizeDegrees(Math.round(nextRotation / 15) * 15);
  }

  return {
    nextRotation,
    readout: formatRotationHandleValue(nextRotation),
  };
}
