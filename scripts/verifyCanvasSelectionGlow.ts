import assert from "node:assert/strict";
import type { TimelineItem } from "@/models";
import { createCanvasSelectionGlowRenderer } from "@/engines/canvas/adapters/canvasSelectionGlowBrowserAdapter";
import {
  CANVAS_SELECTION_GLOW_POINTER_EVENTS,
  CANVAS_SELECTION_OVERLAY_LAYER_ORDER,
} from "@/engines/canvas/constants/canvasSelectionGlowConstants";
import { SELECTION_ALPHA_THRESHOLD } from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import {
  applyCanvasSelectionMatrix,
  buildCanvasSelectionProjection,
} from "@/engines/canvas/helpers/canvasDirectSelectionGeometryHelpers";
import { hitCanvasDirectSelection } from "@/engines/canvas/helpers/canvasDirectSelectionHitHelpers";
import { buildSelectionSourceAlphaFingerprint } from "@/engines/canvas/helpers/canvasSelectionAlphaFingerprintHelpers";
import {
  buildCanvasSelectionGlowDrawPlan,
  buildCanvasSelectionGlowMaskRgba,
  buildCanvasSelectionGlowSelectionKey,
  drawSelectedCanvasGlow,
  releaseCanvasSelectionGlow,
  resolveSelectedCanvasGlowCandidate,
  resolveSelectedCanvasGlowSource,
} from "@/engines/canvas/helpers/canvasSelectionGlowHelpers";
import { createSelectionSourceAlphaProvider } from "@/engines/canvas/helpers/selectionSourceAlphaProvider";
import type {
  CanvasBlockedSelectionCandidate,
  CanvasReadySelectionCandidate,
} from "@/engines/canvas/models/canvasDirectSelectionModel";
import type {
  SelectionLayerAlphaDescriptor,
  SelectionSourceAlphaProvider,
  SelectionSubCompositionAlphaDescriptor,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

const contextLog: string[] = [];
function makeFakeCanvas() {
  const context = {
    filter: "none",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    clearRect: () => contextLog.push("clear"),
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: () => contextLog.push("put-mask"),
    setTransform: () => contextLog.push("transform"),
    save: () => contextLog.push("save"),
    restore: () => contextLog.push("restore"),
    drawImage: () => contextLog.push(
      context.globalCompositeOperation === "destination-out"
        ? "destination-out-interior"
        : "blurred-mask"
    ),
  };
  return {
    width: 1,
    height: 1,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
}

const sourceCanvas = { width: 2, height: 1 } as HTMLCanvasElement;
const descriptor: SelectionLayerAlphaDescriptor = {
  kind: "layer",
  sourceCanvas,
  sourceFingerprint: "source-a",
  sourceRevision: "revision-a",
  frameVisualKey: "static-psd",
  logicalSize: { width: 2, height: 1 },
  opacity: 100,
  visible: true,
};
const transform = {
  position: { x: 1, y: 0.5 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 1, y: 0.5 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};
const projection = buildCanvasSelectionProjection({
  size: { width: 2, height: 1 }, transform,
  viewportScale: 1, viewportOffset: { x: 0, y: 0 },
});
assert.ok(projection);
const timelineItem: TimelineItem = {
  id: "timeline-a", name: "A", kind: "layer", visible: true,
  compId: "comp-a", sourceId: "source-a", startFrame: 0, durationFrames: 10,
};
const candidate: CanvasReadySelectionCandidate = {
  status: "ready",
  sceneNodeIndex: 0,
  renderItemId: "render-a",
  sourceId: "source-a",
  drawable: null,
  target: { kind: "layer", id: "source-a" },
  timelineItem,
  projection,
  selection: { itemId: timelineItem.id, sourceId: timelineItem.sourceId, kind: "layer" },
  descriptor,
};

let providerBuilds = 0;
const provider = createSelectionSourceAlphaProvider({
  adapter: {
    build: (_source, visualFingerprint) => {
      providerBuilds += 1;
      const alphaBytes = new Uint8Array([SELECTION_ALPHA_THRESHOLD, SELECTION_ALPHA_THRESHOLD + 1]);
      return {
        status: "ready",
        entry: {
          visualFingerprint,
          width: 2,
          height: 1,
          alphaBytes,
          sample: (x) => alphaBytes[Math.floor(x)] ?? 0,
        },
      };
    },
  },
});
const hit = hitCanvasDirectSelection({
  point: { x: 1.5, y: 0.5 },
  candidates: [candidate],
  provider,
  compositionSize: { width: 2, height: 1 },
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
});
assert.equal(hit.status, "hit");
const glowSource = resolveSelectedCanvasGlowSource([candidate], timelineItem, provider);
assert.ok(glowSource);
assert.equal(providerBuilds, 1);
const hitEntry = provider.get(candidate.descriptor);
assert.equal(hitEntry.status, "ready");
if (hitEntry.status === "ready") assert.equal(glowSource.entry, hitEntry.entry);
const thresholdMask = buildCanvasSelectionGlowMaskRgba(glowSource.entry);
assert.ok(thresholdMask);
assert.equal(thresholdMask[3], 0);
assert.equal(thresholdMask[7], 255);

let scratchCreates = 0;
const rendererEvents: string[] = [];
const scratchCanvases: HTMLCanvasElement[] = [];
const renderer = createCanvasSelectionGlowRenderer({
  createCanvas: () => {
    scratchCreates += 1;
    const canvas = makeFakeCanvas();
    scratchCanvases.push(canvas);
    return canvas;
  },
  observe: (event) => rendererEvents.push(event.type),
});
const target = makeFakeCanvas();
const firstGlowDraw = renderer.draw(target, {
  entry: glowSource.entry,
  projection,
  viewportSize: { width: 200, height: 100 },
  devicePixelRatio: 2,
});
assert.equal(firstGlowDraw?.visualFingerprint, glowSource.entry.visualFingerprint);
const draftPositionProjection = buildCanvasSelectionProjection({
  size: { width: 2, height: 1 },
  transform: { ...transform, position: { x: 21, y: 10.5 } },
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
});
assert.ok(draftPositionProjection);
const draftCandidate = { ...candidate, projection: draftPositionProjection };
const draftGlowSource = resolveSelectedCanvasGlowSource(
  [draftCandidate],
  timelineItem,
  provider
);
assert.ok(draftGlowSource);
assert.equal(draftGlowSource.entry, glowSource.entry);
assert.equal(providerBuilds, 1);
renderer.draw(target, {
  entry: draftGlowSource.entry,
  projection: draftGlowSource.candidate.projection,
  viewportSize: { width: 200, height: 100 },
  devicePixelRatio: 2,
});
assert.equal(scratchCreates, 1);
assert.equal(rendererEvents.filter((event) => event === "scratch-build").length, 1);
assert.equal(rendererEvents.filter((event) => event === "scratch-reuse").length, 1);
assert.equal(rendererEvents.filter((event) => event === "draw").length, 2);

const tokenByCanvas = new WeakMap<HTMLCanvasElement, number>();
let nextToken = 1;
const fingerprint = (nextDescriptor: SelectionLayerAlphaDescriptor | SelectionSubCompositionAlphaDescriptor) =>
  buildSelectionSourceAlphaFingerprint(nextDescriptor, (canvas) => {
    const existing = tokenByCanvas.get(canvas);
    if (existing) return existing;
    const token = nextToken++;
    tokenByCanvas.set(canvas, token);
    return token;
  });
const secondCanvas = { width: 2, height: 1 } as HTMLCanvasElement;
const visualFingerprints = [
  fingerprint(descriptor),
  fingerprint({ ...descriptor, sourceCanvas: secondCanvas }),
  fingerprint({ ...descriptor, sourceRevision: "revision-b" }),
  fingerprint({ ...descriptor, frameVisualKey: "frame-dependent-2" }),
  fingerprint({ ...descriptor, opacity: 50 }),
];
const childTransform = { ...transform, position: { x: 4, y: 4 } };
const subComp: SelectionSubCompositionAlphaDescriptor = {
  kind: "subComp",
  sourceFingerprint: "group-a",
  sourceRevision: "group-revision-a",
  frameVisualKey: "static-psd",
  logicalSize: { width: 10, height: 10 },
  opacity: 100,
  visible: true,
  orderedChildren: [{ source: descriptor, transform: childTransform }],
};
visualFingerprints.push(
  fingerprint(subComp),
  fingerprint({
    ...subComp,
    orderedChildren: [{
      source: descriptor,
      transform: { ...childTransform, rotation: 20 },
    }],
  })
);
assert.equal(
  new Set(visualFingerprints).size,
  visualFingerprints.length,
  JSON.stringify(visualFingerprints)
);
const createsBeforeVisualChanges = scratchCreates;
const changedVisualFingerprints = visualFingerprints.slice(1);
changedVisualFingerprints.forEach((visualFingerprint) => {
  renderer.draw(target, {
    entry: { ...glowSource.entry, visualFingerprint },
    projection,
    viewportSize: { width: 200, height: 100 },
    devicePixelRatio: 1,
  });
});
assert.equal(scratchCreates - createsBeforeVisualChanges, changedVisualFingerprints.length);

const otherTimelineItem = {
  ...timelineItem,
  id: "timeline-b",
  sourceId: "source-b",
};
const otherCandidate: CanvasReadySelectionCandidate = {
  ...candidate,
  timelineItem: otherTimelineItem,
  selection: { itemId: "timeline-b", sourceId: "source-b", kind: "layer" },
};
assert.notEqual(
  buildCanvasSelectionGlowSelectionKey(candidate),
  buildCanvasSelectionGlowSelectionKey(otherCandidate)
);
const createsBeforeSelectionChange = scratchCreates;
renderer.clearSelection(target);
renderer.draw(target, {
  entry: glowSource.entry,
  projection,
  viewportSize: { width: 200, height: 100 },
  devicePixelRatio: 1,
});
assert.equal(scratchCreates - createsBeforeSelectionChange, 1);

const blocked: CanvasBlockedSelectionCandidate = {
  ...candidate,
  status: "blocked",
  reason: "ambiguous-identity",
};
assert.equal(resolveSelectedCanvasGlowCandidate([candidate, candidate], timelineItem), null);
assert.equal(resolveSelectedCanvasGlowCandidate([blocked], timelineItem), null);
assert.equal(resolveSelectedCanvasGlowCandidate([candidate], null), null);
const unavailableProvider: SelectionSourceAlphaProvider = {
  get: () => ({
    status: "unavailable",
    visualFingerprint: "unavailable",
    reason: "readback-blocked",
  }),
  retain: () => undefined,
  release: () => undefined,
  clear: () => undefined,
  dispose: () => undefined,
};
assert.equal(resolveSelectedCanvasGlowSource([candidate], timelineItem, unavailableProvider), null);
renderer.clearSelection(target);
assert.equal(scratchCanvases.at(-1)?.width, 1);
assert.equal(rendererEvents.at(-1), "clear");

const plan = buildCanvasSelectionGlowDrawPlan({
  entry: glowSource.entry,
  projection,
  viewportSize: { width: 200, height: 100 },
  devicePixelRatio: 2,
});
assert.deepEqual(plan.compositeSequence, [
  "clear-viewport",
  "draw-blurred-selected-mask",
  "destination-out-selected-interior",
]);
assert.ok(contextLog.includes("blurred-mask"));
assert.ok(contextLog.includes("destination-out-interior"));
assert.equal(CANVAS_SELECTION_GLOW_POINTER_EVENTS, "none");
assert.deepEqual(CANVAS_SELECTION_OVERLAY_LAYER_ORDER, [
  "glow", "motion-path", "selection-gizmo",
]);

const signedProjection = buildCanvasSelectionProjection({
  size: { width: 2, height: 1 },
  transform: { ...transform, scale: { x: -150, y: 75 }, rotation: 37 },
  viewportScale: 2.5,
  viewportOffset: { x: 13, y: -7 },
});
assert.ok(signedProjection);
const signedPlan = buildCanvasSelectionGlowDrawPlan({
  entry: glowSource.entry,
  projection: signedProjection,
  viewportSize: { width: 300, height: 200 },
  devicePixelRatio: 2,
});
assert.deepEqual(signedPlan.sourceToDevice, {
  a: signedProjection.sourceToViewport.a * 2,
  b: signedProjection.sourceToViewport.b * 2,
  c: signedProjection.sourceToViewport.c * 2,
  d: signedProjection.sourceToViewport.d * 2,
  e: signedProjection.sourceToViewport.e * 2,
  f: signedProjection.sourceToViewport.f * 2,
});
assert.equal(signedPlan.blurDevicePixels, plan.blurDevicePixels);
const signedPoint = applyCanvasSelectionMatrix(
  signedProjection.sourceToViewport,
  { x: 1, y: 0.5 }
);
const signedHit = hitCanvasDirectSelection({
  point: signedPoint,
  candidates: [{ ...candidate, projection: signedProjection }],
  provider,
  compositionSize: { width: 2, height: 1 },
  viewportScale: 2.5,
  viewportOffset: { x: 13, y: -7 },
});
assert.equal(signedHit.status, "hit");
const invalidDprPlan = buildCanvasSelectionGlowDrawPlan({
  entry: glowSource.entry,
  projection,
  viewportSize: { width: 200, height: 100 },
  devicePixelRatio: Number.NaN,
});
assert.deepEqual(invalidDprPlan.backingSize, { width: 200, height: 100 });

const lifecycleCalls: string[] = [];
const lifecycleProvider: SelectionSourceAlphaProvider = {
  get: (source) => {
    lifecycleCalls.push("get");
    return provider.get(source);
  },
  retain: (fingerprints) => {
    lifecycleCalls.push(`retain:${fingerprints.length}`);
    provider.retain(fingerprints);
  },
  release: (visualFingerprint) => provider.release(visualFingerprint),
  clear: () => {
    lifecycleCalls.push("clear");
    provider.clear();
  },
  dispose: () => provider.dispose(),
};
const drawsBeforeDisabled = rendererEvents.filter((event) => event === "draw").length;
assert.equal(drawSelectedCanvasGlow({
  enabled: false,
  target,
  provider: lifecycleProvider,
  renderer,
  candidate,
  selectedTimelineItem: timelineItem,
  viewportSize: { width: 200, height: 100 },
  devicePixelRatio: 1,
}), false);
assert.deepEqual(lifecycleCalls, []);
assert.equal(rendererEvents.filter((event) => event === "draw").length, drawsBeforeDisabled);

releaseCanvasSelectionGlow({ target, provider: lifecycleProvider, renderer });
assert.deepEqual(lifecycleCalls, ["clear"]);
assert.equal(target.width, 1);
assert.equal(target.height, 1);
assert.equal(scratchCanvases.at(-1)?.width, 1);

lifecycleCalls.length = 0;
const disabledGlowHit = hitCanvasDirectSelection({
  point: { x: 1.5, y: 0.5 },
  candidates: [candidate],
  provider: lifecycleProvider,
  compositionSize: { width: 2, height: 1 },
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
});
assert.equal(disabledGlowHit.status, "hit");
assert.deepEqual(lifecycleCalls, ["get", "retain:1"]);

lifecycleCalls.length = 0;
assert.equal(drawSelectedCanvasGlow({
  enabled: true,
  target,
  provider: lifecycleProvider,
  renderer,
  candidate,
  selectedTimelineItem: timelineItem,
  viewportSize: { width: 200, height: 100 },
  devicePixelRatio: 1,
}), true);
assert.deepEqual(lifecycleCalls, ["get", "retain:1"]);
assert.equal(rendererEvents.at(-1), "draw");
assert.deepEqual({ width: target.width, height: target.height }, { width: 200, height: 100 });

renderer.dispose(target);
console.log("Canvas selection glow verification passed");
