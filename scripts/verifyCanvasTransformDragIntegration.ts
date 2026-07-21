import assert from "node:assert/strict";
import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import { createProjectSelectionModelDeriver } from "@/engines/project/useProjectSelectionModel";
import {
  buildEvaluatedScene,
  buildPreviewSceneFromEvaluatedScene,
  createReusableRenderSurfaceFactory,
  renderAccurateRenderer,
  renderFastPreviewRenderer,
  renderFrameToCanvas,
  renderPreviewSceneToCanvas,
  updatePreviewSceneNodeTransform,
  type PreviewSceneTransformPatch,
  type PreviewSceneUpdateTarget,
} from "@/engines/playback-render";
import { createRuntimeMetricsResource } from "@/engines/canvas/state/runtimeMetricsStore";
import { createCanvasPointerFrameScheduler } from "@/engines/canvas/helpers/canvasPointerFrameHelpers";
import { createPreviewDraftBaseSceneResolver } from "@/engines/canvas/helpers/previewDraftBaseSceneHelpers";
import { applyPreviewNodeCacheFromScenes } from "@/engines/canvas/helpers/nodeCacheHelpers";
import {
  applyCanvasDirectSelectionDraft,
  buildCanvasDirectSelectionStaticCandidates,
  buildCanvasDirectSelectionViewportCandidates,
} from "@/engines/canvas/helpers/canvasDirectSelectionCandidateHelpers";
import {
  buildCompositionMotionPathGeometry,
  buildLayerMotionPathGeometry,
  markCanvasMotionPathCurrentFrame,
} from "@/engines/canvas/helpers/canvasMotionPathHelpers";
import { createSelectionSourceAlphaProvider } from "@/engines/canvas/helpers/selectionSourceAlphaProvider";
import { createCanvasSelectionGlowRenderer } from "@/engines/canvas/adapters/canvasSelectionGlowBrowserAdapter";
import type { SelectionSourceAlphaDescriptor } from "@/engines/canvas/models/canvasSelectionAlphaModel";
import { resolvePreviewCompositionCacheForRender } from "@/engines/canvas/controllers/useCanvasRenderController";
import type { CompositionPreviewCacheRuntime } from "@/engines/canvas/models/compositionCacheModel";
import {
  buildCompositionSelectionOverlay,
  buildLayerSelectionOverlay,
} from "@/engines/canvas/helpers/canvasSelectionHelpers";
import { resolveDraftTransformSnapshot } from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import { buildCanvasMotionPathProjectionViewModel } from "@/engines/canvas/helpers/canvasGizmoHelpers";

const disabledProperties = {
  position: false,
  scale: false,
  rotation: false,
  opacity: false,
};
const meta: CompositionMeta = {
  width: 40,
  height: 30,
  layerCount: 1,
  sourceFileName: "drag-integration.psd",
  frameRate: 30,
  durationFrames: 30,
};

function makeLayer(): Layer {
  return {
    id: "layer-a",
    name: "Layer A",
    visible: true,
    sourceIdentity: {
      sourceFileName: "drag-integration.psd",
      sourceKey: "layer-id:layer-a",
    },
    sourceFingerprint: "layer-a:v1",
    position: { x: 10, y: 10 },
    positionKeyframes: [],
    transformOffset: { x: 0, y: 0 },
    anchor: { x: 2, y: 2 },
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: false,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
    modifiers: [],
  };
}

function makeScene(layer: Layer): Composition {
  return {
    id: "scene-a",
    name: "Scene A",
    type: "main",
    layers: [layer],
    children: [],
    sourceFingerprint: "scene-a:v1",
    position: { x: 20, y: 15 },
    positionKeyframes: [],
    transformOffset: { x: 0, y: 0 },
    anchor: { x: 20, y: 15 },
    scale: { x: 100, y: 100 },
    scaleKeyframes: [],
    scaleLinked: false,
    rotation: 0,
    rotationKeyframes: [],
    opacity: 100,
    opacityKeyframes: [],
    enabledProperties: { ...disabledProperties },
    modifiers: [],
  };
}

function makeCanvas() {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  const context = {
    clearRect: () => undefined,
    createImageData: (width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
    putImageData: () => undefined,
    setTransform: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    drawImage: () => undefined,
    filter: "none",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    getImageData: () => ({ data }),
  };
  return {
    width: 4,
    height: 4,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
}

const layer = makeLayer();
const scene = makeScene(layer);
const sourceCanvas = makeCanvas();
const layerRenderItem: RenderItem = {
  id: "render-layer-a",
  name: "Layer A",
  kind: "layer",
  visible: true,
  sourceId: layer.id,
  drawables: [{
    id: "drawable-layer-a",
    left: 0,
    top: 0,
    visible: true,
    sourceLayerId: layer.id,
    canvas: sourceCanvas,
  }],
};
const layerTimelineItem: TimelineItem = {
  id: "timeline-layer-a",
  name: "Layer A",
  kind: "layer",
  visible: true,
  compId: scene.id,
  sourceId: layer.id,
  startFrame: 0,
  durationFrames: 30,
};
const subCompRenderItem: RenderItem = {
  ...layerRenderItem,
  id: "render-scene-a",
  name: "Scene A",
  kind: "subComp",
  sourceId: scene.id,
  targetCompId: scene.id,
};

type HandleName =
  | "Position"
  | "Anchor"
  | "Scale W"
  | "Scale H"
  | "Scale WH"
  | "Rotation"
  | "Opacity";
type TargetKind = "Layer" | "SubComp";
type FixturePhase = "before" | "after";
type Counts = {
  raw: number;
  scheduled: number;
  accepted: number;
  selection: number;
  animation: number;
  full: number;
  fast: number;
  draftSeed: number;
  previewUpdate: number;
  dirty: number;
  reused: number;
  motionBuild: number;
  motionSamples: number;
  candidateStaticBuild: number;
  candidateViewportBuild: number;
  candidateDraftUpdate: number;
  projections: number;
  alphaBuild: number;
  alphaReuse: number;
  glowBuild: number;
  glowReuse: number;
  glowDraw: number;
  compositionCacheLookup: number;
  compositionCacheStore: number;
  surfaceCreate: number;
  surfaceReuse: number;
  project: number;
  history: number;
};

function createMemoizedFixtureValue<Value>() {
  let previousDependencies: readonly unknown[] | null = null;
  let previousValue: Value;
  return (dependencies: readonly unknown[], build: () => Value): Value => {
    const unchanged = previousDependencies?.length === dependencies.length
      && dependencies.every((dependency, index) =>
        Object.is(dependency, previousDependencies?.[index])
      );
    if (unchanged) return previousValue;
    previousDependencies = dependencies;
    previousValue = build();
    return previousValue;
  };
}

function patchFor(handle: HandleName, index: number): PreviewSceneTransformPatch {
  switch (handle) {
    case "Position": return { position: { x: 10 + index, y: 10 + index } };
    case "Anchor": return {
      anchor: { x: 2 + index / 10, y: 2 + index / 10 },
      transformOffset: { x: index / 10, y: index / 10 },
    };
    case "Scale W": return { scale: { x: 100 + index, y: 100 } };
    case "Scale H": return { scale: { x: 100, y: 100 + index } };
    case "Scale WH": return { scale: { x: 100 + index, y: 100 + index } };
    case "Rotation": return { rotation: index };
    case "Opacity": return { opacity: 100 - index };
  }
}

function measureMotionPathMemoBoundary(handle: HandleName) {
  const stableRenderItems = [layerRenderItem];
  const stableTimelineItems = [layerTimelineItem];
  const overlay = buildLayerSelectionOverlay(
    layer,
    stableRenderItems,
    stableTimelineItems,
    0,
    meta.frameRate
  );
  assert.ok(overlay);
  let fullBuilds = 0;
  const deriveGeometry = createMemoizedFixtureValue<
    ReturnType<typeof buildLayerMotionPathGeometry>
  >();
  const readGeometry = (snapshot: ReturnType<typeof resolveDraftTransformSnapshot>) =>
    deriveGeometry(
      [
        layer,
        stableRenderItems,
        stableTimelineItems,
        meta.durationFrames,
        meta.frameRate,
        snapshot,
      ],
      () => {
        fullBuilds += 1;
        return buildLayerMotionPathGeometry(
          layer,
          stableRenderItems,
          stableTimelineItems,
          meta.durationFrames,
          meta.frameRate,
          snapshot
        );
      }
    );
  const baseline = readGeometry(null);
  for (let index = 1; index <= 100; index += 1) {
    const snapshot = resolveDraftTransformSnapshot({
      target: { kind: "layer", layer },
      localFrame: 0,
      selectedMeta: meta,
      overlay,
      patch: patchFor(handle, index),
    });
    assert.ok(snapshot);
    const changed = snapshot.draft.changed;
    const motionPathSnapshot =
      changed.position || changed.anchor || changed.transformOffset
        ? snapshot
        : null;
    const geometry = readGeometry(motionPathSnapshot);
    assert.equal(geometry.length, baseline.length);
  }
  return { fullBuilds, additionalBuilds: fullBuilds - 1 };
}

const motionPathMemoMeasurements = Object.fromEntries(
  ([
    "Position",
    "Anchor",
    "Scale W",
    "Scale H",
    "Scale WH",
    "Rotation",
    "Opacity",
  ] as const).map((handle) => [handle, measureMotionPathMemoBoundary(handle)])
);
assert.deepEqual(motionPathMemoMeasurements, {
  Position: { fullBuilds: 101, additionalBuilds: 100 },
  Anchor: { fullBuilds: 101, additionalBuilds: 100 },
  "Scale W": { fullBuilds: 1, additionalBuilds: 0 },
  "Scale H": { fullBuilds: 1, additionalBuilds: 0 },
  "Scale WH": { fullBuilds: 1, additionalBuilds: 0 },
  Rotation: { fullBuilds: 1, additionalBuilds: 0 },
  Opacity: { fullBuilds: 1, additionalBuilds: 0 },
});

let viewportMotionFullBuilds = 0;
let viewportMotionProjectionBuilds = 0;
const deriveViewportMotionGeometry = createMemoizedFixtureValue<
  ReturnType<typeof buildLayerMotionPathGeometry>
>();
const viewportMotionPolylines = new Set<string>();
for (let index = 0; index <= 100; index += 1) {
  const geometry = deriveViewportMotionGeometry(
    [layer, layerRenderItem, layerTimelineItem, meta],
    () => {
      viewportMotionFullBuilds += 1;
      return buildLayerMotionPathGeometry(
        layer,
        [layerRenderItem],
        [layerTimelineItem],
        meta.durationFrames,
        meta.frameRate
      );
    }
  );
  viewportMotionProjectionBuilds += 1;
  const projection = buildCanvasMotionPathProjectionViewModel({
    viewportScale: 1,
    viewportOffset: { x: index, y: -index },
    previewSize: { width: meta.width, height: meta.height },
    selectedMeta: meta,
    motionPath: markCanvasMotionPathCurrentFrame(geometry, 0),
  });
  assert.equal(projection.previewMotionPath.length, geometry.length);
  assert.equal(
    projection.motionPathPolyline,
    projection.previewMotionPath
      .map(({ point }) => `${point.x},${point.y}`)
      .join(" ")
  );
  viewportMotionPolylines.add(projection.motionPathPolyline);
}
assert.deepEqual(
  {
    fullBuilds: viewportMotionFullBuilds,
    projectionBuilds: viewportMotionProjectionBuilds,
    distinctPolylines: viewportMotionPolylines.size,
  },
  { fullBuilds: 1, projectionBuilds: 101, distinctPolylines: 101 }
);

function runDrag(
  handle: HandleName,
  targetKind: TargetKind,
  phase: FixturePhase
): Counts {
  const counts: Counts = {
    raw: 0, scheduled: 0, accepted: 0, selection: 0, animation: 0,
    full: 0, fast: 0, draftSeed: 0, previewUpdate: 0, dirty: 0,
    reused: 0, motionBuild: 0, motionSamples: 0, candidateStaticBuild: 0,
    candidateViewportBuild: 0, candidateDraftUpdate: 0,
    projections: 0, alphaBuild: 0, alphaReuse: 0, glowBuild: 0,
    glowReuse: 0, glowDraw: 0, project: 0, history: 0,
    compositionCacheLookup: 0, compositionCacheStore: 0,
    surfaceCreate: 0, surfaceReuse: 0,
  };
  const metrics = createRuntimeMetricsResource();
  const selectionModelDeriver = createProjectSelectionModelDeriver();
  const deriveEvaluatedScene = createMemoizedFixtureValue<
    ReturnType<typeof buildEvaluatedScene>
  >();
  const deriveAccurateRenderer = createMemoizedFixtureValue<
    ReturnType<typeof renderAccurateRenderer>
  >();
  const deriveFastRenderer = createMemoizedFixtureValue<
    ReturnType<typeof renderFastPreviewRenderer>
  >();
  const deriveDraftResolver = createMemoizedFixtureValue<
    ReturnType<typeof createPreviewDraftBaseSceneResolver>
  >();
  const deriveMotionPath = createMemoizedFixtureValue<
    ReturnType<typeof buildLayerMotionPathGeometry>
  >();
  const deriveStaticCandidates = createMemoizedFixtureValue<
    ReturnType<typeof buildCanvasDirectSelectionStaticCandidates>
  >();
  const deriveViewportCandidates = createMemoizedFixtureValue<
    ReturnType<typeof buildCanvasDirectSelectionViewportCandidates>
  >();
  const metaByCompId = { [scene.id]: meta };
  const layerRenderItems = [layerRenderItem];
  const subCompRenderItems = [subCompRenderItem];
  const layerTimelineItems = [layerTimelineItem];
  const selectionOptions = {
    masterCompId: "master",
    masterWidth: 40,
    masterHeight: 30,
    defaultFrameRate: 30,
    comps: [scene],
    masterEnabledProperties: { ...disabledProperties },
    masterAnchor: { x: 20, y: 15 },
    masterScale: { x: 100, y: 100 },
    masterScaleKeyframes: [],
    masterScaleLinked: true,
    masterRotation: 0,
    masterRotationKeyframes: [],
    masterOpacity: 100,
    masterOpacityKeyframes: [],
    selectedCompId: targetKind === "Layer" ? scene.id : "master",
    selectedLayerId: targetKind === "Layer" ? layer.id : null,
    selectedTimelineTarget: targetKind === "Layer"
      ? { itemId: layerTimelineItem.id, sourceId: layer.id, kind: "layer" as const }
      : {
          itemId: "master-timeline-scene-a",
          sourceId: scene.id,
          kind: "subComp" as const,
        },
    metaByCompId,
    timelineItemsByCompId: {
      master: [],
      [scene.id]: layerTimelineItems,
    },
  };
  const viewportOffset = { x: 0, y: 0 };
  let currentDraftBase: ReturnType<typeof createPreviewDraftBaseSceneResolver> | null = null;
  let currentDraftScene: ReturnType<typeof buildPreviewSceneFromEvaluatedScene> | null = null;
  const alphaProvider = createSelectionSourceAlphaProvider({
    maxRetainedEntries: 2,
    adapter: {
      build: (descriptor, visualFingerprint) => {
        const width = Math.ceil(descriptor.logicalSize.width);
        const height = Math.ceil(descriptor.logicalSize.height);
        const alphaBytes = new Uint8Array(width * height).fill(255);
        return {
          status: "ready" as const,
          entry: { visualFingerprint, width, height, alphaBytes, sample: () => 255 },
        };
      },
    },
    observe: (event) => {
      if (event.type === "build") counts.alphaBuild += 1;
      if (event.type === "reuse") counts.alphaReuse += 1;
    },
  });
  const glowRenderer = createCanvasSelectionGlowRenderer({
    createCanvas: makeCanvas,
    observe: (event) => {
      if (event.type === "scratch-build") counts.glowBuild += 1;
      if (event.type === "scratch-reuse") counts.glowReuse += 1;
      if (event.type === "draw") counts.glowDraw += 1;
    },
  });
  const glowTarget = makeCanvas();
  const renderTarget = makeCanvas();
  const surfaceFactory = createReusableRenderSurfaceFactory(makeCanvas, metrics);
  const compositionCache: CompositionPreviewCacheRuntime = {
    beginFrame: () => undefined,
    endFrame: () => undefined,
    dispose: () => undefined,
    getSnapshot: () => ({ size: 0, disposed: false, keys: [] }),
    getSurface: () => {
      counts.compositionCacheLookup += 1;
      return null;
    },
    storeSurface: () => {
      counts.compositionCacheStore += 1;
    },
  };
  const scheduledFrames = new Map<number, () => void>();
  let frameId = 0;
  const scheduler = createCanvasPointerFrameScheduler({
    requestFrame: (callback) => {
      frameId += 1;
      counts.scheduled += 1;
      scheduledFrames.set(frameId, callback);
      return frameId;
    },
    cancelFrame: (id) => scheduledFrames.delete(id),
  });

  scheduler.start({
    onMove: (sample) => {
      counts.accepted += 1;
      counts.selection += 1;
      const model = (phase === "before"
        ? createProjectSelectionModelDeriver()
        : selectionModelDeriver).derive(selectionOptions);
      const renderItems = targetKind === "Layer" ? layerRenderItems : subCompRenderItems;
      const timelineItems = targetKind === "Layer"
        ? layerTimelineItems
        : model.masterTimelineItems;
      const evaluatedScene = deriveEvaluatedScene(
        [
          model.allCompositionsById,
          0,
          model.allLayersById,
          metaByCompId,
          renderItems,
          model.selectedComp.id,
          model.selectedMeta,
          timelineItems,
          metrics,
        ],
        () => {
          metrics.increment("animationEvaluation");
          return buildEvaluatedScene({
            compositionId: model.selectedComp.id,
            width: 40,
            height: 30,
            renderItems,
            timelineItems,
            layerMap: model.allLayersById,
            compositionMap: model.allCompositionsById,
            metaByCompId,
            globalFrame: 0,
          });
        }
      );
      const accurate = deriveAccurateRenderer(
        [evaluatedScene, renderItems, metrics],
        () => renderAccurateRenderer({
          evaluatedScene,
          renderItems,
          runtimeMetrics: metrics,
        })
      );
      const fast = deriveFastRenderer(
        [evaluatedScene, renderItems, metrics],
        () => renderFastPreviewRenderer(evaluatedScene, metrics)
      );
      surfaceFactory.beginFrame();
      renderFrameToCanvas(renderTarget, accurate.frame, surfaceFactory.createSurface, 1);
      surfaceFactory.endFrame();
      const target: PreviewSceneUpdateTarget = targetKind === "Layer"
        ? { kind: "layer", id: layer.id }
        : { kind: "composition", id: scene.id };
      const patch = patchFor(handle, sample.clientX);
      const draftResolver = deriveDraftResolver(
        [evaluatedScene],
        () => createPreviewDraftBaseSceneResolver(evaluatedScene, (value) => {
          counts.draftSeed += 1;
          return buildPreviewSceneFromEvaluatedScene(value);
        })
      );
      const base = currentDraftBase === draftResolver
        ? currentDraftScene
        : draftResolver.resolve();
      assert.ok(base);
      const next = updatePreviewSceneNodeTransform(base, target, patch);
      const cached = applyPreviewNodeCacheFromScenes(base, next);
      currentDraftBase = draftResolver;
      currentDraftScene = cached.scene;
      counts.previewUpdate += 1;
      counts.dirty += cached.stats.updatedNodeCount;
      counts.reused += cached.stats.reusedNodeCount;
      surfaceFactory.beginFrame();
      renderPreviewSceneToCanvas({
        canvas: renderTarget,
        previewScene: cached.scene ?? fast.previewScene,
        renderItems,
        pixelScale: 1,
        createSurface: surfaceFactory.createSurface,
        compositionCache: resolvePreviewCompositionCacheForRender({
          compositionCache,
          isPreviewDraftActive: true,
        }),
      });
      surfaceFactory.endFrame();
      const selectedTarget = model.selectedTransformTarget;
      assert.ok(selectedTarget);
      const overlay = selectedTarget.kind === "layer"
        ? buildLayerSelectionOverlay(
            selectedTarget.layer,
            renderItems,
            timelineItems,
            0,
            model.selectedMeta?.frameRate
          )
        : buildCompositionSelectionOverlay(
            selectedTarget.composition,
            metaByCompId,
            evaluatedScene.localFrameBySourceId
          );
      const draftSnapshot = resolveDraftTransformSnapshot({
        target: selectedTarget,
        localFrame: 0,
        selectedMeta: model.selectedMeta,
        overlay,
        patch,
      });
      assert.ok(draftSnapshot);
      const changed = draftSnapshot.draft.changed;
      const motionPathDraftSnapshot =
        changed.position || changed.anchor || changed.transformOffset
          ? draftSnapshot
          : null;
      const motion = deriveMotionPath(
        [
          metaByCompId,
          0,
          motionPathDraftSnapshot,
          renderItems,
          model.selectedMeta,
          selectedTarget,
          timelineItems,
        ],
        () => {
          counts.motionBuild += 1;
          return selectedTarget.kind === "layer"
            ? buildLayerMotionPathGeometry(
                selectedTarget.layer,
                renderItems,
                timelineItems,
                30,
                30,
                motionPathDraftSnapshot
              )
            : buildCompositionMotionPathGeometry(
                selectedTarget.composition,
                timelineItems,
                metaByCompId,
                30,
                motionPathDraftSnapshot
              );
        }
      );
      const currentMotionPath = markCanvasMotionPathCurrentFrame(motion, 0);
      counts.motionSamples += currentMotionPath.length;
      const selectedTimelineItem = timelineItems[0] ?? null;
      const staticCandidates = deriveStaticCandidates(
        [
          model.allCompositionsById,
          evaluatedScene,
          model.allLayersById,
          renderItems,
          timelineItems,
        ],
        () => {
          counts.candidateStaticBuild += 1;
          return buildCanvasDirectSelectionStaticCandidates({
            evaluatedScene,
            renderItems,
            timelineItems,
            layersById: model.allLayersById,
            compositionsById: model.allCompositionsById,
          });
        }
      );
      const viewportCandidates = deriveViewportCandidates(
        [staticCandidates, viewportOffset, 1],
        () => {
          counts.candidateViewportBuild += 1;
          return buildCanvasDirectSelectionViewportCandidates({
            staticCandidates,
            viewportScale: 1,
            viewportOffset,
          });
        }
      );
      counts.candidateDraftUpdate += 1;
      const candidates = applyCanvasDirectSelectionDraft({
        staticCandidates,
        viewportCandidates,
        viewportScale: 1,
        viewportOffset,
        selectedTimelineItem,
        draftTransformSnapshot: draftSnapshot,
      });
      counts.projections += candidates.length;
      const ready = candidates.find((candidate) => candidate.status === "ready");
      assert.ok(ready);
      const descriptor: SelectionSourceAlphaDescriptor = ready.descriptor;
      const alpha = alphaProvider.get(descriptor);
      assert.equal(alpha.status, "ready");
      if (alpha.status === "ready") {
        glowRenderer.draw(glowTarget, {
          entry: alpha.entry,
          projection: ready.projection,
          viewportSize: { width: 40, height: 30 },
          devicePixelRatio: 1,
        });
      }
    },
    onCommit: () => {
      counts.project += 1;
      counts.history += 1;
    },
    onCancel: () => undefined,
  });
  for (let index = 0; index < 100; index += 1) {
    counts.raw += 1;
    scheduler.push({ clientX: index, clientY: index, shiftKey: false });
    if ((index + 1) % 10 === 0) {
      const callback = scheduledFrames.values().next().value;
      assert.ok(callback);
      scheduledFrames.clear();
      callback();
    }
  }
  scheduler.finish("commit");
  const rendererMetrics = metrics.getGlobalSnapshot();
  counts.animation = rendererMetrics.animationEvaluation;
  counts.full = rendererMetrics.accurateRenderer;
  counts.fast = rendererMetrics.fastPreviewRenderer;
  counts.surfaceCreate = rendererMetrics.surfaceCreate;
  counts.surfaceReuse = rendererMetrics.surfaceReuse;
  surfaceFactory.dispose();
  glowRenderer.dispose(glowTarget);
  alphaProvider.dispose();
  return counts;
}

const handles: HandleName[] = [
  "Position", "Anchor", "Scale W", "Scale H", "Scale WH", "Rotation", "Opacity",
];
const scenarios = [
  ...handles.map((handle) => ({ target: "Layer" as const, handle })),
  { target: "SubComp" as const, handle: "Position" as const },
  { target: "SubComp" as const, handle: "Opacity" as const },
];
const beforeResults = scenarios.map(({ target, handle }) => ({
  target,
  handle,
  counts: runDrag(handle, target, "before"),
}));
const afterResults = scenarios.map(({ target, handle }) => ({
  target,
  handle,
  counts: runDrag(handle, target, "after"),
}));

beforeResults.forEach(({ counts }) => {
  assert.deepEqual(
    { raw: counts.raw, scheduled: counts.scheduled, accepted: counts.accepted },
    { raw: 100, scheduled: 10, accepted: 10 }
  );
  assert.equal(counts.selection, 10);
  assert.equal(counts.animation, 10);
  assert.equal(counts.full, 10);
  assert.equal(counts.fast, 10);
  assert.equal(counts.draftSeed, 10);
  assert.equal(counts.previewUpdate, 10);
  assert.equal(counts.motionBuild, 10);
  assert.equal(counts.candidateStaticBuild, 10);
  assert.equal(counts.candidateViewportBuild, 10);
  assert.equal(counts.candidateDraftUpdate, 10);
  assert.equal(counts.projections, 10);
  assert.equal(counts.glowDraw, 10);
  assert.equal(counts.compositionCacheLookup, 0);
  assert.equal(counts.compositionCacheStore, 0);
  assert.equal(counts.project, 1);
  assert.equal(counts.history, 1);
  assert.equal(counts.alphaBuild, 1);
  assert.equal(counts.alphaReuse, 9);
  assert.equal(counts.glowBuild, 1);
  assert.equal(counts.glowReuse, 9);
});

afterResults.forEach(({ handle, counts }) => {
  assert.deepEqual(
    { raw: counts.raw, scheduled: counts.scheduled, accepted: counts.accepted },
    { raw: 100, scheduled: 10, accepted: 10 }
  );
  assert.equal(counts.animation, 1);
  assert.equal(counts.full, 1);
  assert.equal(counts.fast, 1);
  assert.equal(counts.draftSeed, 1);
  assert.equal(
    counts.motionBuild,
    handle === "Position" || handle === "Anchor" ? 10 : 1
  );
  assert.equal(counts.candidateStaticBuild, 1);
  assert.equal(counts.candidateViewportBuild, 1);
  assert.equal(counts.candidateDraftUpdate, 10);
  assert.equal(counts.project, 1);
  assert.equal(counts.history, 1);
  assert.equal(counts.alphaBuild, 1);
  assert.equal(counts.alphaReuse, 9);
  assert.equal(counts.glowBuild, 1);
  assert.equal(counts.glowReuse, 9);
});

type ComparisonMetric =
  | "animation"
  | "full"
  | "fast"
  | "draftSeed"
  | "motionBuild"
  | "candidateStaticBuild"
  | "candidateViewportBuild"
  | "candidateDraftUpdate"
  | "alphaBuild"
  | "alphaReuse"
  | "glowBuild"
  | "glowReuse"
  | "project"
  | "history";
const comparisonTable = scenarios.map(({ target, handle }, scenarioIndex) => {
  const before = beforeResults[scenarioIndex]!.counts;
  const after = afterResults[scenarioIndex]!.counts;
  const cell = (metric: ComparisonMetric) =>
    `${before[metric]} / ${after[metric]} / ${after[metric] - before[metric]}`;
  return {
    Target: target,
    Handle: handle,
    "Animation B/A/D": cell("animation"),
    "Full B/A/D": cell("full"),
    "Fast B/A/D": cell("fast"),
    "Draft Seed B/A/D": cell("draftSeed"),
    "Motion Path B/A/D": cell("motionBuild"),
    "Static Candidate B/A/D": cell("candidateStaticBuild"),
    "Viewport Candidate B/A/D": cell("candidateViewportBuild"),
    "Draft Update B/A/D": cell("candidateDraftUpdate"),
    "Alpha Build B/A/D": cell("alphaBuild"),
    "Alpha Reuse B/A/D": cell("alphaReuse"),
    "Glow Build B/A/D": cell("glowBuild"),
    "Glow Reuse B/A/D": cell("glowReuse"),
    "Project B/A/D": cell("project"),
    "History B/A/D": cell("history"),
  };
});

console.table(comparisonTable);
console.log("Canvas transform drag integration before/after passed", {
  motionPathMemoMeasurements,
  viewportMotion: {
    fullBuilds: viewportMotionFullBuilds,
    projectionBuilds: viewportMotionProjectionBuilds,
  },
});
