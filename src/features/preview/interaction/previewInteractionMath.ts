import {
  formatPositionDeltaReadout,
  formatRotationHandleValue,
  formatScaleHandleReadout,
} from "@/editor/preview/previewFormatting";
import {
  normalizeDegrees,
  projectOntoAxis,
} from "@/editor/preview/previewCoordinateMath";
import type {
  PreviewOverlay as PreviewOverlayData,
} from "@/editor/types/editorViewTypes";
import {
  getOpacityRadiusRange,
  getScaleHandleDescriptors,
} from "@/features/preview/geometry/previewOverlayHelpers";
import {
  resolvePreviewPointer,
  type PreviewPointerContext,
  type PreviewPositionDragState,
  type PreviewRotationDragState,
  type PreviewScaleDragState,
} from "@/features/preview/interaction/previewPointerMath";

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
  const getSignedScaleFactor = (distance: number) => {
    const normalizedDistance = distance / axisLength;

    if (Math.abs(normalizedDistance) < 0.0001) {
      return 0;
    }

    return Math.sign(normalizedDistance) * Math.pow(Math.abs(normalizedDistance), 0.85);
  };

  let nextScale = { ...initialScale };

  if (handle === "x") {
    const signedDistance = projectOntoAxis(pointerVector, axis);
    nextScale.x = initialScale.x * getSignedScaleFactor(signedDistance);
  } else if (handle === "y") {
    const signedDistance = projectOntoAxis(pointerVector, axis);
    nextScale.y = initialScale.y * getSignedScaleFactor(signedDistance);
  } else {
    const signedDistance = projectOntoAxis(pointerVector, axis);
    const unifiedFactor = getSignedScaleFactor(signedDistance);
    nextScale = {
      x: initialScale.x * unifiedFactor,
      y: initialScale.y * unifiedFactor,
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
  overlay: NonNullable<PreviewOverlayData>,
  snapToTenPercent: boolean
) {
  const pointer = resolvePreviewPointer(context);
  const { minRadius, maxRadius } = getOpacityRadiusRange();
  const pointerRadius = Math.hypot(pointer.x - overlay.anchorX, pointer.y - overlay.anchorY);
  const normalizedOpacity = (pointerRadius - minRadius) / Math.max(1, maxRadius - minRadius);
  let nextOpacity = Math.min(100, Math.max(0, normalizedOpacity * 100));

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
