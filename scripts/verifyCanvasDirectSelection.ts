import assert from "node:assert/strict";
import type { Composition, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import type { EvaluatedScene } from "@/engines/playback-render";
import {
  applyCanvasDirectSelectionDraft,
  buildCanvasDirectSelectionCandidates,
  buildCanvasDirectSelectionStaticCandidates,
  buildCanvasDirectSelectionViewportCandidates,
} from "@/engines/canvas/helpers/canvasDirectSelectionCandidateHelpers";
import {
  applyCanvasSelectionMatrix,
  buildCanvasSelectionProjection,
} from "@/engines/canvas/helpers/canvasDirectSelectionGeometryHelpers";
import {
  hitCanvasDirectSelection,
  resolveCanvasDirectSelectionCompositionEntry,
  resolveCanvasDirectSelectionIntent,
  resolveCanvasPreviewCursor,
} from "@/engines/canvas/helpers/canvasDirectSelectionHitHelpers";
import { createSelectionSourceAlphaProvider } from "@/engines/canvas/helpers/selectionSourceAlphaProvider";
import type { DraftTransformSnapshot } from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import type {
  CanvasBlockedSelectionCandidate,
  CanvasReadySelectionCandidate,
} from "@/engines/canvas/models/canvasDirectSelectionModel";
import type {
  SelectionSourceAlphaDescriptor,
  SelectionSourceAlphaProvider,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";

const transform = {
  position: { x: 50, y: 50 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 5, y: 5 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};
const canvas = { width: 10, height: 10 } as HTMLCanvasElement;
const drawable = {
  id: "drawable-a", left: 0, top: 0, visible: true,
  sourceLayerId: "layer-a", canvas,
};
const renderItem: RenderItem = {
  id: "render-a", name: "A", kind: "layer", visible: true,
  sourceId: "layer-a", drawables: [drawable],
};
const timelineItem: TimelineItem = {
  id: "timeline-a", name: "A", kind: "layer", visible: true,
  compId: "comp-a", sourceId: "layer-a", startFrame: 0, durationFrames: 30,
};
const scene: EvaluatedScene = {
  compositionId: "comp-a", globalFrame: 4, size: { width: 100, height: 100 },
  localFrameBySourceId: new Map([["layer-a", 4]]),
  nodes: [{
    type: "drawable", renderItemId: "render-a", drawableId: "drawable-a",
    sourceId: "layer-a", layerId: "layer-a", localFrame: 4, visible: true,
    order: 0, logicalSize: { width: 10, height: 10 }, transform, opacity: 100,
  }],
};
const layer = {
  id: "layer-a", sourceFingerprint: "pixels-a",
} as unknown as Layer;

function buildCandidates(overrides: Partial<Parameters<typeof buildCanvasDirectSelectionCandidates>[0]> = {}) {
  return buildCanvasDirectSelectionCandidates({
    evaluatedScene: scene,
    renderItems: [renderItem],
    timelineItems: [timelineItem],
    layersById: new Map([[layer.id, layer]]),
    compositionsById: new Map(),
    metaByCompId: {},
    viewportScale: 1,
    viewportOffset: { x: 0, y: 0 },
    selectedTimelineItem: null,
    draftTransformSnapshot: null,
    ...overrides,
  });
}

const exact = buildCandidates();
assert.equal(exact.length, 1);
assert.equal(exact[0]?.status, "ready");
assert.equal(exact[0]?.timelineItem?.id, "timeline-a");
assert.equal(exact[0]?.drawable?.id, "drawable-a");
assert.deepEqual(exact[0]?.target, { kind: "layer", id: "layer-a" });
const zeroOpacityCandidates = buildCandidates({
  evaluatedScene: {
    ...scene,
    nodes: scene.nodes.map((node) => ({ ...node, opacity: 0 })),
  },
});
assert.deepEqual(zeroOpacityCandidates, []);
assert.equal(
  buildCandidates({
    evaluatedScene: {
      ...scene,
      nodes: scene.nodes.map((node) => ({ ...node, opacity: 1 })),
    },
  }).length,
  1
);
assert.deepEqual(
  buildCandidates({
    evaluatedScene: {
      ...scene,
      nodes: scene.nodes.map((node) => ({ ...node, visible: false })),
    },
  }),
  []
);

const duplicate = { ...timelineItem, id: "timeline-duplicate" };
const ambiguous = buildCandidates({ timelineItems: [timelineItem, duplicate] });
assert.equal(ambiguous[0]?.status, "blocked");
const duplicateRender = { ...renderItem, id: "render-duplicate" };
assert.equal(
  buildCandidates({ renderItems: [renderItem, duplicateRender] })[0]?.status,
  "blocked"
);
assert.equal(
  buildCandidates({ renderItems: [duplicateRender] })[0]?.status,
  "blocked"
);
const splitScene: EvaluatedScene = {
  ...scene,
  nodes: [scene.nodes[0], { ...scene.nodes[0], drawableId: "drawable-split" }],
};
const splitCandidates = buildCandidates({ evaluatedScene: splitScene });
assert.deepEqual(splitCandidates.map((candidate) => candidate.status), [
  "blocked",
  "blocked",
]);
const degenerateSplitScene: EvaluatedScene = {
  ...scene,
  nodes: [
    scene.nodes[0],
    {
      ...scene.nodes[0],
      drawableId: "drawable-degenerate",
      transform: { ...scene.nodes[0].transform, scale: { x: 0, y: 100 } },
    },
  ],
};
assert.equal(
  buildCandidates({ evaluatedScene: degenerateSplitScene })[0]?.status,
  "ready"
);
assert.equal(buildCandidates({ timelineItems: [{ ...timelineItem, startFrame: 10 }] }).length, 0);

const drafted = buildCandidates({
  selectedTimelineItem: timelineItem,
  draftTransformSnapshot: {
    target: { kind: "layer", id: "layer-a" }, localFrame: 4,
    position: { x: 70, y: 50 }, transformOffset: { x: 0, y: 0 },
    anchor: { x: 5, y: 5 }, scale: { x: 100, y: 100 }, rotation: 0,
    opacity: 100,
  } as DraftTransformSnapshot,
});
assert.equal(drafted[0]?.projection.viewportBounds.left, 65);
assert.equal(exact[0]?.projection.viewportBounds.left, 45);
if (exact[0]?.status === "ready" && drafted[0]?.status === "ready") {
  assert.deepEqual(drafted[0].descriptor, exact[0].descriptor);
}

const spatialDraftBase = {
  target: { kind: "layer" as const, id: "layer-a" },
  localFrame: 4,
  position: { x: 50, y: 50 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 5, y: 5 },
  scale: { x: 120, y: 80 },
  rotation: 20,
  opacity: 100,
} as DraftTransformSnapshot;
const spatialDraftCandidate = buildCandidates({
  selectedTimelineItem: timelineItem,
  draftTransformSnapshot: spatialDraftBase,
})[0] as CanvasReadySelectionCandidate;
[
  { ...spatialDraftBase, position: { x: 51, y: 50 } },
  { ...spatialDraftBase, scale: { x: 121, y: 80 } },
  { ...spatialDraftBase, rotation: 21 },
  { ...spatialDraftBase, anchor: { x: 6, y: 5 } },
  { ...spatialDraftBase, transformOffset: { x: 1, y: 0 } },
].forEach((snapshot) => {
  const changed = buildCandidates({
    selectedTimelineItem: timelineItem,
    draftTransformSnapshot: snapshot as DraftTransformSnapshot,
  })[0] as CanvasReadySelectionCandidate;
  assert.notDeepEqual(
    changed.projection.sourceToViewport,
    spatialDraftCandidate.projection.sourceToViewport
  );
  assert.deepEqual(changed.descriptor, spatialDraftCandidate.descriptor);
});

const secondCanvas = { width: 10, height: 10 } as HTMLCanvasElement;
const secondDrawable = {
  ...drawable,
  id: "drawable-b",
  sourceLayerId: "layer-b",
  canvas: secondCanvas,
};
const secondRenderItem: RenderItem = {
  ...renderItem,
  id: "render-b",
  sourceId: "layer-b",
  drawables: [secondDrawable],
};
const secondTimelineItem: TimelineItem = {
  ...timelineItem,
  id: "timeline-b",
  sourceId: "layer-b",
};
const secondLayer = {
  id: "layer-b",
  sourceFingerprint: "pixels-b",
} as unknown as Layer;
const multiScene: EvaluatedScene = {
  ...scene,
  nodes: [
    scene.nodes[0],
    {
      ...scene.nodes[0],
      renderItemId: "render-b",
      drawableId: "drawable-b",
      sourceId: "layer-b",
      layerId: "layer-b",
      order: 1,
    },
  ],
};
let staticJoinBuilds = 0;
staticJoinBuilds += 1;
const staticDraftCandidates = buildCanvasDirectSelectionStaticCandidates({
  evaluatedScene: multiScene,
  renderItems: [renderItem, secondRenderItem],
  timelineItems: [timelineItem, secondTimelineItem],
  layersById: new Map([[layer.id, layer], [secondLayer.id, secondLayer]]),
  compositionsById: new Map(),
});
const viewportDraftCandidates = buildCanvasDirectSelectionViewportCandidates({
  staticCandidates: staticDraftCandidates,
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
});
const selectedBaseCandidate = viewportDraftCandidates[0];
const unselectedBaseCandidate = viewportDraftCandidates[1];
assert.ok(selectedBaseCandidate);
assert.ok(unselectedBaseCandidate);
const selectedProjectionReferences = new Set();
const selectedDescriptorReferences = new Set();
let unselectedCandidateRebuilds = 0;
for (let index = 1; index <= 100; index += 1) {
  const projected = applyCanvasDirectSelectionDraft({
    staticCandidates: staticDraftCandidates,
    viewportCandidates: viewportDraftCandidates,
    viewportScale: 1,
    viewportOffset: { x: 0, y: 0 },
    selectedTimelineItem: timelineItem,
    draftTransformSnapshot: {
      ...spatialDraftBase,
      position: { x: 50 + index, y: 50 },
    },
  });
  const selectedCandidate = projected.find(
    (candidate) => candidate.sourceId === "layer-a"
  );
  const unselectedCandidate = projected.find(
    (candidate) => candidate.sourceId === "layer-b"
  );
  assert.ok(selectedCandidate);
  assert.ok(unselectedCandidate);
  const projectedCenter = applyCanvasSelectionMatrix(
    selectedCandidate.projection.sourceToViewport,
    { x: 5, y: 5 }
  );
  assert.ok(Math.abs(projectedCenter.x - (50 + index)) < 1e-9);
  assert.ok(Math.abs(projectedCenter.y - 50) < 1e-9);
  selectedProjectionReferences.add(selectedCandidate.projection);
  if (unselectedCandidate !== unselectedBaseCandidate) {
    unselectedCandidateRebuilds += 1;
  }
  if (selectedCandidate.status === "ready" && selectedBaseCandidate.status === "ready") {
    assert.equal(selectedCandidate.descriptor, selectedBaseCandidate.descriptor);
    selectedDescriptorReferences.add(selectedCandidate.descriptor);
  }
}
assert.equal(staticJoinBuilds, 1);
assert.equal(selectedProjectionReferences.size, 100);
assert.equal(selectedDescriptorReferences.size, 1);
assert.equal(unselectedCandidateRebuilds, 0);

const zeroOpacityDraftCandidates = applyCanvasDirectSelectionDraft({
  staticCandidates: staticDraftCandidates,
  viewportCandidates: viewportDraftCandidates,
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
  selectedTimelineItem: timelineItem,
  draftTransformSnapshot: { ...spatialDraftBase, opacity: 0 },
});
assert.deepEqual(
  zeroOpacityDraftCandidates.map((candidate) => candidate.sourceId),
  ["layer-b"]
);
const restoredOpacityDraftCandidates = applyCanvasDirectSelectionDraft({
  staticCandidates: staticDraftCandidates,
  viewportCandidates: viewportDraftCandidates,
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
  selectedTimelineItem: timelineItem,
  draftTransformSnapshot: { ...spatialDraftBase, opacity: 1 },
});
const restoredOpacityCandidate = restoredOpacityDraftCandidates.find(
  (candidate) => candidate.sourceId === "layer-a"
);
assert.equal(restoredOpacityCandidate?.status, "ready");
if (restoredOpacityCandidate?.status === "ready") {
  assert.equal(restoredOpacityCandidate.descriptor.opacity, 1);
}
assert.equal(
  restoredOpacityDraftCandidates.find((candidate) => candidate.sourceId === "layer-b"),
  unselectedBaseCandidate
);

const nextLocalFrameScene: EvaluatedScene = {
  ...scene,
  nodes: scene.nodes.map((node) => ({ ...node, localFrame: 5 })),
};
const nextLocalFrame = buildCandidates({ evaluatedScene: nextLocalFrameScene });
assert.equal(nextLocalFrame[0]?.status, "ready");
if (exact[0]?.status === "ready" && nextLocalFrame[0]?.status === "ready") {
  assert.equal(exact[0].descriptor.frameVisualKey, "static-psd");
  assert.deepEqual(nextLocalFrame[0].descriptor, exact[0].descriptor);
}

let staticVisualBuildCount = 0;
const staticVisualProvider = createSelectionSourceAlphaProvider({
  adapter: {
    build: (source, visualFingerprint) => {
      staticVisualBuildCount += 1;
      const width = Math.ceil(source.logicalSize.width);
      const height = Math.ceil(source.logicalSize.height);
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
});
if (exact[0]?.status === "ready" && nextLocalFrame[0]?.status === "ready") {
  staticVisualProvider.get(exact[0].descriptor);
  staticVisualProvider.get(nextLocalFrame[0].descriptor);
  assert.equal(staticVisualBuildCount, 1);
}

const subCompRender: RenderItem = {
  id: "render-sub", name: "Group", kind: "subComp", visible: true,
  sourceId: "group-a", targetCompId: "group-a", drawables: [drawable],
};
const subCompTimeline: TimelineItem = {
  id: "timeline-sub", name: "Group", kind: "subComp", visible: true,
  compId: "comp-a", sourceId: "group-a", targetCompId: "group-a",
  startFrame: 0, durationFrames: 30,
};
const subCompNode = {
  type: "composition" as const,
  renderItemId: "render-sub", sourceId: "group-a", targetCompId: "group-a",
  localFrame: 4, visible: true as const, order: 0,
  size: { width: 20, height: 20 }, transform, opacity: 100,
  children: scene.nodes,
};
function buildSubCompAtLocalFrame(localFrame: number) {
  return buildCanvasDirectSelectionCandidates({
    evaluatedScene: { ...scene, nodes: [{ ...subCompNode, localFrame }] },
    renderItems: [subCompRender],
    timelineItems: [subCompTimeline],
    layersById: new Map([[layer.id, layer]]),
    compositionsById: new Map([[
      "group-a",
      { id: "group-a", sourceFingerprint: "group-pixels-a" } as unknown as Composition,
    ]]),
    metaByCompId: {},
    viewportScale: 1,
    viewportOffset: { x: 0, y: 0 },
    selectedTimelineItem: null,
    draftTransformSnapshot: null,
  });
}
const subCompFrame4 = buildSubCompAtLocalFrame(4);
const subCompFrame5 = buildSubCompAtLocalFrame(5);
if (subCompFrame4[0]?.status === "ready" && subCompFrame5[0]?.status === "ready") {
  assert.equal(subCompFrame4[0].descriptor.frameVisualKey, "static-psd");
  staticVisualProvider.get(subCompFrame4[0].descriptor);
  staticVisualProvider.get(subCompFrame5[0].descriptor);
  assert.equal(staticVisualBuildCount, 2);
}

const negativeProjection = buildCanvasSelectionProjection({
  size: { width: 10, height: 10 },
  transform: { ...transform, position: { x: 5, y: 5 }, scale: { x: -100, y: 100 } },
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
});
assert.ok(negativeProjection);
assert.deepEqual(
  applyCanvasSelectionMatrix(negativeProjection.viewportToSource, { x: 8, y: 3 }),
  { x: 2, y: 3 }
);

const projection = buildCanvasSelectionProjection({
  size: { width: 10, height: 10 }, transform,
  viewportScale: 1, viewportOffset: { x: 0, y: 0 },
});
assert.ok(projection);
const descriptor = (exact[0] as CanvasReadySelectionCandidate).descriptor;
function ready(id: string, sourceFingerprint: string): CanvasReadySelectionCandidate {
  return {
    ...(exact[0] as CanvasReadySelectionCandidate),
    renderItemId: id,
    sourceId: id,
    selection: { itemId: id, sourceId: id, kind: "layer" },
    descriptor: { ...descriptor, sourceFingerprint, sourceRevision: sourceFingerprint },
    projection,
  };
}

function fakeProvider(alphaBySource: Record<string, number | "unavailable">) {
  const calls: string[] = [];
  const provider: SelectionSourceAlphaProvider = {
    get: (source: SelectionSourceAlphaDescriptor) => {
      const key = source.sourceFingerprint ?? "none";
      calls.push(`get:${key}`);
      const alpha = alphaBySource[key] ?? 0;
      if (alpha === "unavailable") {
        return { status: "unavailable", visualFingerprint: key, reason: "readback-blocked" };
      }
      return {
        status: "ready",
        entry: {
          visualFingerprint: key, width: 10, height: 10,
          alphaBytes: new Uint8Array(100), sample: () => alpha,
        },
      };
    },
    retain: (keys) => calls.push(`retain:${keys.join(",")}`),
    release: (key) => calls.push(`release:${key}`),
    clear: () => calls.push("clear"),
    dispose: () => calls.push("dispose"),
  };
  return { provider, calls };
}

const zeroOpacityHitProvider = fakeProvider({});
const zeroOpacityHit = hitCanvasDirectSelection({
  point: { x: 50, y: 50 },
  candidates: zeroOpacityCandidates,
  provider: zeroOpacityHitProvider.provider,
  compositionSize: scene.size,
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
});
assert.equal(zeroOpacityHit.status, "none");
assert.deepEqual(zeroOpacityHitProvider.calls, ["retain:"]);

const bottom = ready("bottom", "bottom");
const top = ready("top", "top");
let fake = fakeProvider({ bottom: 255, top: 255 });
let hit = hitCanvasDirectSelection({
  point: { x: 50, y: 50 }, candidates: [bottom, top], provider: fake.provider,
  compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
});
assert.equal(hit.status === "hit" ? hit.candidate.renderItemId : null, "top");
assert.deepEqual(fake.calls, ["get:top", "retain:top"]);

fake = fakeProvider({ bottom: 255, top: 0 });
hit = hitCanvasDirectSelection({
  point: { x: 50, y: 50 }, candidates: [bottom, top], provider: fake.provider,
  compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
});
assert.equal(hit.status === "hit" ? hit.candidate.renderItemId : null, "bottom");
assert.deepEqual(fake.calls, ["get:top", "release:top", "get:bottom", "retain:bottom"]);

const blocked: CanvasBlockedSelectionCandidate = {
  ...top, status: "blocked", reason: "ambiguous-identity",
};
fake = fakeProvider({ bottom: 255 });
hit = hitCanvasDirectSelection({
  point: { x: 50, y: 50 }, candidates: [bottom, blocked], provider: fake.provider,
  compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
});
assert.equal(hit.status, "blocked");
assert.deepEqual(fake.calls, []);

fake = fakeProvider({ top: "unavailable", bottom: 255 });
hit = hitCanvasDirectSelection({
  point: { x: 50, y: 50 }, candidates: [bottom, top], provider: fake.provider,
  compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
});
assert.equal(hit.status, "blocked");
assert.deepEqual(fake.calls, ["get:top"]);

fake = fakeProvider({ top: 255 });
hitCanvasDirectSelection({
  point: { x: 105, y: 50 }, candidates: [top], provider: fake.provider,
  compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
});
assert.deepEqual(fake.calls, ["retain:"]);

fake = fakeProvider({ top: 255 });
hit = hitCanvasDirectSelection({
  point: { x: 50, y: 50 }, candidates: [top], provider: fake.provider,
  compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
  cacheMode: "hover",
});
assert.equal(hit.status, "hit");
assert.deepEqual(fake.calls, ["get:top"]);

fake = fakeProvider({ top: 0, bottom: 255 });
hit = hitCanvasDirectSelection({
  point: { x: 50, y: 50 }, candidates: [bottom, top], provider: fake.provider,
  compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
  cacheMode: "hover",
});
assert.equal(hit.status === "hit" ? hit.candidate.renderItemId : null, "bottom");
assert.deepEqual(fake.calls, ["get:top", "release:top", "get:bottom"]);

fake = fakeProvider({ top: 255 });
hitCanvasDirectSelection({
  point: { x: 105, y: 50 }, candidates: [top], provider: fake.provider,
  compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
  cacheMode: "hover",
});
assert.deepEqual(fake.calls, []);

const cacheEvents: string[] = [];
const boundedHoverProvider = createSelectionSourceAlphaProvider({
  maxRetainedEntries: 2,
  observe: (event) => cacheEvents.push(`${event.type}:${event.visualFingerprint}`),
  adapter: {
    build: (_source, visualFingerprint) => ({
      status: "ready",
      entry: {
        visualFingerprint, width: 10, height: 10,
        alphaBytes: new Uint8Array(100), sample: () => 255,
      },
    }),
  },
});
const selectedResult = boundedHoverProvider.get(top.descriptor);
assert.equal(selectedResult.status, "ready");
if (selectedResult.status === "ready") {
  boundedHoverProvider.retain([selectedResult.entry.visualFingerprint]);
}
for (const candidate of [ready("hover-a", "hover-a"), ready("hover-b", "hover-b")]) {
  hitCanvasDirectSelection({
    point: { x: 50, y: 50 }, candidates: [candidate], provider: boundedHoverProvider,
    compositionSize: scene.size, viewportScale: 1, viewportOffset: { x: 0, y: 0 },
    cacheMode: "hover",
  });
}
boundedHoverProvider.get(top.descriptor);
assert.equal(cacheEvents.filter((event) => event.startsWith("build:")).length, 3);
assert.equal(cacheEvents.filter((event) => event.startsWith("release:")).length, 1);
assert.equal(cacheEvents.at(-1)?.startsWith("reuse:"), true);

assert.equal(resolveCanvasPreviewCursor({
  isPreviewPanning: false, isPreviewPanModifierActive: false,
  isDraggingPosition: false, isAlphaHit: true,
}), "pointer");
assert.equal(resolveCanvasPreviewCursor({
  isPreviewPanning: false, isPreviewPanModifierActive: false,
  isDraggingPosition: false, isAlphaHit: false,
}), "default");
assert.equal(resolveCanvasPreviewCursor({
  isPreviewPanning: false, isPreviewPanModifierActive: false,
  isDraggingPosition: true, isAlphaHit: true,
}), "grabbing");
assert.equal(resolveCanvasPreviewCursor({
  isPreviewPanning: true, isPreviewPanModifierActive: true,
  isDraggingPosition: true, isAlphaHit: true,
}), "grabbing");
assert.equal(resolveCanvasPreviewCursor({
  isPreviewPanning: false, isPreviewPanModifierActive: true,
  isDraggingPosition: true, isAlphaHit: true,
}), "grab");

assert.deepEqual(resolveCanvasDirectSelectionIntent(
  { status: "hit", candidate: top }, { ...timelineItem, id: "top", sourceId: "top" }
), { type: "drag" });
assert.equal(resolveCanvasDirectSelectionIntent(
  { status: "hit", candidate: top }, timelineItem
).type, "select");
assert.deepEqual(resolveCanvasDirectSelectionIntent({ status: "none" }, timelineItem), { type: "clear" });
assert.deepEqual(resolveCanvasDirectSelectionIntent(
  { status: "blocked", candidate: blocked }, timelineItem
), { type: "preserve" });

const readySubComp = subCompFrame4[0] as CanvasReadySelectionCandidate;
assert.equal(resolveCanvasDirectSelectionCompositionEntry({
  status: "hit", candidate: readySubComp,
}), "group-a");
assert.equal(resolveCanvasDirectSelectionCompositionEntry({
  status: "hit", candidate: top,
}), null);
assert.equal(resolveCanvasDirectSelectionCompositionEntry({ status: "none" }), null);
assert.equal(resolveCanvasDirectSelectionCompositionEntry({
  status: "blocked", candidate: blocked,
}), null);

console.log("Canvas direct selection verification passed");
