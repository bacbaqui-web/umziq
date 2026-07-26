import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createLayerDocumentCanvasCommands,
} from "@/engines/canvas/adapters/layerDocumentCanvasCommandAdapter";
import {
  buildLayerDocumentCanvasRenderFrame,
} from "@/engines/canvas/helpers/layerDocumentCanvasRendererHelpers";
import {
  createRuntimeMetricRecordPort,
} from "@/engines/canvas/helpers/runtimeMetricsHelpers";
import {
  createCompositionPreviewCacheRuntime,
} from "@/engines/canvas/state/compositionPreviewCacheStore";
import {
  createPreviewSurfaceCacheRuntime,
} from "@/engines/canvas/state/previewSurfaceCacheStore";
import {
  createRuntimeMetricsResource,
} from "@/engines/canvas/state/runtimeMetricsStore";
import {
  buildLayerDocumentCompositionVisualResultCacheKey,
  buildLayerDocumentVisualResultCacheKey,
  renderPreviewRenderer,
  renderPreviewSceneToCanvas,
  type EvaluatedScene,
  type EvaluatedSceneCompositionNode,
  type PreviewCanvasDrawState,
  type PreviewRenderSurface,
  type RenderNodeVisualResolver,
} from "@/engines/playback-render";
import {
  drawRenderCommandsToContext,
} from "@/engines/playback-render/adapters/canvas2dRenderAdapter";
import {
  PROFILING_ENVIRONMENT_FREEZE,
  PROFILING_FIXTURES,
} from "./previewInteractionProfilingManifest.ts";
import {
  SHELL_DEFAULT_LEFT_PANEL_WIDTH,
  SHELL_DEFAULT_RIGHT_PANEL_WIDTH,
  SHELL_DEFAULT_TIMELINE_PANEL_HEIGHT,
} from "@/editor/editorShellLayoutConstants";

const transform = {
  position: { x: 50, y: 50 },
  transformOffset: { x: 0, y: 0 },
  anchor: { x: 25, y: 25 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};

function composition(
  suffix: string,
  order: number
): EvaluatedSceneCompositionNode {
  const groupId = `layer-document:group-${suffix}`;
  const layerId = `layer-document:layer-${suffix}`;
  const sourceId = `psd-source:layer-${suffix}`;
  return {
    type: "composition",
    identityKind: "canonical-placement",
    layerDocumentId: groupId,
    itemId: groupId,
    renderItemId: groupId,
    sourceId: `psd-source:group-${suffix}`,
    sourceResourceCacheKey: `source:${suffix}:group`,
    layerResultCacheKey: `result:${suffix}:group`,
    sourceType: "group",
    targetCompId: groupId,
    localFrame: 0,
    visible: true,
    order,
    size: { width: 100, height: 100 },
    transform,
    opacity: 100,
    children: [{
      type: "drawable",
      identityKind: "canonical-placement",
      layerDocumentId: layerId,
      itemId: layerId,
      renderItemId: `runtime:${sourceId}`,
      drawableId: `drawable:${sourceId}`,
      sourceId,
      sourceResourceCacheKey: `source:${suffix}:layer`,
      layerResultCacheKey: `result:${suffix}:layer`,
      sourceType: "psd",
      localFrame: 0,
      visible: true,
      order: 0,
      logicalSize: { width: 50, height: 50 },
      transform,
      opacity: 100,
    }],
  };
}

const evaluatedScene: EvaluatedScene = {
  compositionId: "layer-document:root",
  globalFrame: 0,
  size: { width: 200, height: 100 },
  localFrameBySourceId: new Map(),
  localFrameByItemId: new Map(),
  nodes: [
    composition("front", 0),
    composition("back", 1),
  ],
};

const metrics = createRuntimeMetricsResource();
const metricPort = createRuntimeMetricRecordPort(metrics);
const firstPreview = renderPreviewRenderer(
  evaluatedScene,
  metricPort
).previewScene;
const frameOnlyEvaluatedScene: EvaluatedScene = {
  ...evaluatedScene,
  globalFrame: 1,
};
const accurateFrame =
  buildLayerDocumentCanvasRenderFrame({
    runtime: {
      scene: evaluatedScene,
      inputs: [],
      targets: [],
      unsupportedLayerDocumentIds: [],
    },
    renderAssets: {
      resolve: (request) => ({
        source: {
          kind: "original",
          image: {
            label: request.layerDocumentId,
          } as unknown as CanvasImageSource,
          pixelSize: request.logicalSize,
        },
        alphaCanvas: null,
        sourceVisualIdentity:
          request.sourceResourceCacheKey,
      }),
    },
    runtimeMetrics: metricPort,
  });
const secondPreview = renderPreviewRenderer(
  frameOnlyEvaluatedScene,
  metricPort,
  firstPreview
).previewScene;

assert.notStrictEqual(secondPreview, firstPreview);
assert.strictEqual(secondPreview.nodes[0], firstPreview.nodes[0]);
assert.strictEqual(secondPreview.nodes[1], firstPreview.nodes[1]);

const firstPainter = firstPreview;
const secondPainter = secondPreview;

assert.strictEqual(firstPainter, firstPreview);
assert.strictEqual(secondPainter, secondPreview);
assert.notStrictEqual(firstPainter, secondPainter);
assert.strictEqual(
  firstPainter.nodes[0],
  secondPainter.nodes[0]
);
assert.strictEqual(
  firstPainter.nodes[1],
  secondPainter.nodes[1]
);
assert.deepEqual(
  firstPainter.nodes.map((node) => node.layerDocumentId),
  [
    "layer-document:group-front",
    "layer-document:group-back",
  ]
);

const paintedLayerOrder: string[] = [];
function context() {
  return {
    globalAlpha: 1,
    fillStyle: "",
    font: "",
    textAlign: "left" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,
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
    drawImage: (image: CanvasImageSource) => {
      const label = (
        image as CanvasImageSource & { label?: string }
      ).label;
      if (label) paintedLayerOrder.push(label);
    },
  };
}

const createSurface = (
  width: number,
  height: number,
  pixelScale: number
): PreviewRenderSurface => ({
  canvas: {
    width: Math.ceil(width * pixelScale),
    height: Math.ceil(height * pixelScale),
  } as HTMLCanvasElement,
  context: context(),
});
const surfaceCache = createPreviewSurfaceCacheRuntime({
  metrics: metricPort,
});
const compositionCache = createCompositionPreviewCacheRuntime({
  releaseSurface: surfaceCache.releaseSurface,
});
const drawState: PreviewCanvasDrawState = {
  previousScene: null,
  previousNodeBoundsById: new Map(),
  previousPixelScale: null,
};
const canvas = {
  width: 0,
  height: 0,
  getContext: () => context(),
} as unknown as HTMLCanvasElement;
const resolveNodeVisual: RenderNodeVisualResolver = (request) => ({
  kind: "original",
  image: {
    label: request.layerDocumentId,
  } as unknown as CanvasImageSource,
  pixelSize: request.logicalSize,
});
drawRenderCommandsToContext(
  context(),
  accurateFrame.commands,
  (width, height, pixelScale) =>
    createSurface(width, height, pixelScale),
  1
);
assert.deepEqual(paintedLayerOrder, [
  "layer-document:layer-back",
  "layer-document:layer-front",
]);
paintedLayerOrder.length = 0;

for (const scene of [firstPainter, secondPainter]) {
  compositionCache.beginFrame();
  renderPreviewSceneToCanvas({
    canvas,
    previewScene: scene,
    resolveNodeVisual,
    createSurface,
    runtimeMetrics: metricPort,
    compositionCache,
    surfaceCache,
    drawState,
  });
  compositionCache.endFrame();
}
assert.deepEqual(paintedLayerOrder, [
  "layer-document:layer-back",
  "layer-document:layer-front",
]);

const changedEvaluatedScene: EvaluatedScene = {
  ...evaluatedScene,
  globalFrame: 1,
  nodes: evaluatedScene.nodes.map((node, index) =>
    index === 0 && node.type === "composition"
      ? {
          ...node,
          children: node.children.map((child) => ({
            ...child,
            transform: {
              ...child.transform,
              position: { x: 60, y: 50 },
            },
          })),
        }
      : node
  ),
};
const changedPreview = renderPreviewRenderer(
  changedEvaluatedScene,
  metricPort,
  secondPreview
).previewScene;
assert.notStrictEqual(changedPreview, secondPreview);
assert.notStrictEqual(
  changedPreview.nodes[0],
  secondPreview.nodes[0]
);
assert.strictEqual(
  changedPreview.nodes[1],
  secondPreview.nodes[1]
);
compositionCache.beginFrame();
renderPreviewSceneToCanvas({
  canvas,
  previewScene: changedPreview,
  resolveNodeVisual,
  createSurface,
  runtimeMetrics: metricPort,
  compositionCache,
  surfaceCache,
  drawState,
});
compositionCache.endFrame();

const commitResult = {
  ok: true as const,
  transition: { changed: true },
};
const commands = createLayerDocumentCanvasCommands({
  selectedLayerDocumentId: "layer-document:layer-front",
  quality: "original",
  runtimeMetrics: metricPort,
  port: {
    pointerMove: () => null,
    pointerUp: () => commitResult,
    cancelDraft: () => undefined,
    directSelect: () => null,
    enterGroup: () => null,
    publishMotionPathKeyframeDraft: () => null,
    commitMotionPathKeyframeDraft: () => commitResult,
    cancelMotionPathKeyframeDraft: () => undefined,
    selectMotionPathKeyframe: () => null,
    seekFrame: () => undefined,
  },
});
commands.updateHandleDraft({
  handle: "position",
  value: { x: 60, y: 50 },
});
assert.equal(metrics.getGlobalSnapshot().projectUpdate, 0);
assert.equal(metrics.getGlobalSnapshot().historyCommit, 0);
assert.strictEqual(commands.commitDraft(), commitResult);

const BEFORE_PAINTER_IDENTITY_BASELINE = Object.freeze({
  previewRenderer: 2,
  accurateRenderer: 1,
  previewSceneGeneration: 1,
  playbackNodeReused: 4,
  playbackCompositionReused: 2,
  painterTraversal: 8,
  painterClone: 6,
  dirtyFull: 1,
  dirtySkip: 0,
  dirtyPartial: 1,
  compositionCacheHit: 0,
  compositionCacheMiss: 4,
  surfaceCreate: 2,
  surfaceReuse: 2,
  drawImage: 8,
  projectUpdate: 1,
  historyCommit: 1,
});
const after = metrics.getGlobalSnapshot();
assert.equal(after.previewRenderer, 3);
assert.equal(after.accurateRenderer, 1);
assert.equal(after.previewSceneGeneration, 1);
assert.equal(after.playbackNodeReused, 6);
assert.equal(after.playbackCompositionReused, 3);
assert.equal(after.painterTraversal, 7);
assert.equal(after.painterClone, 0);
assert.equal(after.dirtyFull, 1);
assert.equal(after.dirtySkip, 1);
assert.equal(after.dirtyPartial, 1);
assert.equal(after.compositionCacheHit, 1);
assert.equal(after.compositionCacheMiss, 3);
assert.equal(after.surfaceCreate, 2);
assert.equal(after.surfaceReuse, 1);
assert.equal(after.drawImage, 7);
assert.equal(after.projectUpdate, 1);
assert.equal(after.historyCommit, 1);
const finalFrame = metrics.getFrameSnapshot();
assert.equal(finalFrame.dirtyFull, 0);
assert.equal(finalFrame.dirtyPartial, 1);
assert.equal(finalFrame.compositionCacheHit, 1);
assert.equal(finalFrame.compositionCacheMiss, 1);
assert.equal(finalFrame.drawImage, 3);
assert.equal(finalFrame.painterClone, 0);

const visualKeyInput = {
  layerDocumentId: "layer-document:visual-key",
  sourceType: "psd" as const,
  sourceResourceCacheKey: "static-source-v1",
  order: 0,
  evaluatedTransform: transform,
  opacity: 100,
  effects: [],
  modifiers: [],
  contentIdentity: ["drawable", "runtime", "drawable", 50, 50],
};
const staticFrameVisualKey =
  buildLayerDocumentVisualResultCacheKey(visualKeyInput);
assert.equal(
  buildLayerDocumentVisualResultCacheKey({
    ...visualKeyInput,
  }),
  staticFrameVisualKey
);
[
  {
    ...visualKeyInput,
    sourceResourceCacheKey: "static-source-v2",
  },
  {
    ...visualKeyInput,
    sourceResourceCacheKey: "timed-source:frame-1",
  },
  {
    ...visualKeyInput,
    evaluatedTransform: {
      ...transform,
      position: { x: 51, y: 50 },
    },
  },
  { ...visualKeyInput, opacity: 99 },
  {
    ...visualKeyInput,
    effects: [{
      effectId: "effect",
      type: "test",
      enabled: true,
      parameters: { amount: 1 },
    }],
  },
  {
    ...visualKeyInput,
    modifiers: [{
      modifierId: "modifier",
      type: "wiggle" as const,
      enabled: true,
      frequency: 1,
      amount: 1,
    }],
  },
].forEach((changedInput) => {
  assert.notEqual(
    buildLayerDocumentVisualResultCacheKey(changedInput),
    staticFrameVisualKey
  );
});
const compositionVisualKey =
  buildLayerDocumentCompositionVisualResultCacheKey(
    staticFrameVisualKey,
    [{ layerResultCacheKey: "child-v1", order: 0 }]
  );
assert.notEqual(
  buildLayerDocumentCompositionVisualResultCacheKey(
    staticFrameVisualKey,
    [{ layerResultCacheKey: "child-v2", order: 0 }]
  ),
  compositionVisualKey
);

for (const fixture of Object.values(PROFILING_FIXTURES)) {
  assert.equal(
    fixture.import.compositionName,
    fixture.file.replace(/\.psd$/i, "")
  );
  assert.equal(
    fixture.import.layerDocumentIdPrefix,
    "layer-document:"
  );
  assert.equal(
    fixture.target.identity.layerDocumentIdPrefix,
    "layer-document:"
  );
  assert.equal(
    fixture.target.identity.sourceIdPrefix,
    "psd-source:"
  );
  assert.equal("timelineItemId" in fixture.target, false);
}

const freeze = PROFILING_ENVIRONMENT_FREEZE;
assert.equal(freeze.captureMethod, "headless-chromium-cdp");
assert.match(freeze.browser, /^HeadlessChrome\//);
assert.deepEqual(
  freeze.frozenValues.windowInnerCss,
  { width: 1792, height: 1012 }
);
assert.deepEqual(
  freeze.frozenValues.windowOuterCss,
  freeze.frozenValues.windowInnerCss
);
assert.equal(freeze.frozenValues.devicePixelRatio, 2);
assert.deepEqual(
  freeze.frozenValues.previewViewportDomRectCss,
  {
    x: SHELL_DEFAULT_LEFT_PANEL_WIDTH + 6,
    y: 42,
    width:
      freeze.frozenValues.windowInnerCss.width
      - SHELL_DEFAULT_LEFT_PANEL_WIDTH
      - SHELL_DEFAULT_RIGHT_PANEL_WIDTH
      - 12,
    height:
      freeze.frozenValues.windowInnerCss.height
      - 42
      - SHELL_DEFAULT_TIMELINE_PANEL_HEIGHT
      - 6,
  }
);

const [
  canvasRenderController,
  previewNodeRenderer,
  canvas2dRenderAdapter,
  directSelectionHelpers,
  editorShell,
  timelineRow,
  previewLayers,
  driver,
] = await Promise.all([
  readFile(
    new URL(
      "../src/engines/canvas/controllers/useCanvasRenderController.ts",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL(
      "../src/engines/playback-render/adapters/canvas2dPreviewNodeRenderer.ts",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL(
      "../src/engines/playback-render/adapters/canvas2dRenderAdapter.ts",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL(
      "../src/engines/canvas/helpers/layerDocumentCanvasDirectSelectionHelpers.ts",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL(
      "../src/editor/EditorShellLayout.tsx",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL(
      "../src/features/timeline/components/TimelineItemTrackRow.tsx",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL(
      "../src/features/preview/components/PreviewViewportLayers.tsx",
      import.meta.url
    ),
    "utf8"
  ),
  readFile(
    new URL(
      "./previewInteractionProfilingCdpDriver.mjs",
      import.meta.url
    ),
    "utf8"
  ),
]);
assert.doesNotMatch(
  canvasRenderController,
  /buildCanvasPainter|\.reverse\(/
);
assert.match(
  previewNodeRenderer,
  /let index = nodes\.length - 1; index >= 0; index -= 1/
);
assert.match(
  canvas2dRenderAdapter,
  /let index = commands\.length - 1;[\s\S]*index >= 0;[\s\S]*index -= 1/
);
assert.match(
  directSelectionHelpers,
  /let index = 0;[\s\S]*index < options\.candidates\.length;[\s\S]*index \+= 1/
);
assert.match(
  editorShell,
  /gridTemplateRows: `42px minmax\(0, 1fr\) 6px \$\{timelinePanelHeight\}px`/
);
assert.match(
  editorShell,
  /gridTemplateColumns: `\$\{leftPanelWidth\}px 6px minmax\(0, 1fr\) 6px \$\{rightPanelWidth\}px`/
);
assert.match(timelineRow, /data-layer-document-id=\{item\.id\}/);
assert.match(
  previewLayers,
  /data-selected-layer-document-id=/
);
assert.match(previewLayers, /data-selected-source-id=/);
assert.match(driver, /observedLayerDocumentId/);
assert.doesNotMatch(driver, /expectedTimelineItemId/);
assert.match(
  driver,
  /\[aria-label="PSD Import Preview"\]/
);
assert.match(
  driver,
  /\[aria-label="현재 그룹 위치"\] button\[aria-current="page"\]/
);
assert.match(
  driver,
  /\[data-layer-document-id\]\[draggable="true"\]/
);
assert.match(driver, /expectedSelectionLabel/);
assert.doesNotMatch(
  driver,
  /fixture\.id === "flat"[\s\S]{0,200}aria-label="위치 이동"/
);

compositionCache.dispose();
surfaceCache.dispose();

console.log("LayerDocument render observation baseline verification passed");
console.log(JSON.stringify({
  fixture:
    "two LayerDocument compositions: unchanged frame skip, then one changed child",
  before: BEFORE_PAINTER_IDENTITY_BASELINE,
  after,
}, null, 2));
