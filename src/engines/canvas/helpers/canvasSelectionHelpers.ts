import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import {
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
} from "@/engines/animation";
import { getTransformGeometry } from "@/engines/canvas/helpers/canvasCoordinateHelpers";
import { worldPointToCanvasPoint } from "@/engines/canvas/helpers/canvasViewportHelpers";
import type { CanvasSelectionReadModel, CanvasSize } from "@/engines/canvas/models/canvasEngineModel";
import type { PreviewOverlay } from "@/engines/canvas/models/canvasViewModel";

export function buildLayerSelectionOverlay(
  layer: Layer,
  renderItems: readonly RenderItem[],
  timelineItems: readonly TimelineItem[],
  currentFrame: number
): PreviewOverlay {
  const timelineItem = timelineItems.find(
    (item) => item.kind === "layer" && item.sourceId === layer.id
  );
  if (
    !timelineItem ||
    currentFrame < timelineItem.startFrame ||
    currentFrame >= timelineItem.startFrame + timelineItem.durationFrames
  ) {
    return null;
  }

  const renderItem = renderItems.find(
    (item) => item.kind === "layer" && item.sourceId === layer.id
  );
  const drawable = renderItem?.drawables.find((target) => target.canvas && target.visible);
  const canvas = drawable?.canvas;
  if (!drawable || !canvas) return null;

  const localFrame = currentFrame - timelineItem.startFrame;
  const position = evaluateLayerPosition(layer, localFrame);
  const scale = evaluateLayerScale(layer, localFrame);
  const rotation = evaluateLayerRotation(layer, localFrame);
  const geometry = getTransformGeometry(
    canvas.width || 0,
    canvas.height || 0,
    position,
    layer.transformOffset,
    layer.anchor,
    scale,
    rotation
  );
  if (geometry.bounds.width <= 0 || geometry.bounds.height <= 0) return null;

  return {
    targetKind: "layer",
    targetId: layer.id,
    x: geometry.bounds.x,
    y: geometry.bounds.y,
    width: geometry.bounds.width,
    height: geometry.bounds.height,
    centerX: geometry.centerWorld.x,
    centerY: geometry.centerWorld.y,
    corners: geometry.corners,
    anchorX: geometry.anchorWorld.x,
    anchorY: geometry.anchorWorld.y,
    scaleX: scale.x,
    scaleY: scale.y,
    rotation,
    sourceWidth: canvas.width || 0,
    sourceHeight: canvas.height || 0,
    canvasWidth: canvas.width || 0,
    canvasHeight: canvas.height || 0,
  };
}

export function buildCompositionSelectionOverlay(
  composition: Composition,
  metaByCompId: Readonly<Record<string, CompositionMeta>>,
  localFrameBySourceId: ReadonlyMap<string, number>
): PreviewOverlay {
  const meta = metaByCompId[composition.id];
  const localFrame = localFrameBySourceId.get(composition.id);
  if (!meta || localFrame === undefined) return null;

  const position = evaluateCompositionPosition(composition, localFrame);
  const scale = evaluateCompositionScale(composition, localFrame);
  const rotation = evaluateCompositionRotation(composition, localFrame);
  const geometry = getTransformGeometry(
    meta.width,
    meta.height,
    position,
    composition.transformOffset,
    composition.anchor,
    scale,
    rotation
  );

  return {
    targetKind: "composition",
    targetId: composition.id,
    x: geometry.bounds.x,
    y: geometry.bounds.y,
    width: geometry.bounds.width,
    height: geometry.bounds.height,
    centerX: geometry.centerWorld.x,
    centerY: geometry.centerWorld.y,
    corners: geometry.corners,
    anchorX: geometry.anchorWorld.x,
    anchorY: geometry.anchorWorld.y,
    scaleX: scale.x,
    scaleY: scale.y,
    rotation,
    sourceWidth: meta.width,
    sourceHeight: meta.height,
    canvasWidth: meta.width,
    canvasHeight: meta.height,
  };
}

export function buildCanvasSelectionReadModel({
  overlay,
  selectedMeta,
  previewSize,
  viewportScale,
  viewportOffset,
}: {
  overlay: PreviewOverlay;
  selectedMeta: CompositionMeta | null;
  previewSize: CanvasSize;
  viewportScale: number;
  viewportOffset: { x: number; y: number };
}): CanvasSelectionReadModel {
  if (!overlay || !selectedMeta) {
    return {
      overlay: null,
      previewCorners: null,
      previewAnchor: null,
      previewCenter: null,
      polygonPoints: "",
    };
  }

  const toCanvasPoint = (point: { x: number; y: number }) =>
    worldPointToCanvasPoint(
      { meta: selectedMeta, previewSize, viewportScale, viewportOffset },
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
    previewAnchor: toCanvasPoint({ x: overlay.anchorX, y: overlay.anchorY }),
    previewCenter: toCanvasPoint({ x: overlay.centerX, y: overlay.centerY }),
    polygonPoints: Object.values(previewCorners)
      .map((point) => `${point.x},${point.y}`)
      .join(" "),
  };
}
