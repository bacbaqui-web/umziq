import type { CompositionMeta } from "@/editor/types/types";
import type {
  PreviewMotionPathPoint,
  PreviewOverlay as PreviewOverlayData,
  ScaleHandleDirection,
} from "@/editor/types/editorViewTypes";
import { worldPointToScreenPoint } from "@/editor/preview/previewCamera";

const GIZMO_AXIS_RADIUS = 62;
const GIZMO_DIAGONAL_RADIUS = 82;
const GIZMO_MOVE_RADIUS = 54;
const GIZMO_ROTATION_INNER_RADIUS = 18;
const GIZMO_ROTATION_OUTER_RADIUS = 94;
const OPACITY_MIN_SCREEN_RADIUS = 26;
const OPACITY_MAX_SCREEN_RADIUS = 86;

function normalizeVector(x: number, y: number) {
  const length = Math.hypot(x, y) || 1;
  return {
    x: x / length,
    y: y / length,
  };
}

export type PreviewOverlayViewModel = {
  previewCorners: {
    nw: { x: number; y: number };
    ne: { x: number; y: number };
    se: { x: number; y: number };
    sw: { x: number; y: number };
  } | null;
  previewAnchor: { x: number; y: number } | null;
  previewRotationHandle: {
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
  } | null;
  previewOpacityHandle: {
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
  } | null;
  previewMoveHandle: {
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
  } | null;
  previewScaleHandles: Array<{
    key: ScaleHandleDirection;
    point: { x: number; y: number };
    lineStart: { x: number; y: number };
    borderColor: string;
    label: string;
  }>;
  previewMotionPath: Array<
    PreviewMotionPathPoint & {
      point: { x: number; y: number };
    }
  >;
  protectedControlPoints: Array<{ x: number; y: number }>;
  polygonPoints: string;
  motionPathPolyline: string;
};

type BuildPreviewOverlayViewModelOptions = {
  viewportScale: number;
  viewportOffset: {
    x: number;
    y: number;
  };
  previewSize: {
    width: number;
    height: number;
  };
  selectedMeta: CompositionMeta;
  overlay: PreviewOverlayData | null;
  motionPath: PreviewMotionPathPoint[];
  currentOpacity: number;
};

export function buildPreviewOverlayViewModel({
  viewportScale,
  viewportOffset,
  previewSize,
  selectedMeta,
  overlay,
  motionPath,
  currentOpacity,
}: BuildPreviewOverlayViewModelOptions): PreviewOverlayViewModel {
  const toViewportPoint = (x: number, y: number) =>
    worldPointToScreenPoint(
      {
        meta: selectedMeta,
        previewSize,
        viewportScale,
        viewportOffset,
      },
      { x, y }
    );
  const previewCorners = overlay
    ? {
        nw: toViewportPoint(overlay.corners.nw.x, overlay.corners.nw.y),
        ne: toViewportPoint(overlay.corners.ne.x, overlay.corners.ne.y),
        se: toViewportPoint(overlay.corners.se.x, overlay.corners.se.y),
        sw: toViewportPoint(overlay.corners.sw.x, overlay.corners.sw.y),
      }
    : null;
  const localXAxis = previewCorners
    ? normalizeVector(
        previewCorners.ne.x - previewCorners.nw.x,
        previewCorners.ne.y - previewCorners.nw.y
      )
    : { x: 1, y: 0 };
  const localYAxis = previewCorners
    ? normalizeVector(
        previewCorners.sw.x - previewCorners.nw.x,
        previewCorners.sw.y - previewCorners.nw.y
      )
    : { x: 0, y: 1 };
  const leftAxis = {
    x: -localXAxis.x,
    y: -localXAxis.y,
  };
  const upAxis = {
    x: -localYAxis.x,
    y: -localYAxis.y,
  };
  const diagonalAxis = normalizeVector(localXAxis.x + localYAxis.x, localXAxis.y + localYAxis.y);
  const rotationAxis = normalizeVector(
    localXAxis.x - localYAxis.x,
    localXAxis.y - localYAxis.y
  );
  const opacityAxis = normalizeVector(
    -localXAxis.x + localYAxis.x,
    -localXAxis.y + localYAxis.y
  );
  const opacityRadius =
    OPACITY_MIN_SCREEN_RADIUS +
    ((OPACITY_MAX_SCREEN_RADIUS - OPACITY_MIN_SCREEN_RADIUS) *
      Math.min(100, Math.max(0, currentOpacity))) /
      100;
  const previewAnchor = overlay
    ? toViewportPoint(overlay.anchorX, overlay.anchorY)
    : null;
  const previewRotationHandle = previewAnchor
    ? {
        point: {
          x: previewAnchor.x + rotationAxis.x * GIZMO_ROTATION_OUTER_RADIUS,
          y: previewAnchor.y + rotationAxis.y * GIZMO_ROTATION_OUTER_RADIUS,
        },
        lineStart: {
          x: previewAnchor.x + rotationAxis.x * GIZMO_ROTATION_INNER_RADIUS,
          y: previewAnchor.y + rotationAxis.y * GIZMO_ROTATION_INNER_RADIUS,
        },
      }
    : null;
  const previewOpacityHandle = previewAnchor
    ? {
        point: {
          x: previewAnchor.x + opacityAxis.x * opacityRadius,
          y: previewAnchor.y + opacityAxis.y * opacityRadius,
        },
        lineStart: {
          x: previewAnchor.x + opacityAxis.x * Math.min(opacityRadius - 14, 18),
          y: previewAnchor.y + opacityAxis.y * Math.min(opacityRadius - 14, 18),
        },
      }
    : null;
  const previewMoveHandle = previewAnchor
    ? {
        point: {
          x: previewAnchor.x + localXAxis.x * GIZMO_MOVE_RADIUS,
          y: previewAnchor.y + localXAxis.y * GIZMO_MOVE_RADIUS,
        },
        lineStart: {
          x: previewAnchor.x + localXAxis.x * 14,
          y: previewAnchor.y + localXAxis.y * 14,
        },
      }
    : null;
  const previewScaleHandles = previewAnchor
    ? [
        {
          key: "x" as const,
          point: {
            x: previewAnchor.x + leftAxis.x * GIZMO_AXIS_RADIUS,
            y: previewAnchor.y + leftAxis.y * GIZMO_AXIS_RADIUS,
          },
          lineStart: previewAnchor,
          borderColor: "rgba(255, 104, 104, 0.98)",
          label: "X 스케일",
        },
        {
          key: "y" as const,
          point: {
            x: previewAnchor.x + upAxis.x * GIZMO_AXIS_RADIUS,
            y: previewAnchor.y + upAxis.y * GIZMO_AXIS_RADIUS,
          },
          lineStart: previewAnchor,
          borderColor: "rgba(116, 231, 140, 0.98)",
          label: "Y 스케일",
        },
        {
          key: "xy" as const,
          point: {
            x: previewAnchor.x + diagonalAxis.x * GIZMO_DIAGONAL_RADIUS,
            y: previewAnchor.y + diagonalAxis.y * GIZMO_DIAGONAL_RADIUS,
          },
          lineStart: previewAnchor,
          borderColor: "rgba(255, 225, 115, 0.98)",
          label: "XY 스케일",
        },
      ]
    : [];
  const previewMotionPath = motionPath.map((point) => ({
    ...point,
    point: toViewportPoint(point.x, point.y),
  }));
  const protectedControlPoints = previewAnchor
    ? [
        previewAnchor,
        ...(previewMoveHandle ? [previewMoveHandle.point] : []),
        ...(previewRotationHandle ? [previewRotationHandle.point] : []),
        ...(previewOpacityHandle ? [previewOpacityHandle.point] : []),
        ...previewScaleHandles.map((handle) => handle.point),
      ]
    : [];
  const polygonPoints = previewCorners
    ? [previewCorners.nw, previewCorners.ne, previewCorners.se, previewCorners.sw]
        .map((point) => `${point.x},${point.y}`)
        .join(" ")
    : "";
  const motionPathPolyline = previewMotionPath
    .map(({ point }) => `${point.x},${point.y}`)
    .join(" ");

  return {
    previewCorners,
    previewAnchor,
    previewRotationHandle,
    previewOpacityHandle,
    previewMoveHandle,
    previewScaleHandles,
    previewMotionPath,
    protectedControlPoints,
    polygonPoints,
    motionPathPolyline,
  };
}
