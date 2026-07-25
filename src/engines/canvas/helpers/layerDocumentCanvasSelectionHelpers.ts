import type {
  EvaluatedSceneNode,
  EvaluatedSceneSize,
  LayerDocumentRuntimeInput,
  LayerDocumentRuntimeReadModel,
  LayerDocumentRuntimeTargetReadModel,
} from "@/engines/playback-render";
import {
  STATIC_PSD_SELECTION_FRAME_VISUAL_KEY,
} from "@/engines/canvas/constants/canvasSelectionAlphaConstants";
import {
  getTransformGeometry,
} from "@/engines/canvas/helpers/canvasCoordinateHelpers";
import {
  buildCanvasSelectionProjection,
} from "@/engines/canvas/helpers/canvasDirectSelectionGeometryHelpers";
import {
  worldPointToCanvasPoint,
} from "@/engines/canvas/helpers/canvasViewportHelpers";
import type {
  LayerDocumentCanvasDirectSelectionCandidate,
  LayerDocumentCanvasRenderAssetPort,
  LayerDocumentCanvasViewportInput,
} from "@/engines/canvas/models/layerDocumentCanvasModeModel";
import type {
  CanvasSelectionReadModel,
} from "@/engines/canvas/models/canvasEngineModel";
import type {
  SelectionSourceAlphaDescriptor,
} from "@/engines/canvas/models/canvasSelectionAlphaModel";
import type {
  PreviewMotionPathPoint,
  PreviewOverlay,
} from "@/engines/canvas/models/canvasViewModel";

function inputSize(
  input: LayerDocumentRuntimeInput
): EvaluatedSceneSize | null {
  switch (input.content.kind) {
    case "drawable":
      return input.content.resolution.logicalSize;
    case "composition":
      return input.content.size;
    case "placeholder":
      return input.content.placeholder.size;
    case "unavailable":
    case "unsupported":
      return null;
  }
}

function buildOverlay(options: {
  input: LayerDocumentRuntimeInput;
  target: LayerDocumentRuntimeTargetReadModel;
}): PreviewOverlay {
  const size = inputSize(options.input);
  if (!size) return null;
  const transform = options.target.gizmo.evaluatedTransform;
  const geometry = getTransformGeometry(
    size.width,
    size.height,
    transform.position,
    transform.transformOffset,
    transform.anchor,
    transform.scale,
    transform.rotation
  );
  if (geometry.bounds.width <= 0 || geometry.bounds.height <= 0) {
    return null;
  }
  const shared = {
    targetId: options.target.layerDocumentId,
    x: geometry.bounds.x,
    y: geometry.bounds.y,
    width: geometry.bounds.width,
    height: geometry.bounds.height,
    centerX: geometry.centerWorld.x,
    centerY: geometry.centerWorld.y,
    corners: geometry.corners,
    anchorX: geometry.anchorWorld.x,
    anchorY: geometry.anchorWorld.y,
    scaleX: transform.scale.x,
    scaleY: transform.scale.y,
    rotation: transform.rotation,
    sourceWidth: size.width,
    sourceHeight: size.height,
    canvasWidth: size.width,
    canvasHeight: size.height,
  };
  return options.input.type === "group"
    ? { ...shared, targetKind: "composition" }
    : { ...shared, targetKind: "layer" };
}

function emptySelection(): CanvasSelectionReadModel {
  return {
    overlay: null,
    previewCorners: null,
    previewAnchor: null,
    previewCenter: null,
    polygonPoints: "",
  };
}

export function buildLayerDocumentCanvasSelectionReadModel(options: {
  runtime: LayerDocumentRuntimeReadModel;
  selectedInput: LayerDocumentRuntimeInput | null;
  selectedTarget: LayerDocumentRuntimeTargetReadModel | null;
  viewport: LayerDocumentCanvasViewportInput;
}): CanvasSelectionReadModel {
  if (!options.selectedInput || !options.selectedTarget) {
    return emptySelection();
  }
  const overlay = buildOverlay({
    input: options.selectedInput,
    target: options.selectedTarget,
  });
  if (!overlay) return emptySelection();
  const sceneSize = options.runtime.scene.size;
  const toCanvasPoint = (point: { x: number; y: number }) =>
    worldPointToCanvasPoint(
      {
        meta: sceneSize,
        previewSize: options.viewport.previewSize,
        viewportScale: options.viewport.viewportScale,
        viewportOffset: options.viewport.viewportOffset,
      },
      point
    );
  const previewCorners = {
    nw: toCanvasPoint(overlay.corners.nw),
    ne: toCanvasPoint(overlay.corners.ne),
    se: toCanvasPoint(overlay.corners.se),
    sw: toCanvasPoint(overlay.corners.sw),
  };
  return {
    overlay,
    previewCorners,
    previewAnchor: toCanvasPoint({
      x: overlay.anchorX,
      y: overlay.anchorY,
    }),
    previewCenter: toCanvasPoint({
      x: overlay.centerX,
      y: overlay.centerY,
    }),
    polygonPoints: Object.values(previewCorners)
      .map((point) => `${point.x},${point.y}`)
      .join(" "),
  };
}

export function buildLayerDocumentCanvasMotionPath(options: {
  input: LayerDocumentRuntimeInput | null;
  target: LayerDocumentRuntimeTargetReadModel | null;
}): PreviewMotionPathPoint[] {
  if (!options.input || !options.target) return [];
  const size = inputSize(options.input);
  if (!size) return [];
  const transform =
    options.target.motionPath.evaluatedTransform;
  return options.target.motionPath.samples.map((sample) => {
    const geometry = getTransformGeometry(
      size.width,
      size.height,
      sample.position,
      transform.transformOffset,
      transform.anchor,
      transform.scale,
      transform.rotation
    );
    return {
      frame: sample.frame,
      x: geometry.anchorWorld.x,
      y: geometry.anchorWorld.y,
      isKeyframe: sample.isKeyframe,
      isCurrent:
        sample.frame === options.target!.globalFrame,
    };
  });
}

function nodeSize(node: EvaluatedSceneNode) {
  return node.type === "composition"
    ? node.size
    : node.logicalSize;
}

function descriptorForNode(options: {
  node: EvaluatedSceneNode;
  inputsByLayerDocumentId: ReadonlyMap<
    string,
    LayerDocumentRuntimeInput
  >;
  renderAssets: LayerDocumentCanvasRenderAssetPort;
}): SelectionSourceAlphaDescriptor | null {
  const node = options.node;
  const layerDocumentId = node.layerDocumentId;
  if (!layerDocumentId) return null;
  const input =
    options.inputsByLayerDocumentId.get(layerDocumentId);
  if (!input) return null;
  if (node.type === "placeholder") {
    return {
      kind: "solid",
      logicalSize: node.logicalSize,
      sourceFingerprint:
        `layer-document:${layerDocumentId}:${node.sourceType}`,
      sourceRevision: input.revision,
      frameVisualKey:
        STATIC_PSD_SELECTION_FRAME_VISUAL_KEY,
      opacity: node.opacity,
      visible: node.visible,
    };
  }
  if (node.type === "composition") {
    const orderedChildren = node.children.map((child) => {
      const source = descriptorForNode({
        ...options,
        node: child,
      });
      return source
        ? { source, transform: child.transform }
        : null;
    });
    if (orderedChildren.some((child) => child === null)) {
      return null;
    }
    return {
      kind: "subComp",
      logicalSize: node.size,
      sourceFingerprint:
        `layer-document:${layerDocumentId}`,
      sourceRevision: input.layerResultCacheKey,
      frameVisualKey: input.localFrame,
      opacity: node.opacity,
      visible: node.visible,
      orderedChildren: orderedChildren.filter(
        (child): child is NonNullable<typeof child> =>
          child !== null
      ),
    };
  }
  if (!node.sourceId || !input.sourceResourceCacheKey) {
    return null;
  }
  const asset = options.renderAssets.resolve({
    layerDocumentId,
    sourceId: node.sourceId,
    sourceResourceCacheKey:
      input.sourceResourceCacheKey,
    renderItemId: node.renderItemId,
    drawableId: node.drawableId,
    logicalSize: node.logicalSize,
  });
  if (!asset?.alphaCanvas) return null;
  return {
    kind: "layer",
    sourceCanvas: asset.alphaCanvas,
    logicalSize: node.logicalSize,
    sourceFingerprint: asset.sourceVisualIdentity,
    sourceRevision: input.sourceResourceCacheKey,
    frameVisualKey:
      STATIC_PSD_SELECTION_FRAME_VISUAL_KEY,
    opacity: node.opacity,
    visible: node.visible,
  };
}

export function buildLayerDocumentCanvasDirectSelectionCandidates(
  options: {
    runtime: LayerDocumentRuntimeReadModel;
    viewport: LayerDocumentCanvasViewportInput;
    renderAssets: LayerDocumentCanvasRenderAssetPort;
  }
): LayerDocumentCanvasDirectSelectionCandidate[] {
  const inputsByLayerDocumentId = new Map(
    options.runtime.inputs.map((input) => [
      input.layerDocumentId,
      input,
    ])
  );
  const targetsByLayerDocumentId = new Map(
    options.runtime.targets.map((target) => [
      target.layerDocumentId,
      target,
    ])
  );
  return options.runtime.scene.nodes.flatMap(
    (
      node,
      sceneNodeIndex
    ): LayerDocumentCanvasDirectSelectionCandidate[] => {
      const layerDocumentId = node.layerDocumentId;
      if (!layerDocumentId) return [];
      const size = nodeSize(node);
      const projection = buildCanvasSelectionProjection({
        size,
        transform: node.transform,
        viewportScale: options.viewport.viewportScale,
        viewportOffset: options.viewport.viewportOffset,
      });
      if (!projection) return [];
      const input =
        inputsByLayerDocumentId.get(layerDocumentId);
      const target =
        targetsByLayerDocumentId.get(layerDocumentId);
      const shared = {
        sceneNodeIndex,
        layerDocumentId,
        targetKind:
          node.type === "composition"
            ? "group" as const
            : "layer" as const,
        sourceId: node.sourceId,
        sourceResourceCacheKey:
          input?.sourceResourceCacheKey ?? null,
        projection,
      };
      if (!target) {
        return [{
          ...shared,
          status: "blocked" as const,
          reason: "missing-runtime-target" as const,
          target: null,
        }];
      }
      const descriptor = descriptorForNode({
        node,
        inputsByLayerDocumentId,
        renderAssets: options.renderAssets,
      });
      if (!descriptor) {
        return [{
          ...shared,
          status: "blocked" as const,
          reason: "missing-render-asset" as const,
          target: target.directSelection.target,
        }];
      }
      return [{
        ...shared,
        status: "ready" as const,
        target: target.directSelection.target,
        descriptor,
      }];
    }
  );
}

export function resolveLayerDocumentCanvasGlowCandidate(
  candidates:
    readonly LayerDocumentCanvasDirectSelectionCandidate[],
  selectedLayerDocumentId: string | null
) {
  if (!selectedLayerDocumentId) return null;
  const matches = candidates.filter(
    (candidate) =>
      candidate.layerDocumentId ===
      selectedLayerDocumentId
  );
  return matches.length === 1 &&
    matches[0]?.status === "ready"
    ? matches[0]
    : null;
}
