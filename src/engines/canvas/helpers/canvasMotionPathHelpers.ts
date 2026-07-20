import type { Composition, CompositionMeta, Layer, TimelineItem } from "@/models";
import type { RenderItem } from "@/engines/project";
import type { PreviewMotionPathPoint } from "@/engines/canvas/models/canvasViewModel";
import type { DraftTransformSnapshot } from "@/engines/canvas/helpers/draftTransformRuntimeHelpers";
import { getTransformGeometry } from "@/engines/canvas/helpers/canvasCoordinateHelpers";
import {
  evaluateCompositionRotation,
  evaluateCompositionScale,
  evaluateLayerRotation,
  evaluateLayerScale,
  upsertKeyframeValue,
} from "@/engines/animation";
import {
  buildPositionMotionPathSamples,
  globalFrameToLocalFrame,
} from "@/engines/animation";

export { buildLocalFrameBySourceId } from "@/engines/animation";

function resolveMotionPathPositionInputs(
  target: Layer | Composition,
  draftTransformSnapshot: DraftTransformSnapshot | null
) {
  if (!draftTransformSnapshot?.draft.changed.position) {
    return {
      basePosition: target.position,
      positionKeyframes: target.positionKeyframes,
    };
  }

  return {
    basePosition: draftTransformSnapshot.position,
    positionKeyframes: target.enabledProperties.position
      ? upsertKeyframeValue(
          target.positionKeyframes,
          draftTransformSnapshot.localFrame,
          draftTransformSnapshot.position
        )
      : target.positionKeyframes,
  };
}

function resolveMotionPathGeometryInputs(
  target: Layer | Composition,
  draftTransformSnapshot: DraftTransformSnapshot | null
) {
  return {
    anchor: draftTransformSnapshot?.anchor ?? target.anchor,
    transformOffset:
      draftTransformSnapshot?.transformOffset ?? target.transformOffset,
  };
}

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
  currentFrame: number,
  frameRate = 30,
  draftTransformSnapshot: DraftTransformSnapshot | null = null
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

  const positionInputs = resolveMotionPathPositionInputs(layer, draftTransformSnapshot);
  const geometryInputs = resolveMotionPathGeometryInputs(
    layer,
    draftTransformSnapshot
  );

  return buildPositionMotionPathSamples({
    ...positionInputs,
    positionTrackEnabled: layer.enabledProperties.position,
    startFrame: timelineItem.startFrame,
    durationFrames: timelineItem.durationFrames,
    compositionDurationFrames: durationFrames,
    targetId: layer.id,
    modifiers: layer.modifiers,
    frameRate,
  }).map((sample) => {
    const localFrame = globalFrameToLocalFrame(sample.frame, timelineItem.startFrame);
    const scale = evaluateLayerScale(layer, localFrame);
    const rotation = evaluateLayerRotation(layer, localFrame);
    const geometry = getTransformGeometry(
      canvas.width || 0,
      canvas.height || 0,
      sample.position,
      geometryInputs.transformOffset,
      geometryInputs.anchor,
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
  currentFrame: number,
  draftTransformSnapshot: DraftTransformSnapshot | null = null
): PreviewMotionPathPoint[] {
  const timelineItem = timelineItems.find(
    (item) => item.kind === "subComp" && item.sourceId === composition.id
  );
  const compositionMeta = metaByCompId[composition.id];

  if (!timelineItem || !compositionMeta) {
    return [];
  }

  const positionInputs = resolveMotionPathPositionInputs(
    composition,
    draftTransformSnapshot
  );
  const geometryInputs = resolveMotionPathGeometryInputs(
    composition,
    draftTransformSnapshot
  );

  return buildPositionMotionPathSamples({
    ...positionInputs,
    positionTrackEnabled: composition.enabledProperties.position,
    startFrame: timelineItem.startFrame,
    durationFrames: timelineItem.durationFrames,
    compositionDurationFrames: durationFrames,
    targetId: composition.id,
    modifiers: composition.modifiers,
    frameRate: compositionMeta.frameRate,
  }).map((sample) => {
    const localFrame = globalFrameToLocalFrame(sample.frame, timelineItem.startFrame);
    const scale = evaluateCompositionScale(composition, localFrame);
    const rotation = evaluateCompositionRotation(composition, localFrame);
    const geometry = getTransformGeometry(
      compositionMeta.width,
      compositionMeta.height,
      sample.position,
      geometryInputs.transformOffset,
      geometryInputs.anchor,
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
