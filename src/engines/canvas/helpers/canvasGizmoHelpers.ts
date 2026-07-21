import type { CompositionMeta } from "@/models";
import type {
  PreviewMotionPathPoint,
} from "@/engines/canvas/models/canvasViewModel";
import type { CanvasSelectionReadModel } from "@/engines/canvas/models/canvasEngineModel";
import type { CanvasMotionPathPointViewModel, PreviewOverlayViewModel } from "@/engines/canvas/models/canvasInteractionModel";
import { worldPointToCanvasPoint } from "@/engines/canvas/helpers/canvasViewportHelpers";

const GIZMO_RADIAL_RADIUS = 50;
const GIZMO_HOLLOW_ENDPOINT_RADIUS = 5;
const GIZMO_POSITION_RING_RADIUS = 20;
const GIZMO_OPACITY_MIN_RADIUS = 25;
const SCALE_ARROW_HEAD_LENGTH = 8;
const SCALE_ARROW_HEAD_HALF_WIDTH = 5;

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
  const radialDirections = {
    width: { x: -localXAxis.x, y: -localXAxis.y },
    height: { x: -localYAxis.x, y: -localYAxis.y },
    linkedScale: normalizeVector(
      localXAxis.x + localYAxis.x,
      localXAxis.y + localYAxis.y
    ),
    rotation: normalizeVector(
      localXAxis.x - localYAxis.x,
      localXAxis.y - localYAxis.y
    ),
    opacity: normalizeVector(
      -localXAxis.x + localYAxis.x,
      -localXAxis.y + localYAxis.y
    ),
  };
  const getDirectionAngle = (direction: { x: number; y: number }) =>
    (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
  const createHollowEndpointHandle = (
    anchor: { x: number; y: number },
    direction: { x: number; y: number },
    centerRadius: number
  ) => {
    const point = {
      x: anchor.x + direction.x * centerRadius,
      y: anchor.y + direction.y * centerRadius,
    };
    return {
      point,
      lineStart: {
        x: anchor.x + direction.x * GIZMO_POSITION_RING_RADIUS,
        y: anchor.y + direction.y * GIZMO_POSITION_RING_RADIUS,
      },
      lineEnd: {
        x: point.x - direction.x * GIZMO_HOLLOW_ENDPOINT_RADIUS,
        y: point.y - direction.y * GIZMO_HOLLOW_ENDPOINT_RADIUS,
      },
    };
  };
  const getArrowWingPoints = (
    tip: { x: number; y: number },
    direction: { x: number; y: number }
  ) => {
    const baseCenter = {
      x: tip.x - direction.x * SCALE_ARROW_HEAD_LENGTH,
      y: tip.y - direction.y * SCALE_ARROW_HEAD_LENGTH,
    };
    const perpendicular = { x: -direction.y, y: direction.x };
    return {
      first: {
        x: baseCenter.x + perpendicular.x * SCALE_ARROW_HEAD_HALF_WIDTH,
        y: baseCenter.y + perpendicular.y * SCALE_ARROW_HEAD_HALF_WIDTH,
      },
      second: {
        x: baseCenter.x - perpendicular.x * SCALE_ARROW_HEAD_HALF_WIDTH,
        y: baseCenter.y - perpendicular.y * SCALE_ARROW_HEAD_HALF_WIDTH,
      },
    };
  };
  const previewAnchor = selection.previewAnchor;
  const previewRotationHandle = previewAnchor
    ? createHollowEndpointHandle(
        previewAnchor,
        radialDirections.rotation,
        GIZMO_RADIAL_RADIUS
      )
    : null;
  const opacityCenterRadius =
    GIZMO_OPACITY_MIN_RADIUS +
    ((GIZMO_RADIAL_RADIUS - GIZMO_OPACITY_MIN_RADIUS) *
      Math.min(100, Math.max(0, currentOpacity))) /
      100;
  const previewOpacityHandle = previewAnchor
    ? createHollowEndpointHandle(
        previewAnchor,
        radialDirections.opacity,
        opacityCenterRadius
      )
    : null;
  const previewMoveHandle = previewAnchor
    ? {
        point: previewAnchor,
        lineStart: previewAnchor,
      }
    : null;
  const previewScaleHandles = previewAnchor
    ? [
        {
          key: "x" as const,
          point: {
            x: previewAnchor.x + radialDirections.width.x * GIZMO_RADIAL_RADIUS,
            y: previewAnchor.y + radialDirections.width.y * GIZMO_RADIAL_RADIUS,
          },
          lineStart: {
            x: previewAnchor.x + radialDirections.width.x * GIZMO_POSITION_RING_RADIUS,
            y: previewAnchor.y + radialDirections.width.y * GIZMO_POSITION_RING_RADIUS,
          },
          arrowWingPoints: getArrowWingPoints(
            {
              x: previewAnchor.x + radialDirections.width.x * GIZMO_RADIAL_RADIUS,
              y: previewAnchor.y + radialDirections.width.y * GIZMO_RADIAL_RADIUS,
            },
            radialDirections.width
          ),
          directionAngle: getDirectionAngle(radialDirections.width),
          borderColor: "rgba(255, 104, 104, 0.98)",
          label: "W (가로 크기)",
        },
        {
          key: "y" as const,
          point: {
            x: previewAnchor.x + radialDirections.height.x * GIZMO_RADIAL_RADIUS,
            y: previewAnchor.y + radialDirections.height.y * GIZMO_RADIAL_RADIUS,
          },
          lineStart: {
            x: previewAnchor.x + radialDirections.height.x * GIZMO_POSITION_RING_RADIUS,
            y: previewAnchor.y + radialDirections.height.y * GIZMO_POSITION_RING_RADIUS,
          },
          arrowWingPoints: getArrowWingPoints(
            {
              x: previewAnchor.x + radialDirections.height.x * GIZMO_RADIAL_RADIUS,
              y: previewAnchor.y + radialDirections.height.y * GIZMO_RADIAL_RADIUS,
            },
            radialDirections.height
          ),
          directionAngle: getDirectionAngle(radialDirections.height),
          borderColor: "rgba(116, 231, 140, 0.98)",
          label: "H (세로 크기)",
        },
        {
          key: "xy" as const,
          point: {
            x: previewAnchor.x + radialDirections.linkedScale.x * GIZMO_RADIAL_RADIUS,
            y: previewAnchor.y + radialDirections.linkedScale.y * GIZMO_RADIAL_RADIUS,
          },
          lineStart: {
            x: previewAnchor.x + radialDirections.linkedScale.x * GIZMO_POSITION_RING_RADIUS,
            y: previewAnchor.y + radialDirections.linkedScale.y * GIZMO_POSITION_RING_RADIUS,
          },
          arrowWingPoints: getArrowWingPoints(
            {
              x: previewAnchor.x + radialDirections.linkedScale.x * GIZMO_RADIAL_RADIUS,
              y: previewAnchor.y + radialDirections.linkedScale.y * GIZMO_RADIAL_RADIUS,
            },
            radialDirections.linkedScale
          ),
          directionAngle: getDirectionAngle(radialDirections.linkedScale),
          borderColor: "rgba(255, 225, 115, 0.98)",
          label: "WH (비율/전체 크기)",
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
