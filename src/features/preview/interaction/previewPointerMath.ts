import { resolvePointerToCompSpace } from "@/editor/preview/previewCamera";
import type { CompositionMeta, Position, Scale } from "@/editor/types/types";
import type {
  PreviewOverlay as PreviewOverlayData,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";

export type PreviewPointerContext = {
  overlayBounds: DOMRect;
  selectedMeta: CompositionMeta;
  previewSize: {
    width: number;
    height: number;
  };
  previewZoom: number;
  previewViewportOffset: Position;
  clientX: number;
  clientY: number;
};

export type PreviewPositionDragState = {
  overlay: NonNullable<PreviewOverlayData>;
  startPointer: Position;
  startPosition: Position;
};

export type PreviewMotionPathKeyframeDragState = {
  absoluteFrame: number;
  localFrame: number;
  startPointer: Position;
  startPosition: Position;
  targetKind: "layer" | "composition";
  targetId: string;
};

export type PreviewScaleDragState = {
  overlay: NonNullable<PreviewOverlayData>;
  handle: ScaleHandleDirection;
  initialScale: Scale;
};

export type PreviewRotationDragState = {
  overlay: NonNullable<PreviewOverlayData>;
  startPointerAngle: number;
  startRotation: number;
};

export function resolvePreviewPointer(context: PreviewPointerContext) {
  return resolvePointerToCompSpace(
    context.overlayBounds,
    context.selectedMeta,
    context.previewSize,
    context.previewZoom,
    context.previewViewportOffset,
    context.clientX,
    context.clientY
  );
}

export function createPreviewPositionDragState(
  context: PreviewPointerContext,
  overlay: NonNullable<PreviewOverlayData>,
  startPosition: Position
): PreviewPositionDragState {
  return {
    overlay,
    startPointer: resolvePreviewPointer(context),
    startPosition,
  };
}

export function createPreviewRotationDragState(
  context: PreviewPointerContext,
  overlay: NonNullable<PreviewOverlayData>
): PreviewRotationDragState {
  const pointer = resolvePreviewPointer(context);

  return {
    overlay,
    startPointerAngle:
      (Math.atan2(pointer.y - overlay.anchorY, pointer.x - overlay.anchorX) * 180) / Math.PI,
    startRotation: overlay.rotation,
  };
}

export function createMotionPathKeyframeDragState(
  context: PreviewPointerContext,
  params: {
    absoluteFrame: number;
    localFrame: number;
    startPosition: Position;
    targetKind: "layer" | "composition";
    targetId: string;
  }
): PreviewMotionPathKeyframeDragState {
  return {
    absoluteFrame: params.absoluteFrame,
    localFrame: params.localFrame,
    startPointer: resolvePreviewPointer(context),
    startPosition: params.startPosition,
    targetKind: params.targetKind,
    targetId: params.targetId,
  };
}
