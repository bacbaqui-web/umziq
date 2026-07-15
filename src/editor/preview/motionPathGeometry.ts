import type { Composition, CompositionMeta, Layer, RenderItem, TimelineItem } from "@/editor/types/types";
import type {
  PreviewMotionPathPoint,
  PreviewOverlay as PreviewOverlayData,
} from "@/editor/types/editorViewTypes";
import {
  getTransformGeometry,
} from "@/editor/preview/previewCoordinateMath";
import {
  evaluateCompositionPosition,
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerPosition,
  evaluateLayerRotation,
  evaluateLayerScale,
} from "@/editor/preview/previewValueEvaluation";

export function buildLocalFrameBySourceId(
  timelineItems: TimelineItem[],
  currentFrame: number
) {
  const result = new Map<string, number>();

  timelineItems.forEach((item) => {
    if (currentFrame < item.startFrame || currentFrame >= item.startFrame + item.durationFrames) {
      return;
    }

    result.set(item.sourceId, currentFrame - item.startFrame);
  });

  return result;
}

export function buildRulerFrames(durationFrames: number, frameRate: number) {
  return Array.from({ length: durationFrames }, (_, frame) => ({
    frame,
    label: frame % frameRate === 0 ? `${frame / frameRate}s` : "",
  }));
}

export function buildLayerOverlay(
  layer: Layer,
  renderItems: RenderItem[],
  timelineItems: TimelineItem[],
  currentFrame: number
): PreviewOverlayData | null {
  const timelineItem = timelineItems.find(
    (item) => item.kind === "layer" && item.sourceId === layer.id
  );

  if (!timelineItem) return null;

  const isActive =
    currentFrame >= timelineItem.startFrame &&
    currentFrame < timelineItem.startFrame + timelineItem.durationFrames;

  if (!isActive) return null;

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

export function buildCompositionOverlay(
  composition: Composition,
  metaByCompId: Record<string, CompositionMeta>,
  localFrameBySourceId: Map<string, number>
): PreviewOverlayData | null {
  const compositionMeta = metaByCompId[composition.id];
  const compositionTimelineFrame = localFrameBySourceId.get(composition.id);

  if (!compositionMeta || compositionTimelineFrame === undefined) {
    return null;
  }

  const compositionScale = evaluateCompositionScale(
    composition,
    compositionTimelineFrame
  );
  const compositionRotation = evaluateCompositionRotation(
    composition,
    compositionTimelineFrame
  );
  const compositionPosition = evaluateCompositionPosition(
    composition,
    compositionTimelineFrame
  );
  const geometry = getTransformGeometry(
    compositionMeta.width,
    compositionMeta.height,
    compositionPosition,
    composition.transformOffset,
    composition.anchor,
    compositionScale,
    compositionRotation
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
    scaleX: compositionScale.x,
    scaleY: compositionScale.y,
    rotation: compositionRotation,
    sourceWidth: compositionMeta.width,
    sourceHeight: compositionMeta.height,
    canvasWidth: compositionMeta.width,
    canvasHeight: compositionMeta.height,
  };
}

export function buildLayerMotionPath(
  layer: Layer,
  renderItems: RenderItem[],
  timelineItems: TimelineItem[],
  durationFrames: number,
  currentFrame: number
): PreviewMotionPathPoint[] {
  const timelineItem = timelineItems.find(
    (item) => item.kind === "layer" && item.sourceId === layer.id
  );

  if (!timelineItem) return [];

  const renderItem = renderItems.find(
    (item) => item.kind === "layer" && item.sourceId === layer.id
  );
  const drawable = renderItem?.drawables.find((target) => target.canvas && target.visible);
  const canvas = drawable?.canvas;

  if (!drawable || !canvas) return [];

  const highlightedFrames = layer.enabledProperties.position
    ? new Set(layer.positionKeyframes.map((keyframe) => keyframe.frame + timelineItem.startFrame))
    : new Set<number>();

  const points: PreviewMotionPathPoint[] = [];

  for (let frame = 0; frame < durationFrames; frame += 1) {
    if (
      frame < timelineItem.startFrame ||
      frame >= timelineItem.startFrame + timelineItem.durationFrames
    ) {
      continue;
    }

    const localFrame = frame - timelineItem.startFrame;
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

    points.push({
      frame,
      x: geometry.anchorWorld.x,
      y: geometry.anchorWorld.y,
      isKeyframe: highlightedFrames.has(frame),
      isCurrent: frame === currentFrame,
    });
  }

  return points;
}

export function buildCompositionMotionPath(
  composition: Composition,
  timelineItems: TimelineItem[],
  metaByCompId: Record<string, CompositionMeta>,
  durationFrames: number,
  currentFrame: number
): PreviewMotionPathPoint[] {
  const timelineItem = timelineItems.find(
    (item) => item.kind === "subComp" && item.sourceId === composition.id
  );
  const compositionMeta = metaByCompId[composition.id];

  if (!timelineItem || !compositionMeta) {
    return [];
  }

  const highlightedFrames = composition.enabledProperties.position
    ? new Set(
        composition.positionKeyframes.map((keyframe) => keyframe.frame + timelineItem.startFrame)
      )
    : new Set<number>();
  const points: PreviewMotionPathPoint[] = [];

  for (let frame = 0; frame < durationFrames; frame += 1) {
    if (
      frame < timelineItem.startFrame ||
      frame >= timelineItem.startFrame + timelineItem.durationFrames
    ) {
      continue;
    }

    const localFrame = frame - timelineItem.startFrame;
    const position = evaluateCompositionPosition(composition, localFrame);
    const scale = evaluateCompositionScale(composition, localFrame);
    const rotation = evaluateCompositionRotation(composition, localFrame);
    const geometry = getTransformGeometry(
      compositionMeta.width,
      compositionMeta.height,
      position,
      composition.transformOffset,
      composition.anchor,
      scale,
      rotation
    );

    points.push({
      frame,
      x: geometry.anchorWorld.x,
      y: geometry.anchorWorld.y,
      isKeyframe: highlightedFrames.has(frame),
      isCurrent: frame === currentFrame,
    });
  }

  return points;
}

export function clampFrame(frame: number, durationFrames: number) {
  return Math.min(Math.max(frame, 0), Math.max(durationFrames - 1, 0));
}
