import { resolveCanvasPointerToComposition } from "@/engines/canvas/helpers/canvasViewportHelpers";
import type { CompositionMeta, Position, Scale } from "@/models";
import type {
  PreviewOverlay,
  ScaleHandleDirection,
} from "@/engines/canvas/models/canvasViewModel";

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
  overlay: NonNullable<PreviewOverlay>;
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
  overlay: NonNullable<PreviewOverlay>;
  handle: ScaleHandleDirection;
  initialScale: Scale;
  startPointer: Position;
};

export type PreviewRotationDragState = {
  overlay: NonNullable<PreviewOverlay>;
  startPointerAngle: number;
  startRotation: number;
};

export function resolvePreviewPointer(context: PreviewPointerContext) {
  return resolveCanvasPointerToComposition({
    overlayLeft: context.overlayBounds.left,
    overlayTop: context.overlayBounds.top,
    meta: context.selectedMeta,
    previewSize: context.previewSize,
    viewportScale: context.previewZoom,
    viewportOffset: context.previewViewportOffset,
    clientX: context.clientX,
    clientY: context.clientY,
  });
}

export function createPreviewPositionDragState(
  context: PreviewPointerContext,
  overlay: NonNullable<PreviewOverlay>,
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
  overlay: NonNullable<PreviewOverlay>
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
