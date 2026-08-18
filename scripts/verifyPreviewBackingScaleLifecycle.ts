import assert from "node:assert/strict";
import {
  createPreviewSurfaceCacheRuntime,
} from "@/engines/canvas/testing";
import {
  createLayerDocumentSourceRuntimeResourceCache,
  type PreviewRenderSurface,
} from "@/render";

const disposalCounts = new Map<string, number>();
const resource = (
  sourceId: string,
  cacheKey: string,
  identity: string
) => ({
  sourceId,
  sourceResourceCacheKey: cacheKey,
  resolution: {
    renderItemId: `render:${identity}`,
    drawableId: `drawable:${identity}`,
    logicalSize: { width: 100, height: 80 },
  },
  resource: { identity },
  dispose: () => {
    disposalCounts.set(
      identity,
      (disposalCounts.get(identity) ?? 0) + 1
    );
  },
});

const sourceRuntime =
  createLayerDocumentSourceRuntimeResourceCache();

// Import owns one original Source runtime resource.
assert.equal(
  sourceRuntime.register(
    resource("source-a", "cache-a", "import")
  ).ok,
  true
);
assert.ok(sourceRuntime.resolve({
  sourceId: "source-a",
  sourceResourceCacheKey: "cache-a",
}));

// Refresh atomically replaces the suspended original, then disposes it once.
assert.equal(sourceRuntime.suspendSource("source-a"), 1);
assert.equal(
  sourceRuntime.register(
    resource("source-a", "cache-a", "refresh")
  ).ok,
  true
);
assert.equal(
  sourceRuntime.disposeSuspendedSource("source-a"),
  0
);
assert.equal(disposalCounts.get("import"), 1);

// Targeted replacement disposes the current Source resource.
assert.equal(
  sourceRuntime.invalidate({
    kind: "source",
    sourceId: "source-a",
  }),
  1
);
assert.equal(disposalCounts.get("refresh"), 1);

// A cancelled/failed reconnect restores its suspended resource unchanged.
assert.equal(
  sourceRuntime.register(
    resource("source-b", "cache-b", "reconnect-before")
  ).ok,
  true
);
assert.equal(sourceRuntime.suspendSource("source-b"), 1);
assert.equal(sourceRuntime.restoreSource("source-b"), 1);
assert.ok(sourceRuntime.resolve({
  sourceId: "source-b",
  sourceResourceCacheKey: "cache-b",
}));
assert.equal(disposalCounts.get("reconnect-before") ?? 0, 0);

// A successful reconnect replaces the original and releases it once.
assert.equal(sourceRuntime.suspendSource("source-b"), 1);
assert.equal(
  sourceRuntime.register(
    resource("source-b", "cache-b", "reconnect-after")
  ).ok,
  true
);
assert.equal(
  sourceRuntime.disposeSuspendedSource("source-b"),
  0
);
assert.equal(disposalCounts.get("reconnect-before"), 1);
sourceRuntime.dispose();
sourceRuntime.dispose();
assert.equal(disposalCounts.get("reconnect-after"), 1);

let createdSurfaces = 0;
const createSurface = (
  width: number,
  height: number,
  scale: number
): PreviewRenderSurface => {
  createdSurfaces += 1;
  return {
    canvas: {
      width: Math.ceil(width * scale),
      height: Math.ceil(height * scale),
    } as HTMLCanvasElement,
    context: {
      globalAlpha: 1,
      fillStyle: "",
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      clearRect: () => undefined,
      beginPath: () => undefined,
      rect: () => undefined,
      clip: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      translate: () => undefined,
      rotate: () => undefined,
      scale: () => undefined,
      fillRect: () => undefined,
      fillText: () => undefined,
      setTransform: () => undefined,
      drawImage: () => undefined,
    },
  };
};

const surfaces = createPreviewSurfaceCacheRuntime();
const medium = surfaces.acquireSurface({
  logicalWidth: 100,
  logicalHeight: 80,
  previewQuality: "medium",
  previewScale: 0.5,
  createSurface,
});
assert.ok(medium);
assert.deepEqual(
  { width: medium.canvas.width, height: medium.canvas.height },
  { width: 50, height: 40 }
);
surfaces.releaseSurface(medium);

const reusedMedium = surfaces.acquireSurface({
  logicalWidth: 100,
  logicalHeight: 80,
  previewQuality: "medium",
  previewScale: 0.5,
  createSurface,
});
assert.strictEqual(reusedMedium, medium);
surfaces.releaseSurface(reusedMedium);

const high = surfaces.acquireSurface({
  logicalWidth: 100,
  logicalHeight: 80,
  previewQuality: "high",
  previewScale: 0.75,
  createSurface,
});
assert.ok(high);
assert.notStrictEqual(high, medium);
assert.equal(createdSurfaces, 2);
surfaces.releaseSurface(high);
surfaces.dispose();
assert.equal(surfaces.getSnapshot().disposed, true);
assert.equal(surfaces.getSnapshot().poolSize, 0);
assert.equal(medium.canvas.width, 0);
assert.equal(high.canvas.width, 0);

console.log("Preview backing-scale and resource lifecycle verification passed");
