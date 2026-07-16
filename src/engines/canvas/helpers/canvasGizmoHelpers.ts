import type { CompositionMeta } from "@/models";
import type {
  PreviewMotionPathPoint,
} from "@/engines/canvas/models/canvasViewModel";
import type { CanvasSelectionReadModel } from "@/engines/canvas/models/canvasEngineModel";
import type { CanvasMotionPathPointViewModel, PreviewOverlayViewModel } from "@/engines/canvas/models/canvasInteractionModel";
import { worldPointToCanvasPoint } from "@/engines/canvas/helpers/canvasViewportHelpers";

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
  selection: CanvasSelectionReadModel;
  motionPath: PreviewMotionPathPoint[];
  currentOpacity: number;
};

export function buildPreviewOverlayViewModel({
  viewportScale,
  viewportOffset,
  previewSize,
  selectedMeta,
  selection,
  motionPath,
  currentOpacity,
}: BuildPreviewOverlayViewModelOptions): PreviewOverlayViewModel {
  const toViewportPoint = (x: number, y: number) =>
    worldPointToCanvasPoint(
      { meta: selectedMeta, previewSize, viewportScale, viewportOffset },
      { x, y }
    );
  const previewCorners = selection.previewCorners;
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
  const previewAnchor = selection.previewAnchor;
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
  const polygonPoints = selection.polygonPoints;
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

const MOTION_PATH_HANDLE_PROTECTION_RADIUS = 18;

export function buildCanvasMotionPathPointViewModels({
  previewMotionPath,
  protectedControlPoints,
  currentMotionFrame,
  hoveredMotionFrame,
  draggingMotionPathFrame,
  interactionLocked,
}: {
  previewMotionPath: PreviewOverlayViewModel["previewMotionPath"];
  protectedControlPoints: PreviewOverlayViewModel["protectedControlPoints"];
  currentMotionFrame: number | null;
  hoveredMotionFrame: number | null;
  draggingMotionPathFrame: number | null;
  interactionLocked: boolean;
}): CanvasMotionPathPointViewModel[] {
  return previewMotionPath.map((point) => {
    const frameDistance =
      currentMotionFrame === null
        ? Number.POSITIVE_INFINITY
        : Math.abs(point.frame - currentMotionFrame);
    const proximity = Number.isFinite(frameDistance)
      ? Math.max(0, 1 - frameDistance / 10)
      : 0;
    const nearestControlDistance = protectedControlPoints.length
      ? Math.min(
          ...protectedControlPoints.map((controlPoint) =>
            Math.hypot(point.point.x - controlPoint.x, point.point.y - controlPoint.y)
          )
        )
      : Number.POSITIVE_INFINITY;
    const nearProtectedControl =
      nearestControlDistance < MOTION_PATH_HANDLE_PROTECTION_RADIUS;
    const isInteractive = !interactionLocked && !nearProtectedControl;
    const isHovered = hoveredMotionFrame === point.frame && isInteractive;
    const radius = point.isCurrent
      ? 4
      : point.isKeyframe
        ? 2.6 + proximity * 0.8
        : 1.2 + proximity * 1.2;
    const fillOpacity = point.isCurrent
      ? 0.96
      : point.isKeyframe
        ? 0.52 + proximity * 0.34
        : 0.12 + proximity * 0.32;
    return {
      ...point,
      isInteractive,
      isHovered,
      isDragging: draggingMotionPathFrame === point.frame,
      radius,
      hoverRadius: radius + (point.isCurrent ? 0.8 : 1.2),
      displayedOpacity: nearProtectedControl
        ? Math.max(0.08, fillOpacity * 0.45)
        : fillOpacity,
      hitRadius: point.isKeyframe ? 8 : 6,
    };
  });
}
