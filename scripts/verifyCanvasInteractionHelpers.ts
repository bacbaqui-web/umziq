import assert from "node:assert/strict";
import type { CompositionMeta } from "@/models";
import type { PreviewOverlay } from "@/engines/canvas/models/canvasViewModel";
import {
  calculateOpacityDragUpdate,
  calculatePreviewPositionDragUpdate,
  calculateRotationDragUpdate,
  calculateScaleDragUpdate,
  formatPositionDeltaReadout,
  formatRotationHandleValue,
  formatScaleHandleReadout,
  getCanvasTransformEditModes,
} from "@/engines/canvas/helpers/canvasInteractionHelpers";
import {
  createPreviewPositionDragState,
  createPreviewRotationDragState,
  resolvePreviewPointer,
} from "@/engines/canvas/helpers/canvasPointerHelpers";
import {
  buildCanvasMotionPathPointViewModels,
  buildPreviewOverlayViewModel,
} from "@/engines/canvas/helpers/canvasGizmoHelpers";
import {
  getOpacityHandleCursor,
  getRotationHandleCursor,
  getScaleHandleCursor,
} from "@/engines/canvas/helpers/canvasGizmoGeometryHelpers";

const meta: CompositionMeta = {
  width: 1000,
  height: 1000,
  layerCount: 1,
  sourceFileName: "interaction.psd",
  frameRate: 30,
  durationFrames: 90,
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
  context(90, 500),
  { overlay, handle: "x", initialScale: { x: 100, y: 80 } },
  false
);
assert.ok(xScale);
assert.ok(Math.abs(xScale.nextScale.x - 100) < 1e-9);
assert.equal(xScale.nextScale.y, 80);
const yScale = calculateScaleDragUpdate(
  context(500, 90),
  { overlay, handle: "y", initialScale: { x: 80, y: 100 } },
  true
);
assert.ok(yScale);
assert.deepEqual(yScale.nextScale, { x: 80, y: 100 });
const xyScale = calculateScaleDragUpdate(
  context(500 + 540 / Math.sqrt(2), 500 + 540 / Math.sqrt(2)),
  { overlay, handle: "xy", initialScale: { x: 100, y: 50 } },
  false
);
assert.ok(xyScale);
assert.ok(Math.abs(xyScale.nextScale.x - 100) < 1e-9);
assert.ok(Math.abs(xyScale.nextScale.y - 50) < 1e-9);

assert.equal(calculateOpacityDragUpdate(context(640, 500), overlay, false).nextOpacity, 0);
assert.equal(calculateOpacityDragUpdate(context(1000, 1000), overlay, false).nextOpacity, 100);
assert.equal(calculateOpacityDragUpdate(context(342, 500), overlay, true).nextOpacity, 0);

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
assert.deepEqual(
  getCanvasTransformEditModes({
    position: true,
    scale: false,
    rotation: true,
    opacity: false,
  }),
  { position: "animated", scale: "static", rotation: "animated", opacity: "static" }
);

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
  currentOpacity: 50,
});
assert.equal(gizmo.previewScaleHandles.length, 3);
assert.equal(gizmo.previewMotionPath.length, 2);
assert.equal(gizmo.motionPathPolyline, "100,100 200,200");
assert.ok(gizmo.previewRotationHandle);
assert.ok(gizmo.previewOpacityHandle);
assert.ok(gizmo.previewMoveHandle);

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

console.log("Canvas interaction helper verification passed");
