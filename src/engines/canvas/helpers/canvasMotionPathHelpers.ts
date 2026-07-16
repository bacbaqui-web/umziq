import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import type { PreviewMotionPathPoint } from "@/engines/canvas/models/canvasViewModel";
import { getTransformGeometry } from "@/engines/canvas/helpers/canvasCoordinateHelpers";
import {
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerRotation,
  evaluateLayerScale,
} from "@/engines/animation";
import {
  buildPositionMotionPathSamples,
  globalFrameToLocalFrame,
} from "@/engines/animation";

export { buildLocalFrameBySourceId } from "@/engines/animation";
export function buildRulerFrames(durationFrames: number, frameRate: number) {
  return Array.from({ length: durationFrames }, (_, frame) => ({
    frame,
    label: frame % frameRate === 0 ? `${frame / frameRate}s` : "",
  }));
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

  return buildPositionMotionPathSamples({
    basePosition: layer.position,
    positionKeyframes: layer.positionKeyframes,
    positionTrackEnabled: layer.enabledProperties.position,
    startFrame: timelineItem.startFrame,
    durationFrames: timelineItem.durationFrames,
    compositionDurationFrames: durationFrames,
  }).map((sample) => {
    const localFrame = globalFrameToLocalFrame(sample.frame, timelineItem.startFrame);
    const scale = evaluateLayerScale(layer, localFrame);
    const rotation = evaluateLayerRotation(layer, localFrame);
    const geometry = getTransformGeometry(
      canvas.width || 0,
      canvas.height || 0,
      sample.position,
      layer.transformOffset,
      layer.anchor,
      scale,
      rotation
    );

    return {
      frame: sample.frame,
      x: geometry.anchorWorld.x,
      y: geometry.anchorWorld.y,
      isKeyframe: sample.isKeyframe,
      isCurrent: sample.frame === currentFrame,
    };
  });
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

  return buildPositionMotionPathSamples({
    basePosition: composition.position,
    positionKeyframes: composition.positionKeyframes,
    positionTrackEnabled: composition.enabledProperties.position,
    startFrame: timelineItem.startFrame,
    durationFrames: timelineItem.durationFrames,
    compositionDurationFrames: durationFrames,
  }).map((sample) => {
    const localFrame = globalFrameToLocalFrame(sample.frame, timelineItem.startFrame);
    const scale = evaluateCompositionScale(composition, localFrame);
    const rotation = evaluateCompositionRotation(composition, localFrame);
    const geometry = getTransformGeometry(
      compositionMeta.width,
      compositionMeta.height,
      sample.position,
      composition.transformOffset,
      composition.anchor,
      scale,
      rotation
    );

    return {
      frame: sample.frame,
      x: geometry.anchorWorld.x,
      y: geometry.anchorWorld.y,
      isKeyframe: sample.isKeyframe,
      isCurrent: sample.frame === currentFrame,
    };
  });
}

export function clampFrame(frame: number, durationFrames: number) {
  return Math.min(Math.max(frame, 0), Math.max(durationFrames - 1, 0));
}
