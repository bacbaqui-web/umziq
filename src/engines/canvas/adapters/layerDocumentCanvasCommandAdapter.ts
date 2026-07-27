import type {
  LayerDocumentSourceSamplingQuality,
  PreviewSceneTransformPatch,
  RuntimeMetricRecordPort,
} from "@/render";
import type {
  LayerDocumentCanvasCommandPort,
  LayerDocumentCanvasCommands,
  LayerDocumentCanvasHandleDraft,
} from "@/engines/canvas/models/layerDocumentCanvasReadModel";

function patchForHandle(
  draft: LayerDocumentCanvasHandleDraft
): PreviewSceneTransformPatch {
  switch (draft.handle) {
    case "position":
      return { position: draft.value };
    case "scale-x":
    case "scale-y":
    case "scale-xy":
      return { scale: draft.value };
    case "rotation":
      return { rotation: draft.value };
    case "opacity":
      return { opacity: draft.value };
    case "anchor":
      return {
        anchor: draft.value.anchor,
        transformOffset: draft.value.transformOffset,
      };
    case "transform-offset":
      return { transformOffset: draft.value };
  }
}

function recordCommittedProjectChange(
  result: unknown,
  runtimeMetrics?: RuntimeMetricRecordPort
) {
  if (
    !result ||
    typeof result !== "object" ||
    !("ok" in result) ||
    result.ok !== true ||
    !("transition" in result) ||
    !result.transition ||
    typeof result.transition !== "object" ||
    !("changed" in result.transition) ||
    result.transition.changed !== true
  ) {
    return;
  }
  runtimeMetrics?.increment("projectUpdate");
  runtimeMetrics?.increment("historyCommit");
}

export function createLayerDocumentCanvasCommands<
  TCommitResult,
  TSelectionResult,
  TKeyframeResult,
>(options: {
  selectedLayerDocumentId: string | null;
  sourceSamplingQuality:
    LayerDocumentSourceSamplingQuality;
  port: LayerDocumentCanvasCommandPort<
    TCommitResult,
    TSelectionResult,
    TKeyframeResult
  >;
  runtimeMetrics?: RuntimeMetricRecordPort;
}): LayerDocumentCanvasCommands<
  TCommitResult,
  TSelectionResult,
  TKeyframeResult
> {
  return {
    updateHandleDraft: (draft) => {
      const layerDocumentId =
        options.selectedLayerDocumentId;
      if (!layerDocumentId) return null;
      return options.port.pointerMove({
        layerDocumentId,
        patch: patchForHandle(draft),
        sourceSamplingQuality:
          options.sourceSamplingQuality,
      });
    },
    commitDraft: () => {
      const result = options.port.pointerUp();
      recordCommittedProjectChange(
        result,
        options.runtimeMetrics
      );
      return result;
    },
    cancelDraft: options.port.cancelDraft,
    directSelect: options.port.directSelect,
    enterGroup: options.port.enterGroup,
    publishMotionPathKeyframeDraft:
      options.port.publishMotionPathKeyframeDraft,
    commitMotionPathKeyframeDraft: () => {
      const result =
        options.port.commitMotionPathKeyframeDraft();
      recordCommittedProjectChange(
        result,
        options.runtimeMetrics
      );
      return result;
    },
    cancelMotionPathKeyframeDraft:
      options.port.cancelMotionPathKeyframeDraft,
    selectMotionPathKeyframe:
      options.port.selectMotionPathKeyframe,
    seekFrame: options.port.seekFrame,
  };
}
