import type {
  LayerDocumentDraftInteractionPreparation,
  LayerDocumentRuntimeInput,
  LayerDocumentTransformDraftSnapshot,
  PreviewSceneTransformPatch,
} from "@/render/models/layerDocumentRuntimeModel";
import {
  buildLayerDocumentTransformDraftSnapshot,
} from "@/render/helpers/layerDocumentRuntimeEvaluationHelpers";

export function prepareLayerDocumentPointerMove(options: {
  input: LayerDocumentRuntimeInput;
  patch: PreviewSceneTransformPatch;
}): LayerDocumentDraftInteractionPreparation {
  return {
    kind: "pointer-move",
    draft: buildLayerDocumentTransformDraftSnapshot(
      options.input,
      options.patch
    ),
    projectUpdateCount: 0,
    transactionCount: 0,
    historyEntryCount: 0,
  };
}

export function prepareLayerDocumentPointerUp(
  draft: LayerDocumentTransformDraftSnapshot
): LayerDocumentDraftInteractionPreparation {
  return {
    kind: "pointer-up",
    draft: null,
    commitIntent: {
      kind: "commit-layer-document-transform",
      layerDocumentId: draft.layerDocumentId,
      globalFrame: draft.globalFrame,
      localFrame: draft.localFrame,
      patch: draft.patch,
    },
    projectUpdateCount: 0,
    transactionCount: 1,
    historyEntryCount: 1,
  };
}
