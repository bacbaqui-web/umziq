import type { CompositionMeta, Position } from "@/editor/types/types";

const PREVIEW_MIN_ZOOM = 0.2;
const PREVIEW_MAX_ZOOM = 8;

export function clampPreviewZoom(value: number) {
  return Math.min(PREVIEW_MAX_ZOOM, Math.max(PREVIEW_MIN_ZOOM, value));
}

export function getCenteredPreviewPan(
  contentWidth: number,
  contentHeight: number,
  zoom: number
) {
  return {
    x: (contentWidth - contentWidth * zoom) / 2,
    y: (contentHeight - contentHeight * zoom) / 2,
  };
}

type PreviewScreenTransform = {
  meta: CompositionMeta,
  previewSize: {
    width: number;
    height: number;
  },
  viewportScale: number,
  viewportOffset: Position,
};

type PreviewScreenPoint = {
  x: number;
  y: number;
};

export function worldPointToScreenPoint(
  transform: PreviewScreenTransform,
  worldPoint: PreviewScreenPoint
) {
  return {
    x:
      transform.viewportOffset.x +
      (worldPoint.x / transform.meta.width) * transform.previewSize.width * transform.viewportScale,
    y:
      transform.viewportOffset.y +
      (worldPoint.y / transform.meta.height) *
        transform.previewSize.height *
        transform.viewportScale,
  };
}

export function screenPointToWorldPoint(
  transform: PreviewScreenTransform,
  screenPoint: PreviewScreenPoint
) {
  return {
    x:
      ((screenPoint.x - transform.viewportOffset.x) / transform.viewportScale /
        transform.previewSize.width) *
      transform.meta.width,
    y:
      ((screenPoint.y - transform.viewportOffset.y) / transform.viewportScale /
        transform.previewSize.height) *
      transform.meta.height,
  };
}

export function resolvePointerToCompSpace(
  overlayBounds: DOMRect,
  meta: CompositionMeta,
  previewSize: {
    width: number;
    height: number;
  },
  viewportScale: number,
  viewportOffset: Position,
  clientX: number,
  clientY: number
) {
  const unclampedPoint = screenPointToWorldPoint(
    {
      meta,
      previewSize,
      viewportScale,
      viewportOffset,
    },
    {
      x: clientX - overlayBounds.left,
      y: clientY - overlayBounds.top,
    }
  );

  return {
    x: Math.min(Math.max(unclampedPoint.x, 0), meta.width),
    y: Math.min(Math.max(unclampedPoint.y, 0), meta.height),
  };
}
