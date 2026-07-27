import type { LayerDocument } from "@/models";
import type {
  LayerDocumentRuntimeInput,
  LayerDocumentRuntimeTargetReadModel,
  LayerDocumentTransformDraftSnapshot,
} from "@/render/models/layerDocumentRuntimeModel";
import {
  buildLayerDocumentMotionPathSamples,
} from "@/render/helpers/layerDocumentRuntimeEvaluationHelpers";

export function buildLayerDocumentRuntimeTargetReadModel(options: {
  input: LayerDocumentRuntimeInput;
  layer: LayerDocument;
  compositionDurationFrames: number;
  frameRate: number;
  draft?: LayerDocumentTransformDraftSnapshot | null;
}): LayerDocumentRuntimeTargetReadModel {
  const input = options.input;
  const target = input.target;
  const evaluatedTransform = input.evaluatedTransform;
  const shared = {
    target,
    evaluatedTransform,
    opacity: input.opacity,
  };
  return {
    target,
    layerDocumentId: input.layerDocumentId,
    sourceId: input.sourceId,
    globalFrame: input.globalFrame,
    localFrame: input.localFrame,
    evaluatedTransform,
    opacity: input.opacity,
    directSelection: shared,
    glow: {
      ...shared,
      sourceResourceCacheKey: input.sourceResourceCacheKey,
    },
    gizmo: shared,
    motionPath: {
      ...shared,
      samples: buildLayerDocumentMotionPathSamples({
        layer: options.layer,
        compositionDurationFrames: options.compositionDurationFrames,
        frameRate: options.frameRate,
        globalFrame: input.globalFrame,
        localFrame: input.localFrame,
        draft: options.draft,
        draftFrameScope: "target",
      }),
    },
  };
}
