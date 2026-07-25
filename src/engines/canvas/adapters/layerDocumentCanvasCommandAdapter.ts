import type {
  PreviewSceneTransformPatch,
} from "@/engines/playback-render";
import type {
  LayerDocumentCanvasCommandPort,
  LayerDocumentCanvasCommands,
  LayerDocumentCanvasHandleDraft,
} from "@/engines/canvas/models/layerDocumentCanvasModeModel";

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

export function createLayerDocumentCanvasCommands<
  TCommitResult,
  TSelectionResult,
  TKeyframeResult,
>(options: {
  selectedLayerDocumentId: string | null;
  quality: string;
  port: LayerDocumentCanvasCommandPort<
    TCommitResult,
    TSelectionResult,
    TKeyframeResult
  >;
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
        quality: options.quality,
      });
    },
    commitDraft: options.port.pointerUp,
    cancelDraft: options.port.cancelDraft,
    directSelect: options.port.directSelect,
    enterGroup: options.port.enterGroup,
    publishMotionPathKeyframeDraft:
      options.port.publishMotionPathKeyframeDraft,
    commitMotionPathKeyframeDraft:
      options.port.commitMotionPathKeyframeDraft,
    cancelMotionPathKeyframeDraft:
      options.port.cancelMotionPathKeyframeDraft,
    selectMotionPathKeyframe:
      options.port.selectMotionPathKeyframe,
    seekFrame: options.port.seekFrame,
  };
}
