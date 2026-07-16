import assert from "node:assert/strict";
import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import {
  measureCanvasWorkspace,
  observeCanvasWorkspace,
} from "@/engines/canvas/adapters/canvasWorkspaceAdapter";
import {
  getTransformGeometry,
} from "@/engines/canvas/helpers/canvasCoordinateHelpers";
import {
  buildCanvasGuideViewModel,
  buildPreviewGuideGeometry,
} from "@/engines/canvas/helpers/canvasGuideHelpers";
import {
  buildCanvasSelectionReadModel,
  buildCompositionSelectionOverlay,
  buildLayerSelectionOverlay,
} from "@/engines/canvas/helpers/canvasSelectionHelpers";
import {
  canvasPointToWorldPoint,
  clampCanvasZoom,
  getCanvasViewportValues,
  getCanvasZoomPan,
  getCenteredCanvasPan,
  resolveCanvasPointerToComposition,
  worldPointToCanvasPoint,
} from "@/engines/canvas/helpers/canvasViewportHelpers";

const disabledProperties = {
  position: false,
  scale: false,
  rotation: false,
  opacity: false,
};
const meta: CompositionMeta = {
  width: 200,
  height: 100,
  layerCount: 1,
  sourceFileName: "test.psd",
  frameRate: 30,
  durationFrames: 60,
};

assert.equal(clampCanvasZoom(-10), 0.2);
assert.equal(clampCanvasZoom(20), 8);
assert.equal(clampCanvasZoom(1.5), 1.5);
const smallViewport = getCanvasViewportValues({
  minWorkspaceWidth: 360,
  minWorkspaceHeight: 320,
  workspaceSize: { width: 100, height: 80 },
  selectedMeta: meta,
  shortformFrameWidth: 1080,
  shortformFrameHeight: 1920,
  zoom: 0.5,
  pan: { x: 10, y: -5 },
});
assert.equal(smallViewport.previewViewportWidth, 360);
assert.equal(smallViewport.previewViewportHeight, 320);
assert.equal(smallViewport.previewFitZoom, 0.2);
assert.deepEqual(smallViewport.previewSize, { width: 200, height: 100 });
assert.deepEqual(smallViewport.previewBaseOffset, { x: 80, y: 110 });
assert.deepEqual(smallViewport.previewViewportOffset, { x: 90, y: 105 });
assert.equal(smallViewport.previewZoomPercent, 50);

const largeViewport = getCanvasViewportValues({
  minWorkspaceWidth: 360,
  minWorkspaceHeight: 320,
  workspaceSize: { width: 2160, height: 3840 },
  selectedMeta: { ...meta, width: 4000, height: 3000 },
  shortformFrameWidth: 1080,
  shortformFrameHeight: 1920,
  zoom: 1,
  pan: { x: 0, y: 0 },
});
assert.equal(largeViewport.previewFitZoom, 2);
assert.deepEqual(getCenteredCanvasPan(200, 100, 1), { x: 0, y: 0 });
assert.deepEqual(getCenteredCanvasPan(200, 100, 0.5), { x: 50, y: 25 });

const zoomResult = getCanvasZoomPan({
  pointer: { x: 150, y: 100 },
  baseOffset: { x: 50, y: 20 },
  pan: { x: 10, y: 5 },
  currentZoom: 1,
  nextZoom: 2,
});
assert.deepEqual(zoomResult, { zoom: 2, pan: { x: -80, y: -70 } });
const beforeLocal = {
  x: (150 - 50 - 10) / 1,
  y: (100 - 20 - 5) / 1,
};
const afterLocal = {
  x: (150 - 50 - zoomResult.pan.x) / zoomResult.zoom,
  y: (100 - 20 - zoomResult.pan.y) / zoomResult.zoom,
};
assert.deepEqual(afterLocal, beforeLocal);

const screenTransform = {
  meta,
  previewSize: { width: 400, height: 200 },
  viewportScale: 0.5,
  viewportOffset: { x: 30, y: 20 },
};
const screenPoint = worldPointToCanvasPoint(screenTransform, { x: 50, y: 25 });
assert.deepEqual(screenPoint, { x: 80, y: 45 });
assert.deepEqual(canvasPointToWorldPoint(screenTransform, screenPoint), { x: 50, y: 25 });
assert.deepEqual(
  resolveCanvasPointerToComposition({
    ...screenTransform,
    overlayLeft: 10,
    overlayTop: 5,
    clientX: 90,
    clientY: 50,
  }),
  { x: 50, y: 25 }
);
assert.deepEqual(
  resolveCanvasPointerToComposition({
    ...screenTransform,
    overlayLeft: 0,
    overlayTop: 0,
    clientX: -100,
    clientY: 1000,
  }),
  { x: 0, y: 100 }
);

const guide = buildPreviewGuideGeometry({ width: 1080, height: 1920 }, 1080, 1920);
assert.deepEqual(guide.frameRect, { x: 0, y: 0, width: 1080, height: 1920 });
assert.equal(guide.dimRects.length, 0);
assert.equal(guide.safeZoneLines.length, 11);
const wideGuide = buildPreviewGuideGeometry({ width: 2000, height: 1920 }, 1080, 1920);
assert.deepEqual(wideGuide.frameRect, { x: 460, y: 0, width: 1080, height: 1920 });
assert.equal(wideGuide.dimRects.length, 2);
const hiddenGuide = buildCanvasGuideViewModel({
  previewSize: { width: 2000, height: 1920 },
  shortformFrameWidth: 1080,
  shortformFrameHeight: 1920,
  zoom: 0.5,
  showShortformFrame: false,
  showSafeZoneGuides: false,
});
assert.equal(hiddenGuide.showShortformFrame, false);
assert.equal(hiddenGuide.showSafeZoneGuides, false);
assert.equal(hiddenGuide.safeZoneStrokeWidth, 2);

const layer: Layer = {
  id: "layer",
  name: "Layer",
  visible: true,
  position: { x: 100, y: 50 },
  transformOffset: { x: 10, y: -5 },
  anchor: { x: 20, y: 10 },
  positionKeyframes: [],
  scale: { x: 200, y: 50 },
  scaleKeyframes: [],
  scaleLinked: false,
  rotation: 0,
  rotationKeyframes: [],
  opacity: 100,
  opacityKeyframes: [],
  enabledProperties: { ...disabledProperties },
};
const layerTimeline: TimelineItem = {
  id: "item-layer",
  name: "Layer",
  kind: "layer",
  visible: true,
  compId: "root",
  sourceId: layer.id,
  startFrame: 10,
  durationFrames: 20,
};
const canvas = { width: 40, height: 20 } as HTMLCanvasElement;
const renderItems: RenderItem[] = [{
  id: "render-layer",
  name: "Layer",
  kind: "layer",
  visible: true,
  sourceId: layer.id,
  drawables: [{
    id: "drawable-layer",
    left: 0,
    top: 0,
    visible: true,
    sourceLayerId: layer.id,
    canvas,
  }],
}];
assert.equal(buildLayerSelectionOverlay(layer, renderItems, [layerTimeline], 9), null);
const layerOverlay = buildLayerSelectionOverlay(layer, renderItems, [layerTimeline], 10);
assert.ok(layerOverlay);
assert.deepEqual(layerOverlay.corners, {
  nw: { x: 70, y: 40 },
  ne: { x: 150, y: 40 },
  se: { x: 150, y: 50 },
  sw: { x: 70, y: 50 },
});
assert.deepEqual({ x: layerOverlay.anchorX, y: layerOverlay.anchorY }, { x: 110, y: 45 });

const rotatedGeometry = getTransformGeometry(
  40,
  20,
  { x: 100, y: 50 },
  { x: 0, y: 0 },
  { x: 20, y: 10 },
  { x: 100, y: 100 },
  90
);
assert.ok(Math.abs(rotatedGeometry.corners.nw.x - 110) < 1e-9);
assert.ok(Math.abs(rotatedGeometry.corners.nw.y - 30) < 1e-9);

const composition: Composition = {
  id: "sub",
  name: "Sub",
  type: "sub",
  layers: [],
  children: [],
  position: { x: 100, y: 50 },
  positionKeyframes: [],
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 100, y: 50 },
  scale: { x: 100, y: 100 },
  scaleKeyframes: [],
  scaleLinked: true,
  rotation: 0,
  rotationKeyframes: [],
  opacity: 100,
  opacityKeyframes: [],
  enabledProperties: { ...disabledProperties },
};
const compositionOverlay = buildCompositionSelectionOverlay(
  composition,
  { sub: meta },
  new Map([["sub", 0]])
);
assert.ok(compositionOverlay);
assert.deepEqual(compositionOverlay.corners.nw, { x: 0, y: 0 });
const selectionRead = buildCanvasSelectionReadModel({
  overlay: compositionOverlay,
  selectedMeta: meta,
  previewSize: { width: 400, height: 200 },
  viewportScale: 0.5,
  viewportOffset: { x: 30, y: 20 },
});
assert.deepEqual(selectionRead.previewAnchor, { x: 130, y: 70 });
assert.deepEqual(selectionRead.previewCenter, { x: 130, y: 70 });
assert.equal(selectionRead.polygonPoints, "30,20 230,20 230,120 30,120");
assert.deepEqual(
  buildCanvasSelectionReadModel({
    overlay: null,
    selectedMeta: meta,
    previewSize: { width: 400, height: 200 },
    viewportScale: 1,
    viewportOffset: { x: 0, y: 0 },
  }),
  {
    overlay: null,
    previewCorners: null,
    previewAnchor: null,
    previewCenter: null,
    polygonPoints: "",
  }
);

let bounds = { width: 100.9, height: 50.2 };
const fakeElement = { getBoundingClientRect: () => bounds } as HTMLElement;
assert.deepEqual(measureCanvasWorkspace(fakeElement), { width: 100, height: 50 });
let resizeCallback: ResizeObserverCallback | null = null;
let observed = false;
let disconnected = false;
class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
  observe() {
    observed = true;
  }
  disconnect() {
    disconnected = true;
  }
}
const measured: Array<{ width: number; height: number }> = [];
const cleanup = observeCanvasWorkspace(
  fakeElement,
  (size) => measured.push(size),
  FakeResizeObserver
);
assert.equal(observed, true);
assert.deepEqual(measured, [{ width: 100, height: 50 }]);
bounds = { width: 0, height: Number.NaN };
assert.ok(resizeCallback);
resizeCallback([], {} as ResizeObserver);
assert.deepEqual(measured[1], { width: 0, height: 0 });
cleanup();
assert.equal(disconnected, true);

console.log("Canvas helper verification passed");
