import assert from "node:assert/strict";
import { createCanvasSelectionAlphaBrowserAdapter } from "@/engines/canvas/adapters/canvasSelectionAlphaBrowserAdapter";
import { SELECTION_ALPHA_THRESHOLD } from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import { buildSelectionSourceAlphaFingerprint } from "@/engines/canvas/helpers/canvasSelectionAlphaFingerprintHelpers";
import { createSelectionSourceAlphaProvider } from "@/engines/canvas/helpers/selectionSourceAlphaProvider";
import type {
  SelectionAlphaBrowserAdapter,
  SelectionLayerAlphaDescriptor,
  SelectionSourceAlphaDescriptor,
  SelectionSourceAlphaProviderEvent,
  SelectionSubCompositionAlphaDescriptor,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

const canvasA = { width: 2, height: 2 } as HTMLCanvasElement;
const canvasB = { width: 2, height: 2 } as HTMLCanvasElement;
const baseLayer: SelectionLayerAlphaDescriptor = {
  kind: "layer",
  sourceCanvas: canvasA,
  sourceFingerprint: "psd-pixels-a",
  sourceRevision: "psd-refresh-1",
  frameVisualKey: "static",
  logicalSize: { width: 2, height: 2 },
  opacity: 100,
  visible: true,
};
assert.equal(SELECTION_ALPHA_THRESHOLD, 0);
const transform = {
  position: { x: 1, y: 1 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 1, y: 1 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

function createTokenResolver() {
  const tokens = new WeakMap<HTMLCanvasElement, number>();
  let next = 1;
  return (canvas: HTMLCanvasElement) => {
    const cached = tokens.get(canvas);
    if (cached !== undefined) return cached;
    const token = next++;
    tokens.set(canvas, token);
    return token;
  };
}

const getCanvasToken = createTokenResolver();
const fingerprint = (descriptor: SelectionSourceAlphaDescriptor) =>
  buildSelectionSourceAlphaFingerprint(descriptor, getCanvasToken);
const baseFingerprint = fingerprint(baseLayer);
assert.equal(
  baseFingerprint,
  fingerprint({
    ...baseLayer,
    position: { x: 999, y: 999 },
    viewportScale: 4,
    draftRotation: 45,
  } as SelectionLayerAlphaDescriptor)
);
assert.notEqual(
  baseFingerprint,
  fingerprint({ ...baseLayer, sourceCanvas: canvasB })
);
assert.notEqual(
  baseFingerprint,
  fingerprint({ ...baseLayer, sourceRevision: "psd-refresh-2" })
);
assert.notEqual(
  baseFingerprint,
  fingerprint({ ...baseLayer, frameVisualKey: "frame-2" })
);
assert.notEqual(
  baseFingerprint,
  fingerprint({ ...baseLayer, sourceFingerprint: "psd-pixels-b" })
);
assert.notEqual(
  baseFingerprint,
  fingerprint({ ...baseLayer, logicalSize: { width: 3, height: 2 } })
);
assert.equal(
  baseFingerprint,
  fingerprint({ ...baseLayer, opacity: 99 })
);
assert.notEqual(baseFingerprint, fingerprint({ ...baseLayer, opacity: 0 }));
assert.notEqual(
  baseFingerprint,
  fingerprint({ ...baseLayer, visible: false })
);

const childB = { ...baseLayer, sourceCanvas: canvasB, sourceFingerprint: "child-b" };
const subComp: SelectionSubCompositionAlphaDescriptor = {
  kind: "subComp",
  sourceFingerprint: "group-a",
  sourceRevision: "psd-refresh-1",
  frameVisualKey: "children-evaluated",
  logicalSize: { width: 10, height: 10 },
  opacity: 80,
  visible: true,
  orderedChildren: [
    { source: baseLayer, transform },
    { source: childB, transform: { ...transform, position: { x: 4, y: 4 } } },
  ],
};
const subCompFingerprint = fingerprint(subComp);
assert.equal(subCompFingerprint, fingerprint({ ...subComp, opacity: 1 }));
assert.notEqual(subCompFingerprint, fingerprint({ ...subComp, opacity: 0 }));
assert.notEqual(
  subCompFingerprint,
  fingerprint({
    ...subComp,
    orderedChildren: [...subComp.orderedChildren].reverse(),
  })
);
assert.notEqual(
  subCompFingerprint,
  fingerprint({ ...subComp, sourceRevision: "psd-refresh-2" })
);
assert.notEqual(
  subCompFingerprint,
  fingerprint({ ...subComp, frameVisualKey: "frame-2" })
);
assert.notEqual(
  subCompFingerprint,
  fingerprint({ ...subComp, logicalSize: { width: 11, height: 10 } })
);
assert.notEqual(
  subCompFingerprint,
  fingerprint({
    ...subComp,
    orderedChildren: [
      { source: { ...baseLayer, visible: false }, transform },
      subComp.orderedChildren[1],
    ],
  })
);
assert.notEqual(
  subCompFingerprint,
  fingerprint({
    ...subComp,
    orderedChildren: [
      { ...subComp.orderedChildren[0], transform: { ...transform, rotation: 1 } },
      subComp.orderedChildren[1],
    ],
  })
);
assert.notEqual(
  subCompFingerprint,
  fingerprint({
    ...subComp,
    orderedChildren: [
      { source: { ...baseLayer, opacity: 50 }, transform },
      subComp.orderedChildren[1],
    ],
  })
);

let buildCount = 0;
const events: SelectionSourceAlphaProviderEvent[] = [];
const fakeAdapter: SelectionAlphaBrowserAdapter = {
  build: (descriptor, visualFingerprint) => {
    buildCount += 1;
    const width = Math.ceil(descriptor.logicalSize.width);
    const height = Math.ceil(descriptor.logicalSize.height);
    const alphaBytes = new Uint8Array(width * height).fill(127);
    return {
      status: "ready",
      entry: {
        visualFingerprint,
        width,
        height,
        alphaBytes,
        sample: (x, y) =>
          x >= 0 && y >= 0 && x < width && y < height
            ? alphaBytes[Math.floor(y) * width + Math.floor(x)] ?? 0
            : 0,
      },
    };
  },
};
const provider = createSelectionSourceAlphaProvider({
  adapter: fakeAdapter,
  maxRetainedEntries: 2,
  observe: (event) => events.push(event),
});
const first = provider.get(baseLayer);
const duplicate = provider.get({ ...baseLayer });
assert.equal(first.status, "ready");
assert.equal(duplicate.status, "ready");
if (first.status === "ready" && duplicate.status === "ready") {
  assert.equal(first.entry, duplicate.entry);
  assert.equal(first.entry.sample(0, 0), 127);
  assert.equal(first.entry.sample(-1, 0), 0);
  provider.retain([first.entry.visualFingerprint]);
  provider.release(first.entry.visualFingerprint);
  assert.equal(provider.get(baseLayer).status, "ready");
  assert.equal(buildCount, 1);
  provider.retain([]);
  assert.equal(provider.get(baseLayer).status, "ready");
  assert.equal(buildCount, 2);
  if (provider.get(baseLayer).status === "ready") {
    const transient = provider.get({ ...baseLayer, opacity: 55 });
    assert.equal(transient.status, "ready");
    if (transient.status === "ready") {
      provider.release(transient.entry.visualFingerprint);
      provider.get({ ...baseLayer, opacity: 55 });
      assert.equal(buildCount, 3);
    }
  }
}
assert.ok(events.some((event) => event.type === "reuse"));
assert.ok(events.some((event) => event.type === "release"));

let boundedBuildCount = 0;
const boundedEvents: SelectionSourceAlphaProviderEvent[] = [];
const boundedProvider = createSelectionSourceAlphaProvider({
  maxRetainedEntries: 2,
  adapter: {
    build: (descriptor, visualFingerprint) => {
      boundedBuildCount += 1;
      const width = Math.ceil(descriptor.logicalSize.width);
      const height = Math.ceil(descriptor.logicalSize.height);
      return {
        status: "ready",
        entry: {
          visualFingerprint,
          width,
          height,
          alphaBytes: new Uint8Array(width * height).fill(255),
          sample: () => 255,
        },
      };
    },
  },
  observe: (event) => boundedEvents.push(event),
});
boundedProvider.get({ ...baseLayer, opacity: 100 });
boundedProvider.get({ ...baseLayer, opacity: 90 });
boundedProvider.get({ ...baseLayer, opacity: 80 });
assert.equal(boundedBuildCount, 1);
assert.equal(boundedEvents.filter((event) => event.type === "reuse").length, 2);
boundedProvider.get({ ...baseLayer, opacity: 100 });
assert.equal(boundedBuildCount, 1);
boundedProvider.dispose();

let failureBuildCount = 0;
const failureProvider = createSelectionSourceAlphaProvider({
  adapter: {
    build: (_descriptor, visualFingerprint) => {
      failureBuildCount += 1;
      return {
        status: "unavailable",
        visualFingerprint,
        reason: "readback-blocked",
      };
    },
  },
});
assert.equal(failureProvider.get(baseLayer).status, "unavailable");
assert.equal(failureProvider.get(baseLayer).status, "unavailable");
assert.equal(failureBuildCount, 1);
failureProvider.clear();
failureProvider.get(baseLayer);
assert.equal(failureBuildCount, 2);
failureProvider.dispose();
const disposedResult = failureProvider.get(baseLayer);
assert.equal(disposedResult.status, "unavailable");
if (disposedResult.status === "unavailable") {
  assert.equal(disposedResult.reason, "disposed");
}

const unavailableAdapter = createCanvasSelectionAlphaBrowserAdapter(
  () =>
    ({
      width: 0,
      height: 0,
      getContext: () => null,
    }) as unknown as HTMLCanvasElement
);
const unavailable = unavailableAdapter.build(baseLayer, baseFingerprint);
assert.equal(unavailable.status, "unavailable");
if (unavailable.status === "unavailable") {
  assert.equal(unavailable.reason, "context-unavailable");
}

type FakeAlphaCanvas = HTMLCanvasElement & {
  pixelAlpha: number;
  tainted: boolean;
};

let readbackCount = 0;
function makeFakeAlphaCanvas(pixelAlpha = 0, tainted = false): FakeAlphaCanvas {
  let canvasWidth = 1;
  let canvasHeight = 1;
  const state = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "#000",
  };
  const stack: typeof state[] = [];
  const canvas = {
    pixelAlpha,
    tainted,
    get width() {
      return canvasWidth;
    },
    set width(value: number) {
      canvasWidth = value;
      this.pixelAlpha = 0;
      this.tainted = false;
    },
    get height() {
      return canvasHeight;
    },
    set height(value: number) {
      canvasHeight = value;
      this.pixelAlpha = 0;
      this.tainted = false;
    },
    getContext: () => context,
  } as unknown as FakeAlphaCanvas;
  const context = {
    get globalAlpha() {
      return state.globalAlpha;
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value;
    },
    get globalCompositeOperation() {
      return state.globalCompositeOperation;
    },
    set globalCompositeOperation(value: string) {
      state.globalCompositeOperation = value;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(value: string) {
      state.fillStyle = value;
    },
    save: () => stack.push({ ...state }),
    restore: () => {
      const previous = stack.pop();
      if (previous) Object.assign(state, previous);
    },
    clearRect: () => {
      canvas.pixelAlpha = 0;
      canvas.tainted = false;
    },
    drawImage: (source: FakeAlphaCanvas) => {
      if (source.tainted) canvas.tainted = true;
      const sourceAlpha = (source.pixelAlpha / 255) * state.globalAlpha;
      const destinationAlpha = canvas.pixelAlpha / 255;
      canvas.pixelAlpha = Math.round(
        (sourceAlpha + destinationAlpha * (1 - sourceAlpha)) * 255
      );
    },
    fillRect: () => {
      if (state.globalCompositeOperation === "destination-in") {
        canvas.pixelAlpha = Math.round(canvas.pixelAlpha * state.globalAlpha);
      }
    },
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    getImageData: () => {
      readbackCount += 1;
      if (canvas.tainted) {
        throw new DOMException("tainted", "SecurityError");
      }
      return {
        data: new Uint8ClampedArray([0, 0, 0, canvas.pixelAlpha]),
      };
    },
  } as unknown as CanvasRenderingContext2D;
  return canvas;
}

const rasterAdapter = createCanvasSelectionAlphaBrowserAdapter(() =>
  makeFakeAlphaCanvas()
);
const halfOpacityLayer: SelectionLayerAlphaDescriptor = {
  ...baseLayer,
  sourceCanvas: makeFakeAlphaCanvas(200),
  logicalSize: { width: 1, height: 1 },
  opacity: 50,
};
readbackCount = 0;
const layerRaster = rasterAdapter.build(halfOpacityLayer, "layer-raster");
assert.equal(layerRaster.status, "ready");
if (layerRaster.status === "ready") {
  assert.equal(layerRaster.entry.alphaBytes[0], 200);
  assert.equal(layerRaster.entry.sample(0, 0), 200);
}
assert.equal(readbackCount, 1);

readbackCount = 0;
const rootOpacityProvider = createSelectionSourceAlphaProvider({
  adapter: rasterAdapter,
});
const opaqueRoot = rootOpacityProvider.get({ ...halfOpacityLayer, opacity: 100 });
assert.equal(opaqueRoot.status, "ready");
for (let opacity = 99; opacity >= 1; opacity -= 1) {
  const positiveRoot = rootOpacityProvider.get({ ...halfOpacityLayer, opacity });
  assert.equal(positiveRoot.status, "ready");
  if (opaqueRoot.status === "ready" && positiveRoot.status === "ready") {
    assert.equal(opaqueRoot.entry, positiveRoot.entry);
    assert.equal(positiveRoot.entry.sample(0, 0) > SELECTION_ALPHA_THRESHOLD, true);
  }
}
if (opaqueRoot.status === "ready") {
  assert.equal(opaqueRoot.entry.sample(0, 0) > SELECTION_ALPHA_THRESHOLD, true);
}
assert.equal(readbackCount, 1);
assert.equal(
  rootOpacityProvider.get({ ...halfOpacityLayer, opacity: 0 }).status,
  "unavailable"
);
assert.equal(
  rootOpacityProvider.get({ ...halfOpacityLayer, visible: false }).status,
  "unavailable"
);
assert.equal(readbackCount, 1);
const restoredRoot = rootOpacityProvider.get({ ...halfOpacityLayer, opacity: 1 });
assert.equal(restoredRoot.status, "ready");
if (opaqueRoot.status === "ready" && restoredRoot.status === "ready") {
  assert.equal(restoredRoot.entry, opaqueRoot.entry);
}
assert.equal(readbackCount, 1);

const nestedComposition: SelectionSubCompositionAlphaDescriptor = {
  ...subComp,
  sourceFingerprint: "nested",
  logicalSize: { width: 1, height: 1 },
  opacity: 50,
  orderedChildren: [
    {
      source: {
        ...baseLayer,
        sourceCanvas: makeFakeAlphaCanvas(255),
        logicalSize: { width: 1, height: 1 },
      },
      transform,
    },
  ],
};
const rootComposition: SelectionSubCompositionAlphaDescriptor = {
  ...nestedComposition,
  sourceFingerprint: "root",
  opacity: 100,
  orderedChildren: [{ source: nestedComposition, transform }],
};
readbackCount = 0;
const compositionRaster = rasterAdapter.build(rootComposition, "composition-raster");
assert.equal(compositionRaster.status, "ready");
if (compositionRaster.status === "ready") {
  assert.equal(compositionRaster.entry.alphaBytes[0], 128);
}
assert.equal(readbackCount, 1, "only the final root surface may be read back");

readbackCount = 0;
const rootCompositionProvider = createSelectionSourceAlphaProvider({
  adapter: rasterAdapter,
});
const fullComposition = rootCompositionProvider.get(rootComposition);
const dimComposition = rootCompositionProvider.get({ ...rootComposition, opacity: 1 });
assert.equal(fullComposition.status, "ready");
assert.equal(dimComposition.status, "ready");
if (fullComposition.status === "ready" && dimComposition.status === "ready") {
  assert.equal(fullComposition.entry, dimComposition.entry);
  assert.equal(fullComposition.entry.alphaBytes[0], 128);
}
assert.equal(readbackCount, 1);

readbackCount = 0;
const taintedRaster = rasterAdapter.build(
  { ...halfOpacityLayer, sourceCanvas: makeFakeAlphaCanvas(255, true) },
  "tainted-raster"
);
assert.equal(taintedRaster.status, "unavailable");
if (taintedRaster.status === "unavailable") {
  assert.equal(taintedRaster.reason, "readback-blocked");
}

console.log("Canvas selection alpha verification passed.");
