import type {
  LayerDocument,
  ModifierInstance,
} from "@/models";
import {
  applyPositionModifiers,
  buildPositionMotionPathSamples,
  clampOpacity,
  evaluatePositionKeyframes,
  evaluateScalarKeyframes,
  evaluateScaleKeyframes,
  upsertKeyframeValue,
} from "@/animation";
import type {
  EvaluatedSceneTransform,
} from "@/render/models/evaluatedSceneModel";
import type {
  LayerDocumentRuntimeInput,
  LayerDocumentTransformDraftSnapshot,
  PreviewSceneTransformPatch,
} from "@/render/models/layerDocumentRuntimeModel";
import {
  buildLayerDocumentDraftIdentity,
} from "@/render/helpers/layerDocumentRuntimeCacheKeyHelpers";

export function adaptLayerDocumentModifiers(
  layer: LayerDocument
): ModifierInstance[] {
  return layer.common.modifiers.flatMap((modifier) =>
    modifier.type === "wiggle" && modifier.enabled
      ? [{
          id: modifier.modifierId,
          type: "wiggle" as const,
          frequency: modifier.frequency,
          amount: modifier.amount,
        }]
      : []
  );
}

export function evaluateLayerDocumentTransform(
  layer: LayerDocument,
  localFrame: number,
  frameRate: number
): {
  readonly transform: EvaluatedSceneTransform;
  readonly opacity: number;
} {
  const common = layer.common;
  const animation = common.animation;
  const transform = common.transform;
  const basePosition = animation.enabledProperties.position
    ? evaluatePositionKeyframes(
        transform.position,
        animation.positionKeyframes,
        localFrame
      )
    : transform.position;
  const position = applyPositionModifiers(
    basePosition,
    layer.layerDocumentId,
    adaptLayerDocumentModifiers(layer),
    localFrame,
    frameRate
  );
  const scale = animation.enabledProperties.scale
    ? evaluateScaleKeyframes(
        transform.scale,
        animation.scaleKeyframes,
        localFrame
      )
    : transform.scale;
  const rotation = animation.enabledProperties.rotation
    ? evaluateScalarKeyframes(
        transform.rotation,
        animation.rotationKeyframes,
        localFrame
      )
    : transform.rotation;
  const opacity = clampOpacity(
    animation.enabledProperties.opacity
      ? evaluateScalarKeyframes(
          transform.opacity,
          animation.opacityKeyframes,
          localFrame
        )
      : transform.opacity
  );

  return {
    transform: {
      position,
      transformOffset: transform.transformOffset,
      anchor: transform.anchor,
      scale,
      rotation,
    },
    opacity,
  };
}

export function isLayerDocumentDraftForInput(
  input: Pick<
    LayerDocumentRuntimeInput,
    "layerDocumentId" | "globalFrame" | "localFrame"
  >,
  draft: LayerDocumentTransformDraftSnapshot | null | undefined
): draft is LayerDocumentTransformDraftSnapshot {
  return Boolean(
    draft &&
      draft.target.kind === "layer-document" &&
      draft.target.layerDocumentId === input.layerDocumentId &&
      draft.layerDocumentId === input.layerDocumentId &&
      draft.globalFrame === input.globalFrame &&
      draft.localFrame === input.localFrame
  );
}

export function isLayerDocumentDraftForTarget(
  layerDocumentId: string,
  draft: LayerDocumentTransformDraftSnapshot | null | undefined
): draft is LayerDocumentTransformDraftSnapshot {
  return Boolean(
    draft &&
      draft.target.kind === "layer-document" &&
      draft.target.layerDocumentId === layerDocumentId &&
      draft.layerDocumentId === layerDocumentId
  );
}

export function applyLayerDocumentTransformDraft(
  evaluated: ReturnType<typeof evaluateLayerDocumentTransform>,
  patch: PreviewSceneTransformPatch
): ReturnType<typeof evaluateLayerDocumentTransform> {
  return {
    transform: {
      position: patch.position ?? evaluated.transform.position,
      transformOffset:
        patch.transformOffset ?? evaluated.transform.transformOffset,
      anchor: patch.anchor ?? evaluated.transform.anchor,
      scale: patch.scale ?? evaluated.transform.scale,
      rotation: patch.rotation ?? evaluated.transform.rotation,
    },
    opacity: patch.opacity ?? evaluated.opacity,
  };
}

export function buildLayerDocumentTransformDraftSnapshot(
  input: LayerDocumentRuntimeInput,
  patch: PreviewSceneTransformPatch
): LayerDocumentTransformDraftSnapshot {
  const evaluated = applyLayerDocumentTransformDraft(
    {
      transform: input.evaluatedTransform,
      opacity: input.opacity,
    },
    patch
  );
  const snapshotWithoutIdentity = {
    target: input.target,
    layerDocumentId: input.layerDocumentId,
    globalFrame: input.globalFrame,
    localFrame: input.localFrame,
    patch,
    evaluatedTransform: evaluated.transform,
    opacity: evaluated.opacity,
  };
  return {
    ...snapshotWithoutIdentity,
    identity: buildLayerDocumentDraftIdentity(snapshotWithoutIdentity),
  };
}

export function buildLayerDocumentMotionPathSamples(options: {
  layer: LayerDocument;
  compositionDurationFrames: number;
  frameRate: number;
  globalFrame: number;
  localFrame: number;
  draft?: LayerDocumentTransformDraftSnapshot | null;
  draftFrameScope?: "current-input" | "target";
}) {
  const layer = options.layer;
  const placement = layer.common.placement;
  const animation = layer.common.animation;
  const matchingDraft = (
    options.draftFrameScope === "target"
      ? isLayerDocumentDraftForTarget(
          layer.layerDocumentId,
          options.draft
        )
      : isLayerDocumentDraftForInput(
          {
            layerDocumentId:
              layer.layerDocumentId,
            globalFrame: options.globalFrame,
            localFrame: options.localFrame,
          },
          options.draft
        )
  )
    ? options.draft
    : null;
  const positionChanged = Boolean(
    matchingDraft?.patch.position
  );
  const basePosition = positionChanged &&
    !animation.enabledProperties.position
    ? matchingDraft!.evaluatedTransform.position
    : layer.common.transform.position;
  const positionKeyframes =
    positionChanged && animation.enabledProperties.position
      ? upsertKeyframeValue(
          animation.positionKeyframes,
          matchingDraft!.localFrame,
          matchingDraft!.evaluatedTransform.position
        )
      : animation.positionKeyframes;

  return buildPositionMotionPathSamples({
    basePosition,
    positionKeyframes,
    positionTrackEnabled: animation.enabledProperties.position,
    startFrame: placement.startFrame,
    durationFrames: placement.durationFrames,
    sourceOffsetFrames: placement.sourceOffsetFrames,
    compositionDurationFrames: options.compositionDurationFrames,
    targetId: layer.layerDocumentId,
    modifiers: adaptLayerDocumentModifiers(layer),
    frameRate: options.frameRate,
  });
}
