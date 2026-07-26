import assert from "node:assert/strict";
import {
  renderAccurateRenderer,
  renderPreviewRenderer,
  type EvaluatedScene,
  type EvaluatedSceneNode,
  type PreviewNode,
  type RenderCommand,
} from "@/engines/playback-render";

const transform = {
  position: { x: 42, y: 31 },
  transformOffset: { x: 2, y: -1 },
  anchor: { x: 16, y: 12 },
  scale: { x: 90, y: 110 },
  rotation: 12,
};

const drawable: EvaluatedSceneNode = {
  type: "drawable",
  layerDocumentId: "layer-drawable",
  itemId: "layer-drawable",
  renderItemId: "render-drawable",
  drawableId: "drawable",
  sourceId: "source-drawable",
  sourceResourceCacheKey: "source-key",
  layerResultCacheKey: "result-key",
  sourceType: "psd",
  localFrame: 3,
  visible: true,
  order: 0,
  logicalSize: { width: 32, height: 24 },
  transform,
  opacity: 73,
};

const placeholder: EvaluatedSceneNode = {
  type: "placeholder",
  layerDocumentId: "layer-text",
  itemId: "layer-text",
  renderItemId: null,
  sourceId: null,
  sourceType: "text",
  localFrame: 3,
  visible: true,
  order: 1,
  logicalSize: { width: 80, height: 30 },
  transform,
  opacity: 55,
  placeholder: {
    placeholderKind: "text",
    label: "TEXT",
    size: { width: 80, height: 30 },
    fill: "#5b6b7a",
    textColor: "#ffffff",
  },
};

const scene: EvaluatedScene = {
  compositionId: "root",
  globalFrame: 3,
  size: { width: 320, height: 180 },
  localFrameBySourceId: new Map([["source-drawable", 3]]),
  localFrameByItemId: new Map([
    ["layer-drawable", 3],
    ["layer-text", 3],
  ]),
  nodes: [{
    type: "composition",
    layerDocumentId: "group",
    itemId: "group",
    renderItemId: "group",
    sourceId: null,
    sourceType: "group",
    targetCompId: "group",
    localFrame: 3,
    visible: true,
    order: 0,
    size: { width: 160, height: 90 },
    transform,
    opacity: 88,
    children: [drawable, placeholder],
  }],
};

const accurate = renderAccurateRenderer({
  evaluatedScene: scene,
  resolveNodeVisual: (request) => ({
    kind: "original",
    image: { id: request.drawableId } as unknown as CanvasImageSource,
    pixelSize: request.logicalSize,
  }),
}).frame;
const preview = renderPreviewRenderer(scene).previewScene;

function normalizeEvaluated(node: EvaluatedSceneNode): unknown {
  return {
    kind: node.type,
    layerDocumentId: node.layerDocumentId,
    itemId: node.itemId,
    sourceId: node.sourceId,
    localFrame: node.localFrame,
    size: node.type === "composition" ? node.size : node.logicalSize,
    transform: node.transform,
    opacity: node.opacity,
    children:
      node.type === "composition"
        ? node.children.map(normalizeEvaluated)
        : [],
  };
}

function normalizePreview(node: PreviewNode): unknown {
  return {
    kind: node.kind === "layer" ? "drawable" : node.kind,
    layerDocumentId: node.layerDocumentId,
    itemId: node.itemId,
    sourceId: node.sourceId,
    localFrame: node.localFrame,
    size: node.logicalSize,
    transform: node.transform,
    opacity: node.opacity,
    children: node.children.map(normalizePreview),
  };
}

function normalizeAccurate(command: RenderCommand): unknown {
  return {
    kind: command.type,
    layerDocumentId: command.layerDocumentId,
    itemId: command.itemId,
    sourceId: command.sourceId,
    localFrame: command.localFrame,
    size:
      command.type === "composition"
        ? { width: command.width, height: command.height }
        : command.logicalSize,
    transform: {
      position: command.transform.position,
      transformOffset: command.transform.transformOffset,
      anchor: command.transform.anchor,
      scale: command.transform.scale,
      rotation: command.transform.rotation,
    },
    opacity: command.opacity,
    children:
      command.type === "composition"
        ? command.children.map(normalizeAccurate)
        : [],
  };
}

const expected = scene.nodes.map(normalizeEvaluated);
assert.deepEqual(preview.nodes.map(normalizePreview), expected);
assert.deepEqual(accurate.commands.map(normalizeAccurate), expected);
assert.equal(preview.compositionId, accurate.compositionId);
assert.equal(preview.globalFrame, accurate.globalFrame);
assert.deepEqual(preview.logicalSize, {
  width: accurate.width,
  height: accurate.height,
});

console.log("Preview/Accurate renderer contract verification passed");
