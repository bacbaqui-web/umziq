import assert from "node:assert/strict";
import type { PreviewOverlay } from "@/engines/canvas/models/canvasViewModel";
import {
  calculateOpacityDragUpdate,
  calculatePreviewPositionDragUpdate,
  calculateRotationDragUpdate,
  calculateScaleDragUpdate,
  formatPositionDeltaReadout,
  formatRotationHandleValue,
  formatScaleHandleReadout,
  isCanvasTransformDragActive,
  shouldRunCanvasDirectSelectionHover,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
import {
  createPreviewPositionDragState,
  createPreviewRotationDragState,
  resolvePreviewPointer,
} from "@/engines/canvas/helpers/canvasPointerHelpers";
import {
  buildCanvasMotionPathProjectionViewModel,
  buildCanvasMotionPathPointViewModels,
  buildPreviewGizmoGeometryViewModel,
  buildPreviewOverlayViewModel,
} from "@/engines/canvas/helpers/canvasGizmoHelpers";
import {
  getScaleHandleDescriptors,
  getOpacityHandleCursor,
  getRotationHandleCursor,
  getScaleHandleCursor,
} from "@/engines/canvas/helpers/canvasGizmoGeometryHelpers";

const meta = {
  width: 1000,
  height: 1000,
};
const overlay: NonNullable<PreviewOverlay> = {
  targetKind: "layer",
  targetId: "layer",
  x: 300,
  y: 300,
  width: 400,
  height: 400,
  centerX: 500,
  centerY: 500,
  corners: {
    nw: { x: 300, y: 300 },
    ne: { x: 700, y: 300 },
    se: { x: 700, y: 700 },
    sw: { x: 300, y: 700 },
  },
  anchorX: 500,
  anchorY: 500,
  scaleX: 100,
  scaleY: 100,
  rotation: 10,
  sourceWidth: 400,
  sourceHeight: 400,
  canvasWidth: 400,
  canvasHeight: 400,
};
const context = (clientX: number, clientY: number) => ({
  overlayBounds: {
    left: 0,
    top: 0,
  } as DOMRect,
  selectedMeta: meta,
  previewSize: { width: 1000, height: 1000 },
  previewZoom: 1,
  previewViewportOffset: { x: 0, y: 0 },
  clientX,
  clientY,
});

assert.deepEqual(resolvePreviewPointer(context(-10, 1100)), { x: 0, y: 1000 });
const positionDrag = createPreviewPositionDragState(
  context(200, 300),
  overlay,
  { x: 50, y: 60 }
);
const positionUpdate = calculatePreviewPositionDragUpdate(
  context(213.6, 280.2),
  positionDrag
);
assert.deepEqual(positionUpdate.delta, { x: 14, y: -20 });
assert.deepEqual(positionUpdate.nextPosition, { x: 64, y: 40 });
assert.equal(positionUpdate.readout, "ΔX +14 / ΔY -20");

const xScale = calculateScaleDragUpdate(
  context(450, 500),
  {
    overlay,
    handle: "x",
    initialScale: { x: 100, y: 80 },
    startPointer: { x: 450, y: 500 },
  },
  false
);
assert.ok(xScale);
assert.ok(Math.abs(xScale.nextScale.x - 100) < 1e-9);
assert.equal(xScale.nextScale.y, 80);
const yScale = calculateScaleDragUpdate(
  context(500, 450),
  {
    overlay,
    handle: "y",
    initialScale: { x: 80, y: 100 },
    startPointer: { x: 500, y: 450 },
  },
  true
);
assert.ok(yScale);
assert.deepEqual(yScale.nextScale, { x: 80, y: 100 });
const xyScale = calculateScaleDragUpdate(
  context(500 + 50 / Math.sqrt(2), 500 + 50 / Math.sqrt(2)),
  {
    overlay,
    handle: "xy",
    initialScale: { x: 100, y: 50 },
    startPointer: {
      x: 500 + 50 / Math.sqrt(2),
      y: 500 + 50 / Math.sqrt(2),
    },
  },
  false
);
assert.ok(xyScale);
assert.ok(Math.abs(xyScale.nextScale.x - 100) < 1e-9);
assert.ok(Math.abs(xyScale.nextScale.y - 50) < 1e-9);

const doubledXScale = calculateScaleDragUpdate(
  context(400, 500),
  {
    overlay,
    handle: "x",
    initialScale: { x: 100, y: 80 },
    startPointer: { x: 450, y: 500 },
  },
  false
);
assert.deepEqual(doubledXScale?.nextScale, { x: 200, y: 80 });
const halvedYScale = calculateScaleDragUpdate(
  context(500, 475),
  {
    overlay,
    handle: "y",
    initialScale: { x: 80, y: 100 },
    startPointer: { x: 500, y: 450 },
  },
  false
);
assert.deepEqual(halvedYScale?.nextScale, { x: 80, y: 50 });
const doubledLinkedScale = calculateScaleDragUpdate(
  context(500 + 100 / Math.sqrt(2), 500 + 100 / Math.sqrt(2)),
  {
    overlay,
    handle: "xy",
    initialScale: { x: 100, y: 50 },
    startPointer: {
      x: 500 + 50 / Math.sqrt(2),
      y: 500 + 50 / Math.sqrt(2),
    },
  },
  false
);
assert.ok(doubledLinkedScale);
assert.ok(Math.abs(doubledLinkedScale.nextScale.x - 200) < 1e-9);
assert.ok(Math.abs(doubledLinkedScale.nextScale.y - 100) < 1e-9);
const negativeXScale = calculateScaleDragUpdate(
  context(400, 500),
  {
    overlay,
    handle: "x",
    initialScale: { x: -100, y: 80 },
    startPointer: { x: 450, y: 500 },
  },
  false
);
assert.deepEqual(negativeXScale?.nextScale, { x: -200, y: 80 });

assert.equal(calculateOpacityDragUpdate(context(500, 500), overlay, false).nextOpacity, 0);
assert.equal(calculateOpacityDragUpdate(context(525, 500), overlay, false).nextOpacity, 0);
const opacityDrag50 = calculateOpacityDragUpdate(context(537.5, 500), overlay, false);
assert.equal(opacityDrag50.nextOpacity, 50);
assert.equal(calculateOpacityDragUpdate(context(550, 500), overlay, false).nextOpacity, 100);
assert.equal(calculateOpacityDragUpdate(context(560, 500), overlay, false).nextOpacity, 100);
assert.equal(calculateOpacityDragUpdate(context(538.8, 500), overlay, true).nextOpacity, 60);

const rotationDrag = createPreviewRotationDragState(context(600, 500), overlay);
const rotationUpdate = calculateRotationDragUpdate(
  context(500, 600),
  rotationDrag,
  false
);
assert.ok(rotationUpdate);
assert.equal(rotationUpdate.nextRotation, 100);
const snappedRotation = calculateRotationDragUpdate(
  context(500, 600),
  rotationDrag,
  true
);
assert.ok(snappedRotation);
assert.equal(snappedRotation.nextRotation, 105);

assert.equal(formatRotationHandleValue(-20.4), "-20°");
assert.equal(formatScaleHandleReadout("xy", { x: 120.2, y: 80.4 }), "X 120% / Y 80%");
assert.equal(formatPositionDeltaReadout({ x: 0, y: 3 }), "ΔX +0 / ΔY +3");
const selection = {
  overlay,
  previewCorners: overlay.corners,
  previewAnchor: { x: 500, y: 500 },
  previewCenter: { x: 500, y: 500 },
  polygonPoints: "300,300 700,300 700,700 300,700",
};
const gizmo = buildPreviewOverlayViewModel({
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
  previewSize: { width: 1000, height: 1000 },
  selectedMeta: meta,
  selection,
  motionPath: [
    { frame: 0, x: 100, y: 100, isKeyframe: true, isCurrent: true },
    { frame: 1, x: 200, y: 200, isKeyframe: false, isCurrent: false },
  ],
  currentOpacity: opacityDrag50.nextOpacity,
});
const splitGizmoGeometry = buildPreviewGizmoGeometryViewModel({
  selection,
  currentOpacity: opacityDrag50.nextOpacity,
});
const splitMotionPathProjection = buildCanvasMotionPathProjectionViewModel({
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
  previewSize: { width: 1000, height: 1000 },
  selectedMeta: meta,
  motionPath: [
    { frame: 0, x: 100, y: 100, isKeyframe: true, isCurrent: true },
    { frame: 1, x: 200, y: 200, isKeyframe: false, isCurrent: false },
  ],
});
assert.deepEqual(
  { ...splitGizmoGeometry, ...splitMotionPathProjection },
  gizmo
);
assert.equal(gizmo.previewScaleHandles.length, 3);
assert.deepEqual(
  gizmo.previewScaleHandles.map(({ key, label, directionAngle }) => ({
    key,
    label,
    directionAngle,
  })),
  [
    { key: "x", label: "W (가로 크기)", directionAngle: -180 },
    { key: "y", label: "H (세로 크기)", directionAngle: -90 },
    { key: "xy", label: "WH (비율/전체 크기)", directionAngle: 45 },
  ]
);
assert.equal(gizmo.previewMotionPath.length, 2);
assert.deepEqual(
  gizmo.previewMotionPath.map((point) => point.point),
  [
    { x: 100, y: 100 },
    { x: 200, y: 200 },
  ]
);
assert.equal(gizmo.motionPathPolyline, "100,100 200,200");
assert.ok(gizmo.previewRotationHandle);
assert.ok(gizmo.previewOpacityHandle);
assert.ok(gizmo.previewMoveHandle);
assert.deepEqual(gizmo.previewMoveHandle.point, gizmo.previewAnchor);
assert.equal(gizmo.protectedControlPoints[0], gizmo.protectedControlPoints[1]);
const outerHandlePoints = [
  ...gizmo.previewScaleHandles.map((handle) => handle.point),
  gizmo.previewRotationHandle.point,
];
for (const point of outerHandlePoints) {
  assert.ok(Math.abs(Math.hypot(point.x - 500, point.y - 500) - 50) < 1e-9);
}
for (const handle of [
  ...gizmo.previewScaleHandles,
  gizmo.previewRotationHandle,
  gizmo.previewOpacityHandle,
]) {
  assert.ok(
    Math.abs(
      Math.hypot(handle.lineStart.x - 500, handle.lineStart.y - 500) - 24
    ) < 1e-9
  );
}
assert.deepEqual(gizmo.previewScaleHandles[0].point, { x: 450, y: 500 });
assert.deepEqual(gizmo.previewScaleHandles[1].point, { x: 500, y: 450 });
assert.ok(gizmo.previewScaleHandles[2].point.x > 500);
assert.ok(gizmo.previewScaleHandles[2].point.y > 500);
assert.ok(gizmo.previewRotationHandle.point.x > 500);
assert.ok(gizmo.previewRotationHandle.point.y < 500);
assert.ok(gizmo.previewOpacityHandle.point.x < 500);
assert.ok(gizmo.previewOpacityHandle.point.y > 500);
assert.ok(
  Math.abs(
    Math.hypot(
      gizmo.previewOpacityHandle.point.x - 500,
      gizmo.previewOpacityHandle.point.y - 500
    ) - 37.5
  ) < 1e-9
);
for (const handle of [gizmo.previewRotationHandle, gizmo.previewOpacityHandle]) {
  assert.ok(
    Math.abs(
      Math.hypot(
        handle.point.x - handle.lineEnd.x,
        handle.point.y - handle.lineEnd.y
      ) - 6
    ) < 1e-9
  );
}
assert.ok(
  Math.abs(
    Math.hypot(
      gizmo.previewRotationHandle.lineEnd.x - 500,
      gizmo.previewRotationHandle.lineEnd.y - 500
    ) - 44
  ) < 1e-9
);
assert.ok(
  Math.abs(
    Math.hypot(
      gizmo.previewOpacityHandle.lineEnd.x - 500,
      gizmo.previewOpacityHandle.lineEnd.y - 500
    ) - 31.5
  ) < 1e-9
);
const buildOpacityGizmo = (currentOpacity: number) =>
  buildPreviewOverlayViewModel({
    viewportScale: 1,
    viewportOffset: { x: 0, y: 0 },
    previewSize: { width: 1000, height: 1000 },
    selectedMeta: meta,
    selection,
    motionPath: [],
    currentOpacity,
  });
for (const [opacity, centerRadius, lineEndRadius] of [
  [-20, 25, 19],
  [0, 25, 19],
  [50, 37.5, 31.5],
  [100, 50, 44],
  [120, 50, 44],
] as const) {
  const opacityGizmo = buildOpacityGizmo(opacity);
  assert.ok(opacityGizmo.previewOpacityHandle);
  assert.ok(
    Math.abs(
      Math.hypot(
        opacityGizmo.previewOpacityHandle.point.x - 500,
        opacityGizmo.previewOpacityHandle.point.y - 500
      ) - centerRadius
    ) < 1e-9
  );
  assert.ok(
    Math.abs(
      Math.hypot(
        opacityGizmo.previewOpacityHandle.lineEnd.x - 500,
        opacityGizmo.previewOpacityHandle.lineEnd.y - 500
      ) - lineEndRadius
    ) < 1e-9
  );
}
assert.deepEqual(gizmo.previewScaleHandles[0].arrowWingPoints, {
  first: { x: 459.6, y: 494 },
  second: { x: 459.6, y: 506 },
});

const rotatePoint = (x: number, y: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: 500 + x * Math.cos(radians) - y * Math.sin(radians),
    y: 500 + x * Math.sin(radians) + y * Math.cos(radians),
  };
};
const rotatedCorners = {
  nw: rotatePoint(-200, -200, 30),
  ne: rotatePoint(200, -200, 30),
  se: rotatePoint(200, 200, 30),
  sw: rotatePoint(-200, 200, 30),
};
const rotatedOverlay = { ...overlay, corners: rotatedCorners };
const rotatedGizmo = buildPreviewOverlayViewModel({
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
  previewSize: { width: 1000, height: 1000 },
  selectedMeta: meta,
  selection: {
    ...selection,
    overlay: rotatedOverlay,
    previewCorners: rotatedCorners,
  },
  motionPath: [],
  currentOpacity: 100,
});
assert.deepEqual(
  rotatedGizmo.previewScaleHandles.map(({ directionAngle }) =>
    Math.round(directionAngle)
  ),
  [-150, -60, 75]
);
for (const point of [
  ...rotatedGizmo.previewScaleHandles.map((handle) => handle.point),
  rotatedGizmo.previewRotationHandle?.point,
  rotatedGizmo.previewOpacityHandle?.point,
]) {
  assert.ok(point);
  assert.ok(Math.abs(Math.hypot(point.x - 500, point.y - 500) - 50) < 1e-9);
}
for (const handle of [
  ...rotatedGizmo.previewScaleHandles,
  rotatedGizmo.previewRotationHandle,
  rotatedGizmo.previewOpacityHandle,
]) {
  assert.ok(handle);
  assert.ok(
    Math.abs(
      Math.hypot(handle.lineStart.x - 500, handle.lineStart.y - 500) - 24
    ) < 1e-9
  );
}
assert.deepEqual(rotatedGizmo.previewMoveHandle?.point, rotatedGizmo.previewAnchor);
assert.equal(
  rotatedGizmo.protectedControlPoints[0],
  rotatedGizmo.protectedControlPoints[1]
);
for (const handle of rotatedGizmo.previewScaleHandles) {
  const wingSpan = Math.hypot(
    handle.arrowWingPoints.first.x - handle.arrowWingPoints.second.x,
    handle.arrowWingPoints.first.y - handle.arrowWingPoints.second.y
  );
  assert.ok(Math.abs(wingSpan - 12) < 1e-9);
  const wingMidpoint = {
    x: (handle.arrowWingPoints.first.x + handle.arrowWingPoints.second.x) / 2,
    y: (handle.arrowWingPoints.first.y + handle.arrowWingPoints.second.y) / 2,
  };
  assert.ok(
    Math.abs(
      Math.hypot(
        handle.point.x - wingMidpoint.x,
        handle.point.y - wingMidpoint.y
      ) - 9.6
    ) < 1e-9
  );
}
for (const handle of [
  rotatedGizmo.previewRotationHandle,
  rotatedGizmo.previewOpacityHandle,
]) {
  assert.ok(handle);
  assert.ok(
    Math.abs(
      Math.hypot(
        handle.point.x - handle.lineEnd.x,
        handle.point.y - handle.lineEnd.y
      ) - 6
    ) < 1e-9
  );
  assert.ok(
    Math.abs(
      Math.hypot(handle.lineEnd.x - 500, handle.lineEnd.y - 500) - 44
    ) < 1e-9
  );
}
const rotatedWidthDescriptor = getScaleHandleDescriptors(rotatedOverlay)[0];
const rotatedWidthScale = calculateScaleDragUpdate(
  context(rotatedWidthDescriptor.x, rotatedWidthDescriptor.y),
  {
    overlay: rotatedOverlay,
    handle: "x",
    initialScale: { x: 100, y: 80 },
    startPointer: {
      x: rotatedWidthDescriptor.x,
      y: rotatedWidthDescriptor.y,
    },
  },
  false
);
assert.ok(rotatedWidthScale);
assert.ok(Math.abs(rotatedWidthScale.nextScale.x - 100) < 1e-9);
assert.equal(rotatedWidthScale.nextScale.y, 80);

const unlockedPoints = buildCanvasMotionPathPointViewModels({
  previewMotionPath: gizmo.previewMotionPath,
  protectedControlPoints: [],
  currentMotionFrame: 0,
  hoveredMotionFrame: 1,
  draggingMotionPathFrame: 0,
  interactionLocked: false,
});
assert.equal(unlockedPoints[0].isDragging, true);
assert.equal(unlockedPoints[1].isInteractive, true);
assert.equal(unlockedPoints[1].isHovered, true);
assert.deepEqual(
  unlockedPoints.map(({ frame, point, isCurrent, isKeyframe }) => ({
    frame,
    point,
    isCurrent,
    isKeyframe,
  })),
  gizmo.previewMotionPath.map(({ frame, point, isCurrent, isKeyframe }) => ({
    frame,
    point,
    isCurrent,
    isKeyframe,
  }))
);
assert.equal(
  gizmo.motionPathPolyline,
  unlockedPoints.map(({ point }) => `${point.x},${point.y}`).join(" ")
);
const protectedPoints = buildCanvasMotionPathPointViewModels({
  previewMotionPath: gizmo.previewMotionPath,
  protectedControlPoints: [{ x: 100, y: 100 }],
  currentMotionFrame: 0,
  hoveredMotionFrame: 0,
  draggingMotionPathFrame: null,
  interactionLocked: false,
});
assert.equal(protectedPoints[0].isInteractive, false);
const lockedPoints = buildCanvasMotionPathPointViewModels({
  previewMotionPath: gizmo.previewMotionPath,
  protectedControlPoints: [],
  currentMotionFrame: 0,
  hoveredMotionFrame: 1,
  draggingMotionPathFrame: null,
  interactionLocked: true,
});
assert.equal(lockedPoints[1].isInteractive, false);

assert.equal(getScaleHandleCursor("x"), "ew-resize");
assert.equal(getScaleHandleCursor("y"), "ns-resize");
assert.equal(getScaleHandleCursor("xy"), "nwse-resize");
assert.match(getRotationHandleCursor(), /crosshair$/);
assert.match(getOpacityHandleCursor(), /pointer$/);

const idleTransformDrag = {
  isDraggingAnchor: false,
  isDraggingPosition: false,
  isDraggingScale: false,
  isDraggingOpacity: false,
  isDraggingRotation: false,
};
assert.equal(isCanvasTransformDragActive(idleTransformDrag), false);
for (const key of Object.keys(idleTransformDrag) as Array<keyof typeof idleTransformDrag>) {
  assert.equal(isCanvasTransformDragActive({ ...idleTransformDrag, [key]: true }), true, key);
}
let scaleDragProviderGets = 0;
if (shouldRunCanvasDirectSelectionHover({
  isPreviewPanning: false,
  isPreviewPanModifierActive: false,
  isTransformDragging: isCanvasTransformDragActive({
    ...idleTransformDrag,
    isDraggingScale: true,
  }),
  isExcludedTarget: false,
})) {
  scaleDragProviderGets += 1;
}
assert.equal(scaleDragProviderGets, 0);
assert.equal(shouldRunCanvasDirectSelectionHover({
  isPreviewPanning: false,
  isPreviewPanModifierActive: false,
  isTransformDragging: false,
  isExcludedTarget: false,
}), true);

console.log("Canvas interaction helper verification passed");
