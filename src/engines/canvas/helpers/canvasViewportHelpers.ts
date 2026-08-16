import type { Position } from "@/models";
import type { CanvasSceneSize } from "@/engines/canvas/models/canvasEngineModel";
import {
  PREVIEW_MAX_ZOOM,
  PREVIEW_MIN_ZOOM,
  PREVIEW_WHEEL_ZOOM_STEPS,
} from "@/engines/canvas/constants/canvasConstants";
import type { CanvasSize } from "@/engines/canvas/models/canvasEngineModel";

export function clampCanvasZoom(value: number) {
  return Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, value));
}

export function getCanvasWheelZoom(currentZoom: number, deltaY: number) {
  const epsilon = 0.0001;
  if (deltaY < 0) {
    return (
      PREVIEW_WHEEL_ZOOM_STEPS.find(
        (step) => step > currentZoom + epsilon
      ) ?? PREVIEW_WHEEL_ZOOM_STEPS.at(-1)!
    );
  }
  if (deltaY > 0) {
    return (
      [...PREVIEW_WHEEL_ZOOM_STEPS]
        .reverse()
        .find((step) => step < currentZoom - epsilon) ??
      PREVIEW_WHEEL_ZOOM_STEPS[0]
    );
  }
  return currentZoom;
}

export function getCenteredCanvasPan(
  contentWidth: number,
  contentHeight: number,
  zoom: number
) {
  return {
    x: (contentWidth - contentWidth * zoom) / 2,
    y: (contentHeight - contentHeight * zoom) / 2,
  };
}

export function getCanvasZoomPan({
  pointer,
  baseOffset,
  pan,
  currentZoom,
  nextZoom,
}: {
  pointer: Position;
  baseOffset: Position;
  pan: Position;
  currentZoom: number;
  nextZoom: number;
}) {
  const clampedZoom = clampCanvasZoom(nextZoom);
  const localX = (pointer.x - baseOffset.x - pan.x) / currentZoom;
  const localY = (pointer.y - baseOffset.y - pan.y) / currentZoom;

  return {
    zoom: clampedZoom,
    pan: {
      x: pointer.x - baseOffset.x - localX * clampedZoom,
      y: pointer.y - baseOffset.y - localY * clampedZoom,
    },
  };
}

export function getCanvasViewportValues({
  minWorkspaceWidth,
  minWorkspaceHeight,
  workspaceSize,
  selectedMeta,
  shortformFrameWidth,
  shortformFrameHeight,
  zoom,
  pan,
}: {
  minWorkspaceWidth: number;
  minWorkspaceHeight: number;
  workspaceSize: CanvasSize;
  selectedMeta: CanvasSceneSize | null;
  shortformFrameWidth: number;
  shortformFrameHeight: number;
  zoom: number;
  pan: Position;
}) {
  const previewViewportWidth = Math.max(
    minWorkspaceWidth,
    Math.floor(workspaceSize.width)
  );
  const previewViewportHeight = Math.max(
    minWorkspaceHeight,
    Math.floor(workspaceSize.height)
  );
  const previewFitZoom = selectedMeta
    ? clampCanvasZoom(
        Math.min(
          previewViewportWidth / shortformFrameWidth,
          previewViewportHeight / shortformFrameHeight
        )
      )
    : 1;
  const previewSize = {
    width: selectedMeta?.width ?? previewViewportWidth,
    height: selectedMeta?.height ?? previewViewportHeight,
  };
  const previewBaseOffset = {
    x: (previewViewportWidth - previewSize.width) / 2,
    y: (previewViewportHeight - previewSize.height) / 2,
  };

  return {
    previewViewportWidth,
    previewViewportHeight,
    previewFitZoom,
    previewSize,
    previewBaseOffset,
    previewViewportOffset: {
      x: previewBaseOffset.x + pan.x,
      y: previewBaseOffset.y + pan.y,
    },
    previewZoomPercent: Math.round(zoom * 100),
  };
}

type CanvasScreenTransform = {
  meta: CanvasSceneSize;
  previewSize: CanvasSize;
  viewportScale: number;
  viewportOffset: Position;
};

export function worldPointToCanvasPoint(
  transform: CanvasScreenTransform,
  worldPoint: Position
) {
  return {
    x:
      transform.viewportOffset.x +
      (worldPoint.x / transform.meta.width) *
        transform.previewSize.width *
        transform.viewportScale,
    y:
      transform.viewportOffset.y +
      (worldPoint.y / transform.meta.height) *
        transform.previewSize.height *
        transform.viewportScale,
  };
}

export function canvasPointToWorldPoint(
  transform: CanvasScreenTransform,
  screenPoint: Position
) {
  return {
    x:
      ((screenPoint.x - transform.viewportOffset.x) /
        transform.viewportScale /
        transform.previewSize.width) *
      transform.meta.width,
    y:
      ((screenPoint.y - transform.viewportOffset.y) /
        transform.viewportScale /
        transform.previewSize.height) *
      transform.meta.height,
  };
}

export function resolveCanvasPointerToComposition({
  overlayLeft,
  overlayTop,
  meta,
  previewSize,
  viewportScale,
  viewportOffset,
  clientX,
  clientY,
}: CanvasScreenTransform & {
  overlayLeft: number;
  overlayTop: number;
  clientX: number;
  clientY: number;
}) {
  const point = canvasPointToWorldPoint(
    { meta, previewSize, viewportScale, viewportOffset },
    { x: clientX - overlayLeft, y: clientY - overlayTop }
  );

  return {
    x: Math.min(Math.max(point.x, 0), meta.width),
    y: Math.min(Math.max(point.y, 0), meta.height),
  };
}
