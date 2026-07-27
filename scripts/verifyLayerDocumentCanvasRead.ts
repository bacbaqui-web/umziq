import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildLayerDocumentCanvasReadModel,
} from "@/engines/canvas/adapters/layerDocumentCanvasReadAdapter";
import {
  createLayerDocumentCanvasCommands,
} from "@/engines/canvas/adapters/layerDocumentCanvasCommandAdapter";
import {
  createLayerDocumentCanvasRenderAssetPort,
} from "@/engines/canvas/adapters/layerDocumentCanvasRenderAssetAdapter";
import {
  buildLayerDocumentCanvasGlowSelectionKey,
  hitLayerDocumentCanvasDirectSelection,
  resolveLayerDocumentCanvasDirectSelectionIntent,
} from "@/engines/canvas/helpers/layerDocumentCanvasDirectSelectionHelpers";
import type {
  SelectionSourceAlphaProvider,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";
import type {
  LayerDocumentCanvasHandleDraft,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";
import {
  createLayerDocumentSourceRuntimeResourceCache,
  type EvaluatedSceneDrawableNode,
  type EvaluatedSceneTransform,
  type LayerDocumentRuntimeInput,
  type LayerDocumentEditorFrameReadModel,
  type LayerDocumentRuntimeTargetReadModel,
  type LayerDocumentTransformDraftSnapshot,
  type PreviewSceneTransformPatch,
} from "@/render";
import {
  drawPreviewSceneToContext,
} from "@/render/testing";

const canvas = {
  width: 40,
  height: 30,
  getContext: () => null,
} as unknown as HTMLCanvasElement;
const sourceId = "shared-source";
const sourceResourceCacheKey = "static-source-key";
const resources =
  createLayerDocumentSourceRuntimeResourceCache();
assert.equal(
  resources.register({
    sourceId,
    sourceResourceCacheKey,
    resolution: {
      renderItemId: "runtime-shared",
      drawableId: "drawable-shared",
      logicalSize: { width: 40, height: 30 },
    },
    resource: canvas,
  }).ok,
  true
);
const assetRequests: string[] = [];
const renderAssets =
  createLayerDocumentCanvasRenderAssetPort({
    resources,
    adaptResource: (resource) => {
      assetRequests.push(
        resource.sourceResourceCacheKey
      );
      return {
        source: {
          kind: "original",
          image: resource.resource as CanvasImageSource,
          pixelSize: resource.resolution.logicalSize,
        },
        alphaCanvas:
          resource.resource as HTMLCanvasElement,
      };
    },
  });

const transformA: EvaluatedSceneTransform = {
  position: { x: 80, y: 50 },
  transformOffset: { x: 2, y: 3 },
  anchor: { x: 20, y: 15 },
  scale: { x: 100, y: 100 },
  rotation: 0,
};
const transformB: EvaluatedSceneTransform = {
  ...transformA,
  position: { x: 85, y: 50 },
};

function input(
  layerDocumentId: string,
  order: number,
  transform: EvaluatedSceneTransform,
  draftApplied: boolean,
  quality: string
): LayerDocumentRuntimeInput {
  return {
    target: {
      kind: "layer-document",
      layerDocumentId,
    },
    layerDocumentId,
    sourceId,
    type: "psd",
    revision: 2,
    label: layerDocumentId,
    globalFrame: 5,
    localFrame: 5,
    order,
    evaluatedTransform: transform,
    opacity: 100,
    effects: [],
    modifiers: [],
    content: {
      kind: "drawable",
      resolution: {
        renderItemId: `runtime-${layerDocumentId}`,
        drawableId: "drawable-shared",
        logicalSize: { width: 40, height: 30 },
      },
    },
    sourceResourceCacheKey,
    layerResultCacheKey:
      `layer-result:${layerDocumentId}:${quality}:5`,
    draftIdentity: draftApplied
      ? `draft:${layerDocumentId}:5`
      : null,
    draftApplied,
  };
}

function target(
  runtimeInput: LayerDocumentRuntimeInput
): LayerDocumentRuntimeTargetReadModel {
  const shared = {
    target: runtimeInput.target,
    evaluatedTransform:
      runtimeInput.evaluatedTransform,
    opacity: runtimeInput.opacity,
  };
  return {
    ...shared,
    layerDocumentId:
      runtimeInput.layerDocumentId,
    sourceId: runtimeInput.sourceId,
    globalFrame: runtimeInput.globalFrame,
    localFrame: runtimeInput.localFrame,
    directSelection: shared,
    glow: {
      ...shared,
      sourceResourceCacheKey:
        runtimeInput.sourceResourceCacheKey,
    },
    gizmo: shared,
    motionPath: {
      ...shared,
      samples: [
        {
          frame: 4,
          position: { x: 70, y: 50 },
          isKeyframe: true,
        },
        {
          frame: 5,
          position:
            runtimeInput.evaluatedTransform.position,
          isKeyframe: false,
        },
      ],
    },
  };
}

function node(
  runtimeInput: LayerDocumentRuntimeInput
): EvaluatedSceneDrawableNode {
  const resolution =
    runtimeInput.content.kind === "drawable"
      ? runtimeInput.content.resolution
      : null;
  if (!resolution) {
    throw new Error("Expected drawable runtime input");
  }
  return {
    type: "drawable",
    layerDocumentId:
      runtimeInput.layerDocumentId,
    renderItemId: resolution.renderItemId,
    drawableId: resolution.drawableId,
    sourceId,
    sourceResourceCacheKey:
      runtimeInput.sourceResourceCacheKey,
    layerResultCacheKey:
      runtimeInput.layerResultCacheKey,
    sourceType: "psd",
    localFrame: runtimeInput.localFrame,
    visible: true,
    order: runtimeInput.order,
    logicalSize: resolution.logicalSize,
    transform:
      runtimeInput.evaluatedTransform,
    opacity: runtimeInput.opacity,
  };
}

function runtime(
  quality: string,
  draftApplied = false
): LayerDocumentEditorFrameReadModel {
  const inputA = input(
    "layer-a",
    0,
    transformA,
    draftApplied,
    quality
  );
  const inputB = input(
    "layer-b",
    1,
    transformB,
    false,
    quality
  );
  return {
    scene: {
      compositionId: "active-group",
      globalFrame: 5,
      size: { width: 200, height: 100 },
      localFrameBySourceId: new Map([
        [sourceId, 5],
      ]),
      localFrameByLayerDocumentId: new Map([
        ["layer-a", 5],
        ["layer-b", 5],
      ]),
      nodes: [node(inputA), node(inputB)],
    },
    inputs: [inputA, inputB],
    targets: [target(inputA), target(inputB)],
    unsupportedLayerDocumentIds: [],
  };
}

const activeScene = {
  layerDocumentId: "active-group",
  label: "Active Group",
  width: 200,
  height: 100,
  frameRate: 30,
  durationFrames: 60,
};
const viewport = {
  previewSize: { width: 200, height: 100 },
  viewportScale: 1,
  viewportOffset: { x: 0, y: 0 },
};

const preview = buildLayerDocumentCanvasReadModel({
  activeScene,
  runtime: { ok: true, model: runtime("preview", true) },
  selectedLayerDocumentId: "layer-a",
  previewQuality: "medium",
  viewport,
  renderAssets,
});
assert.equal(preview.ok, true);
if (!preview.ok) throw new Error(preview.reason);
assert.equal("mode" in preview.model, false);
assert.equal(
  preview.model.activeScene.layerDocumentId,
  "active-group"
);
assert.deepEqual(
  preview.model.previewWorkspaceScene,
  {
    identity: "active-group",
    width: 200,
    height: 100,
  }
);
assert.deepEqual(
  preview.model.renderer.previewScene.nodes.map(
    (node) => node.layerDocumentId
  ),
  ["layer-a", "layer-b"]
);
assert.equal(
  preview.model.selectedTarget?.target.layerDocumentId,
  "layer-a"
);
assert.strictEqual(
  preview.model.selectedTarget?.target,
  preview.model.selectedTarget?.gizmo.target
);
assert.strictEqual(
  preview.model.selectedTarget?.target,
  preview.model.selectedTarget?.motionPath.target
);
assert.equal(
  preview.model.hoverSuppressedDuringTransform,
  true
);
assert.equal(
  preview.model.sourceResourceCacheKey,
  sourceResourceCacheKey
);
assert.notEqual(
  preview.model.sourceResourceCacheKey,
  preview.model.layerResultCacheKey
);

const currentPoint =
  preview.model.motionPathCurrentPoint;
assert.ok(currentPoint);
assert.deepEqual(
  {
    x: currentPoint.x,
    y: currentPoint.y,
  },
  preview.model.selection.previewAnchor
);

const candidates =
  preview.model.directSelectionCandidates;
assert.deepEqual(
  candidates.map((candidate) => ({
    layerDocumentId: candidate.layerDocumentId,
    sourceId: candidate.sourceId,
  })),
  [
    { layerDocumentId: "layer-a", sourceId },
    { layerDocumentId: "layer-b", sourceId },
  ]
);
assert.equal(
  candidates.every(
    (candidate) => candidate.status === "ready"
  ),
  true
);
if (
  candidates[0]?.status !== "ready" ||
  candidates[1]?.status !== "ready"
) {
  throw new Error("Expected ready native candidates");
}
assert.notDeepEqual(
  candidates[0].projection.viewportBounds,
  candidates[1].projection.viewportBounds
);
assert.deepEqual(
  candidates.map((candidate) =>
    candidate.target?.layerDocumentId
  ),
  ["layer-a", "layer-b"]
);
assert.notEqual(
  buildLayerDocumentCanvasGlowSelectionKey(
    candidates[0]
  ),
  buildLayerDocumentCanvasGlowSelectionKey(
    candidates[1]
  )
);
assert.equal(
  preview.model.selectedGlowCandidate
    ?.layerDocumentId,
  "layer-a"
);

const provider: SelectionSourceAlphaProvider = {
  get: () => ({
    status: "ready",
    entry: {
      visualFingerprint: "selection-alpha",
      width: 40,
      height: 30,
      alphaBytes: new Uint8Array(
        40 * 30
      ).fill(255),
      sample: () => 255,
    },
  }),
  retain: () => undefined,
  release: () => undefined,
  clear: () => undefined,
  dispose: () => undefined,
};
const topHit =
  hitLayerDocumentCanvasDirectSelection({
    point: { x: 85, y: 50 },
    candidates,
    provider,
    compositionSize: { width: 200, height: 100 },
    viewportScale: 1,
    viewportOffset: { x: 0, y: 0 },
  });
assert.equal(topHit.status, "hit");
assert.equal(
  topHit.status === "hit"
    ? topHit.candidate.layerDocumentId
    : null,
  "layer-a"
);
assert.deepEqual(
  resolveLayerDocumentCanvasDirectSelectionIntent(
    topHit,
    "layer-a"
  ),
  { type: "drag", layerDocumentId: "layer-a" }
);

const originalQuality = buildLayerDocumentCanvasReadModel({
  activeScene,
  runtime: { ok: true, model: runtime("original") },
  selectedLayerDocumentId: "layer-b",
  previewQuality: "original",
  viewport,
  renderAssets,
});
assert.equal(originalQuality.ok, true);
if (!originalQuality.ok) throw new Error(originalQuality.reason);
assert.deepEqual(
  originalQuality.model.renderer.previewScene.nodes.map(
    (previewNode) => ({
      layerDocumentId:
        previewNode.layerDocumentId,
      sourceResourceCacheKey:
        previewNode.sourceResourceCacheKey,
    })
  ),
  [
    {
      layerDocumentId: "layer-a",
      sourceResourceCacheKey,
    },
    {
      layerDocumentId: "layer-b",
      sourceResourceCacheKey,
    },
  ]
);
assert.notEqual(
  preview.model.layerResultCacheKey,
  originalQuality.model.layerResultCacheKey
);
const qualityMatrix = ["preview", "original"] as const;
qualityMatrix.forEach((quality) => {
  const result =
    buildLayerDocumentCanvasReadModel({
      activeScene,
      runtime: {
        ok: true,
        model: runtime(quality),
      },
      selectedLayerDocumentId: "layer-a",
      quality,
      viewport,
      renderAssets,
    });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.reason);
  assert.equal(
    result.model.sourceResourceCacheKey,
    sourceResourceCacheKey
  );
  const layerDocumentIds =
    result.model.renderer.previewScene.nodes.map(
      (previewNode) =>
        previewNode.layerDocumentId
    );
  assert.deepEqual(layerDocumentIds, [
    "layer-a",
    "layer-b",
  ]);
});

let drawCount = 0;
const context = {
  save: () => undefined,
  restore: () => undefined,
  translate: () => undefined,
  rotate: () => undefined,
  scale: () => undefined,
  drawImage: () => {
    drawCount += 1;
  },
  clearRect: () => undefined,
  beginPath: () => undefined,
  rect: () => undefined,
  clip: () => undefined,
  fillRect: () => undefined,
  fillText: () => undefined,
  setTransform: () => undefined,
  globalAlpha: 1,
  fillStyle: "",
  font: "",
  textAlign: "left" as CanvasTextAlign,
  textBaseline: "alphabetic" as CanvasTextBaseline,
};
drawPreviewSceneToContext(
  context,
  originalQuality.model.renderer.previewScene,
  undefined,
  1,
  undefined,
  undefined,
  "original",
  undefined,
  originalQuality.model.renderer.resolveNodeVisual
);
assert.equal(drawCount, 2);
assert.equal(
  assetRequests.every(
    (key) => key === sourceResourceCacheKey
  ),
  true
);

const handleDrafts: LayerDocumentCanvasHandleDraft[] = [
  {
    handle: "position",
    value: { x: 10, y: 20 },
  },
  {
    handle: "scale-x",
    value: { x: 120, y: 100 },
  },
  {
    handle: "scale-y",
    value: { x: 100, y: 130 },
  },
  {
    handle: "scale-xy",
    value: { x: 140, y: 140 },
  },
  { handle: "rotation", value: 45 },
  { handle: "opacity", value: 70 },
  {
    handle: "anchor",
    value: {
      anchor: { x: 9, y: 8 },
      transformOffset: { x: 7, y: 6 },
    },
  },
  {
    handle: "transform-offset",
    value: { x: 4, y: 3 },
  },
];
const handlePatches: PreviewSceneTransformPatch[] = [];
let cancelledDraftCount = 0;
let keyframeDraftCount = 0;
let keyframeCancelCount = 0;
let selectedKeyframeLocalFrame: number | null = null;
let soughtFrame: number | null = null;
const commitResult = {
  projectUpdateCount: 1,
  transactionCount: 1,
  historyEntryCount: 1,
  animationAware: true,
};
const commands = createLayerDocumentCanvasCommands({
  selectedLayerDocumentId: "layer-a",
  sourceSamplingQuality: "preview",
  port: {
    pointerMove: ({ layerDocumentId, patch }) => {
      assert.equal(layerDocumentId, "layer-a");
      handlePatches.push(patch);
      const draft: LayerDocumentTransformDraftSnapshot = {
        target: {
          kind: "layer-document",
          layerDocumentId,
        },
        layerDocumentId,
        globalFrame: 5,
        localFrame: 5,
        patch,
        evaluatedTransform: {
          ...transformA,
          ...patch,
        },
        opacity: patch.opacity ?? 100,
        identity: `draft:${handlePatches.length}`,
      };
      return {
        kind: "pointer-move",
        draft,
        projectUpdateCount: 0,
        transactionCount: 0,
        historyEntryCount: 0,
      };
    },
    pointerUp: () => commitResult,
    cancelDraft: () => {
      cancelledDraftCount += 1;
    },
    directSelect: (layerDocumentId) =>
      layerDocumentId,
    enterGroup: (layerDocumentId) =>
      layerDocumentId,
    publishMotionPathKeyframeDraft: (command) => {
      keyframeDraftCount += 1;
      return {
        kind: "motion-path-keyframe-draft",
        layerDocumentId:
          command.layerDocumentId,
        globalFrame: command.globalFrame,
        localFrame: command.localFrame,
        value: command.value,
        projectUpdateCount: 0,
        transactionCount: 0,
        historyEntryCount: 0,
      };
    },
    commitMotionPathKeyframeDraft: () =>
      commitResult,
    cancelMotionPathKeyframeDraft: () => {
      keyframeCancelCount += 1;
    },
    selectMotionPathKeyframe: (command) => {
      selectedKeyframeLocalFrame =
        command.localFrame;
      return command.layerDocumentId;
    },
    seekFrame: (globalFrame) => {
      soughtFrame = globalFrame;
    },
  },
});
handleDrafts.forEach((handleDraft) => {
  const preparation =
    commands.updateHandleDraft(handleDraft);
  assert.equal(preparation?.kind, "pointer-move");
  assert.deepEqual(
    preparation && {
      projectUpdateCount:
        preparation.projectUpdateCount,
      transactionCount:
        preparation.transactionCount,
      historyEntryCount:
        preparation.historyEntryCount,
    },
    {
      projectUpdateCount: 0,
      transactionCount: 0,
      historyEntryCount: 0,
    }
  );
});
assert.equal(handlePatches.length, handleDrafts.length);
assert.deepEqual(handlePatches, [
  { position: { x: 10, y: 20 } },
  { scale: { x: 120, y: 100 } },
  { scale: { x: 100, y: 130 } },
  { scale: { x: 140, y: 140 } },
  { rotation: 45 },
  { opacity: 70 },
  {
    anchor: { x: 9, y: 8 },
    transformOffset: { x: 7, y: 6 },
  },
  { transformOffset: { x: 4, y: 3 } },
]);
assert.strictEqual(commands.commitDraft(), commitResult);
commands.cancelDraft();
assert.equal(cancelledDraftCount, 1);
const keyframeDraft =
  commands.publishMotionPathKeyframeDraft({
    kind: "upsert-position-keyframe",
    layerDocumentId: "layer-a",
    globalFrame: 9,
    localFrame: 4,
    value: { x: 99, y: 88 },
  });
assert.ok(keyframeDraft);
assert.deepEqual(
  {
    localFrame: keyframeDraft.localFrame,
    transactionCount:
      keyframeDraft.transactionCount,
    historyEntryCount:
      keyframeDraft.historyEntryCount,
  },
  {
    localFrame: 4,
    transactionCount: 0,
    historyEntryCount: 0,
  }
);
assert.equal(keyframeDraftCount, 1);
assert.strictEqual(
  commands.commitMotionPathKeyframeDraft(),
  commitResult
);
commands.cancelMotionPathKeyframeDraft();
commands.selectMotionPathKeyframe({
  layerDocumentId: "layer-a",
  globalFrame: 9,
  localFrame: 4,
});
commands.seekFrame(9);
assert.equal(keyframeCancelCount, 1);
assert.equal(selectedKeyframeLocalFrame, 4);
assert.equal(soughtFrame, 9);

const editorShell = readFileSync(
  "src/editor/EditorShellLayout.tsx",
  "utf8"
);
const canvasComposition = readFileSync(
  "src/engines/canvas/useLayerDocumentCanvasComposition.ts",
  "utf8"
);
assert.match(editorShell, /PreviewWorkspacePane/);
assert.match(
  canvasComposition,
  /CanvasPreviewPaneProps/
);
assert.doesNotMatch(
  canvasComposition,
  /@\/features/
);
const previewWorkspacePane = readFileSync(
  "src/features/preview/components/PreviewWorkspacePane.tsx",
  "utf8"
);
assert.match(previewWorkspacePane, /activeScene/);
assert.doesNotMatch(
  previewWorkspacePane,
  /selectedComp|selectedMeta|\bComposition\b/
);
const previewBridge = readFileSync(
  "src/engines/canvas/adapters/useLayerDocumentCanvasPreviewBridge.ts",
  "utf8"
);
assert.match(
  previewBridge,
  /useLayerDocumentCanvasInteractionAdapter/
);
assert.match(
  previewBridge,
  /useLayerDocumentCanvasDirectSelectionController/
);
assert.match(
  previewBridge,
  /useLayerDocumentCanvasOverlayAdapter/
);
assert.match(
  previewBridge,
  /interactionViewModel:\s*overlay\.viewModel/
);
assert.match(
  previewBridge,
  /interactionCommands:\s*overlay\.commands/
);
assert.match(
  previewBridge,
  /directSelectionHover:\s*direct\.hover/
);
assert.match(
  previewBridge,
  /selectionGlow:\s*direct\.glow/
);
const nativeInteractionAdapter = readFileSync(
  "src/engines/canvas/adapters/useLayerDocumentCanvasInteractionAdapter.ts",
  "utf8"
);
assert.match(
  nativeInteractionAdapter,
  /calculatePreviewPositionDragUpdate/
);
assert.match(
  nativeInteractionAdapter,
  /createMotionPathKeyframeDragState/
);
assert.match(
  previewBridge,
  /useCanvasPointerController/
);
const canvasCommandPort = readFileSync(
  "src/engines/canvas/adapters/layerDocumentCanvasCommandPortAdapter.ts",
  "utf8"
);
assert.match(
  canvasCommandPort,
  /publishMotionPath/
);
assert.match(
  canvasCommandPort,
  /commitMotionPath/
);
assert.doesNotMatch(
  readFileSync(
    "src/editor/useEditorCompositionRoot.ts",
    "utf8"
  ),
  /buildLayerDocumentCanvasReadModel|createLayerDocumentCanvasCommands/
);
assert.doesNotMatch(
  readFileSync(
    "src/engines/canvas/adapters/layerDocumentCanvasReadAdapter.ts",
    "utf8"
  ),
  /\bComposition\b|\bProjectSourceDocument\b|\bRenderItem\b|\bTimelineItem\b/
);
resources.dispose();
console.log(
  "Layer Document Canvas read verification passed"
);
